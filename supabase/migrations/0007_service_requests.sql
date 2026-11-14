-- 0007_service_requests: solicitudes de cotización (CU-03). Requiere 0002, 0003 y 0004.
-- El cliente crea la solicitud en `draft`; el paso a `open` y a `cancelled` solo ocurre en funciones (0010).

create table public.service_requests (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  workshop_id uuid not null references public.workshops (id) on delete cascade,
  service_type public.service_type not null,
  description text not null check (char_length(description) between 1 and 1000),
  status public.request_status not null default 'draft',
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index service_requests_client_idx on public.service_requests (client_id, status);
create index service_requests_workshop_idx on public.service_requests (workshop_id, status);
-- Una sola solicitud viva por cliente y taller (D7, sección 2 de 0001-arquitectura.md).
create unique index service_requests_one_live
  on public.service_requests (client_id, workshop_id)
  where status in ('draft', 'open', 'quoted');

create trigger service_requests_touch
  before update on public.service_requests
  for each row execute function private.touch_updated_at();

alter table public.service_requests enable row level security;

-- ¿El taller recibe solicitudes de ese servicio? (publicado, no suspendido y con el servicio)
create function private.workshop_accepts_requests(p_workshop_id uuid, p_service public.service_type)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.workshops w
     where w.id = p_workshop_id
       and w.published
       and not w.suspended
       and p_service = any (w.services)
  );
$$;

-- ¿El usuario es el cliente dueño de la solicitud en `draft`? (helper de RLS y de Storage)
create function private.owns_draft_request(p_request_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.service_requests r
      join public.profiles p on p.id = r.client_id
     where r.id = p_request_id
       and r.client_id = (select auth.uid())
       and r.status = 'draft'
       and p.role = 'client'
       and p.active
  );
$$;

-- ¿El usuario participa en la solicitud? Cliente dueño (cualquier estado) o artesano dueño del taller (nunca ve `draft`).
create function private.is_request_participant(p_request_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.service_requests r
      join public.workshops w on w.id = r.workshop_id
      join public.profiles p on p.id = (select auth.uid())
     where r.id = p_request_id
       and p.active
       and (
         (p.role = 'client' and r.client_id = p.id)
         or (p.role = 'craftsman' and w.owner_id = p.id and r.status <> 'draft')
       )
  );
$$;

-- ¿El usuario comparte una solicitud (no `draft`) con ese otro usuario? Sirve para ver el perfil de la contraparte.
create function private.shares_request_with(p_other uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.service_requests r
      join public.workshops w on w.id = r.workshop_id
      join public.profiles me on me.id = (select auth.uid())
     where r.status <> 'draft'
       and me.active
       and (
         (me.role = 'client' and r.client_id = me.id and w.owner_id = p_other)
         or (me.role = 'craftsman' and w.owner_id = me.id and r.client_id = p_other)
       )
  );
$$;

-- Privilegios por columna. `status` y `submitted_at` solo por funciones. Sin DELETE.
revoke all on public.service_requests from anon, authenticated;
grant select on public.service_requests to authenticated;
grant insert (workshop_id, service_type, description) on public.service_requests to authenticated;
grant update (description) on public.service_requests to authenticated;

-- SELECT: el cliente ve las suyas; el artesano ve las de su taller, excepto `draft`.
create policy service_requests_select_client on public.service_requests
  for select to authenticated
  using (
    client_id = (select auth.uid())
    and private.current_user_role() = 'client'
    and private.is_active()
  );

create policy service_requests_select_craftsman on public.service_requests
  for select to authenticated
  using (status <> 'draft' and private.owns_workshop(workshop_id));

-- INSERT: solo cliente activo, para sí mismo, en `draft` y hacia un taller que recibe ese servicio.
create policy service_requests_insert_client on public.service_requests
  for insert to authenticated
  with check (
    client_id = (select auth.uid())
    and status = 'draft'
    and private.current_user_role() = 'client'
    and private.is_active()
    and private.workshop_accepts_requests(workshop_id, service_type)
  );

-- UPDATE (solo la descripción): únicamente mientras es borrador.
create policy service_requests_update_draft on public.service_requests
  for update to authenticated
  using (private.owns_draft_request(id))
  with check (client_id = (select auth.uid()) and status = 'draft');

-- Perfil de la contraparte (matriz de 0001-arquitectura.md): nombre y foto para el chat.
create policy profiles_select_counterpart on public.profiles
  for select to authenticated
  using (private.shares_request_with(id));
