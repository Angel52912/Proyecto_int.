-- 0004_workshops: taller del artesano (CU-07). Requiere 0002_profiles y 0003 (private.touch_updated_at).
-- Formato de `hours` (jsonb), propuesto para cerrar la decisión abierta 5:
--   { "mon": [{"open":"09:00","close":"18:00"}], "tue": [...], ..., "sun": [] }
-- Claves mon..sun; cada día es una lista de 0 a 2 rangos "HH:MM" con open < close. Día ausente o [] = cerrado.

-- Valida el formato de hours. Inmutable: se usa en un CHECK.
create function private.valid_hours(p_hours jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_day record;
  v_range jsonb;
begin
  if p_hours is null then
    return true;
  end if;
  if jsonb_typeof(p_hours) <> 'object' then
    return false;
  end if;
  for v_day in select key, value from jsonb_each(p_hours) loop
    if v_day.key not in ('mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun') then
      return false;
    end if;
    if jsonb_typeof(v_day.value) <> 'array' or jsonb_array_length(v_day.value) > 2 then
      return false;
    end if;
    for v_range in select value from jsonb_array_elements(v_day.value) loop
      if jsonb_typeof(v_range) <> 'object'
         or (select count(*) from jsonb_object_keys(v_range)) <> 2
         or jsonb_typeof(v_range -> 'open') <> 'string'
         or jsonb_typeof(v_range -> 'close') <> 'string'
         or (v_range ->> 'open') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
         or (v_range ->> 'close') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
         or (v_range ->> 'open') >= (v_range ->> 'close') then
        return false;
      end if;
    end loop;
  end loop;
  return true;
end;
$$;

create table public.workshops (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references public.profiles (id) on delete cascade,
  name text check (char_length(name) between 1 and 100),
  address text check (char_length(address) between 1 and 300),
  colonia text check (char_length(colonia) between 1 and 100),
  postal_code text check (postal_code ~ '^[0-9]{5}$'),
  lat double precision check (lat between -90 and 90),
  lng double precision check (lng between -180 and 180),
  services public.service_type[] not null default '{}',
  hours jsonb check (private.valid_hours(hours)),
  price_from numeric(10, 2) check (price_from > 0),
  published boolean not null default false,
  suspended boolean not null default false,
  rating_avg numeric(2, 1) check (rating_avg between 1 and 5),
  rating_count integer not null default 0 check (rating_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- lat y lng van juntas.
  constraint workshops_location_pair check ((lat is null) = (lng is null)),
  -- Un taller publicado tiene todos los datos obligatorios.
  constraint workshops_published_complete check (
    not published
    or (
      name is not null and address is not null and colonia is not null
      and lat is not null and lng is not null
      and cardinality(services) > 0
      and hours is not null and price_from is not null
    )
  )
);

create index workshops_visible_idx on public.workshops (colonia) where published and not suspended;

create trigger workshops_touch
  before update on public.workshops
  for each row execute function private.touch_updated_at();

alter table public.workshops enable row level security;

-- ¿El usuario es el artesano activo dueño de este taller? (helper de RLS y de Storage)
create function private.owns_workshop(p_workshop_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.workshops w
      join public.profiles p on p.id = w.owner_id
     where w.id = p_workshop_id
       and w.owner_id = (select auth.uid())
       and p.role = 'craftsman'
       and p.active
  );
$$;

-- Privilegios por columna. Sin DELETE. `published`, `suspended` y `rating_*` solo por funciones.
revoke all on public.workshops from anon, authenticated;
grant select on public.workshops to authenticated;
grant insert (owner_id, name, address, colonia, postal_code, lat, lng, services, hours, price_from)
  on public.workshops to authenticated;
grant update (name, address, colonia, postal_code, lat, lng, services, hours, price_from)
  on public.workshops to authenticated;

-- SELECT: el cliente ve los publicados y no suspendidos; el artesano ve el suyo.
create policy workshops_select_visible on public.workshops
  for select to authenticated
  using (
    published and not suspended
    and private.current_user_role() = 'client'
    and private.is_active()
  );

create policy workshops_select_own on public.workshops
  for select to authenticated
  using (owner_id = (select auth.uid()) and private.current_user_role() = 'craftsman');

create policy workshops_insert_own on public.workshops
  for insert to authenticated
  with check (
    owner_id = (select auth.uid())
    and private.current_user_role() = 'craftsman'
    and private.is_active()
  );

create policy workshops_update_own on public.workshops
  for update to authenticated
  using (
    owner_id = (select auth.uid())
    and private.current_user_role() = 'craftsman'
    and private.is_active()
  )
  with check (owner_id = (select auth.uid()));
