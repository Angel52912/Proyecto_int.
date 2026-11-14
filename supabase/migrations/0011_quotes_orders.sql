-- 0011_quotes_orders: presupuesto y orden de trabajo (CU-04). Requiere 0007, 0009 y 0010.
-- Quotes y orders solo se escriben con funciones `security definer`; el usuario solo lee.
-- Los errores viajan en el mensaje de la excepción (docs/contrato-api.md).

create table public.quotes (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.service_requests (id) on delete cascade,
  amount_mxn numeric(10, 2) not null check (amount_mxn > 0),
  delivery_date date not null,
  detail jsonb not null default '{}'::jsonb
    check (jsonb_typeof(detail) = 'object' and char_length(detail::text) <= 2000),
  status public.quote_status not null default 'sent',
  created_at timestamptz not null default now(),
  responded_at timestamptz
);

create index quotes_request_idx on public.quotes (request_id, created_at);
-- Una sola cotización vigente (`sent`) por solicitud.
create unique index quotes_one_sent on public.quotes (request_id) where status = 'sent';

alter table public.quotes enable row level security;

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null unique references public.quotes (id) on delete restrict,
  request_id uuid not null references public.service_requests (id) on delete cascade,
  client_id uuid not null references public.profiles (id) on delete cascade,
  workshop_id uuid not null references public.workshops (id) on delete cascade,
  phase smallint not null default 1 check (phase between 1 and 4),
  status public.order_status not null default 'in_progress',
  due_date date not null,
  -- Datos del PIN de entrega (CU-06): nadie los lee desde la API; solo funciones.
  delivery_pin_hash text,
  pin_attempts smallint not null default 0,
  pin_locked_until timestamptz,
  ready_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index orders_client_idx on public.orders (client_id, status);
create index orders_workshop_idx on public.orders (workshop_id, status);
create index orders_request_idx on public.orders (request_id);

create trigger orders_touch
  before update on public.orders
  for each row execute function private.touch_updated_at();

alter table public.orders enable row level security;

-- ¿El usuario participa en la orden? Cliente de la orden o artesano dueño del taller (activos y con el rol correcto).
create function private.is_order_participant(p_order_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.orders o
      join public.workshops w on w.id = o.workshop_id
      join public.profiles p on p.id = (select auth.uid())
     where o.id = p_order_id
       and p.active
       and (
         (p.role = 'client' and o.client_id = p.id)
         or (p.role = 'craftsman' and w.owner_id = p.id)
       )
  );
$$;

-- Privilegios: solo lectura. En orders no se concede el PIN (hash, intentos ni bloqueo).
revoke all on public.quotes from anon, authenticated;
revoke all on public.orders from anon, authenticated;
grant select on public.quotes to authenticated;
grant select (id, quote_id, request_id, client_id, workshop_id, phase, status, due_date, ready_at, delivered_at, created_at, updated_at)
  on public.orders to authenticated;

create policy quotes_select_participant on public.quotes
  for select to authenticated
  using (private.is_request_participant(request_id));

create policy orders_select_participant on public.orders
  for select to authenticated
  using (private.is_order_participant(id));

-- La tarjeta de presupuesto del chat apunta a su cotización.
alter table public.messages
  add constraint messages_quote_id_fkey foreign key (quote_id) references public.quotes (id) on delete set null;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.quotes, public.orders;
  end if;
end;
$$;

-- Envía el presupuesto (CU-04). Si ya había uno vigente lo rectifica (A2): el anterior queda `superseded`.
-- Solo el artesano dueño del taller, con la solicitud en `open` o `quoted`.
create function public.send_quote(
  p_request_id uuid,
  p_amount_mxn numeric,
  p_delivery_date date,
  p_detail jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_role public.user_role;
  v_active boolean;
  v_request public.service_requests;
  v_suspended boolean;
  v_detail jsonb := coalesce(p_detail, '{}'::jsonb);
  v_quote public.quotes;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  if p_request_id is null
     or p_amount_mxn is null or p_amount_mxn <= 0 or p_amount_mxn >= 100000000 or p_amount_mxn <> round(p_amount_mxn, 2)
     or p_delivery_date is null or p_delivery_date < current_date
     or jsonb_typeof(v_detail) <> 'object' or char_length(v_detail::text) > 2000 then
    raise exception 'invalid_input';
  end if;
  select p.role, p.active into v_role, v_active from public.profiles p where p.id = v_uid;
  if not found then
    raise exception 'not_found';
  end if;
  if not v_active then
    raise exception 'inactive_user';
  end if;
  if v_role is distinct from 'craftsman' then
    raise exception 'forbidden';
  end if;

  -- Bloquea la solicitud: dos envíos o un envío y una respuesta simultáneos se serializan.
  select r.* into v_request
    from public.service_requests r
    join public.workshops w on w.id = r.workshop_id
   where r.id = p_request_id and w.owner_id = v_uid and r.status <> 'draft'
   for update of r;
  if not found then
    raise exception 'not_found';
  end if;
  select w.suspended into v_suspended from public.workshops w where w.id = v_request.workshop_id;
  if v_suspended then
    raise exception 'forbidden';
  end if;
  if v_request.status not in ('open', 'quoted') then
    raise exception 'invalid_state';
  end if;

  update public.quotes
     set status = 'superseded', responded_at = now()
   where request_id = v_request.id and status = 'sent';

  insert into public.quotes (request_id, amount_mxn, delivery_date, detail)
  values (v_request.id, p_amount_mxn, p_delivery_date, v_detail)
  returning * into v_quote;

  update public.service_requests set status = 'quoted' where id = v_request.id;

  insert into public.messages (request_id, sender_id, body, kind, quote_id)
  values (v_request.id, v_uid, 'Presupuesto enviado', 'quote_card', v_quote.id);
  insert into public.notifications (user_id, type, payload)
  values (v_request.client_id, 'quote_received', jsonb_build_object('request_id', v_request.id, 'quote_id', v_quote.id));

  return jsonb_build_object(
    'id', v_quote.id,
    'request_id', v_quote.request_id,
    'amount_mxn', v_quote.amount_mxn,
    'delivery_date', v_quote.delivery_date,
    'detail', v_quote.detail,
    'status', v_quote.status,
    'created_at', v_quote.created_at,
    'responded_at', v_quote.responded_at
  );
end;
$$;

-- El cliente acepta o rechaza el presupuesto vigente.
-- Aceptar: crea la orden en la misma transacción y avisa a ambas partes.
-- Rechazar (A1): la solicitud queda en `declined` y el chat se cierra.
create function public.respond_quote(p_quote_id uuid, p_accept boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_role public.user_role;
  v_active boolean;
  v_request_id uuid;
  v_request public.service_requests;
  v_quote public.quotes;
  v_order_id uuid;
  v_owner uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  if p_quote_id is null or p_accept is null then
    raise exception 'invalid_input';
  end if;
  select p.role, p.active into v_role, v_active from public.profiles p where p.id = v_uid;
  if not found then
    raise exception 'not_found';
  end if;
  if not v_active then
    raise exception 'inactive_user';
  end if;
  if v_role is distinct from 'client' then
    raise exception 'forbidden';
  end if;

  select q.request_id into v_request_id from public.quotes q where q.id = p_quote_id;
  if not found then
    raise exception 'not_found';
  end if;
  -- Mismo orden de bloqueo que send_quote y cancel_request: primero la solicitud, luego la cotización.
  select * into v_request from public.service_requests r
   where r.id = v_request_id and r.client_id = v_uid
   for update;
  if not found then
    raise exception 'not_found';
  end if;
  select * into v_quote from public.quotes q where q.id = p_quote_id for update;
  if v_quote.status <> 'sent' or v_request.status <> 'quoted' then
    raise exception 'invalid_state';
  end if;

  select w.owner_id into v_owner from public.workshops w where w.id = v_request.workshop_id;

  if p_accept then
    update public.quotes set status = 'accepted', responded_at = now() where id = v_quote.id;
    update public.service_requests set status = 'accepted' where id = v_request.id;
    insert into public.orders (quote_id, request_id, client_id, workshop_id, due_date)
    values (v_quote.id, v_request.id, v_request.client_id, v_request.workshop_id, v_quote.delivery_date)
    returning id into v_order_id;
    insert into public.messages (request_id, sender_id, body, kind)
    values (v_request.id, null, 'Presupuesto aceptado. Orden de trabajo creada', 'system');
    insert into public.notifications (user_id, type, payload)
    values
      (v_owner, 'quote_accepted', jsonb_build_object('request_id', v_request.id, 'quote_id', v_quote.id, 'order_id', v_order_id)),
      (v_request.client_id, 'order_created', jsonb_build_object('request_id', v_request.id, 'quote_id', v_quote.id, 'order_id', v_order_id));
    return jsonb_build_object('quote_id', v_quote.id, 'status', 'accepted', 'order_id', v_order_id);
  end if;

  update public.quotes set status = 'rejected', responded_at = now() where id = v_quote.id;
  update public.service_requests set status = 'declined' where id = v_request.id;
  insert into public.messages (request_id, sender_id, body, kind)
  values (v_request.id, null, 'Presupuesto rechazado por el cliente', 'system');
  insert into public.notifications (user_id, type, payload)
  values (v_owner, 'quote_rejected', jsonb_build_object('request_id', v_request.id, 'quote_id', v_quote.id));
  return jsonb_build_object('quote_id', v_quote.id, 'status', 'rejected', 'order_id', null);
end;
$$;

-- Reemplaza cancel_request (0010): además marca el presupuesto vigente como rechazado.
create or replace function public.cancel_request(p_request_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_role public.user_role;
  v_active boolean;
  v_request public.service_requests;
  v_owner uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  if p_request_id is null then
    raise exception 'invalid_input';
  end if;
  select p.role, p.active into v_role, v_active from public.profiles p where p.id = v_uid;
  if not found then
    raise exception 'not_found';
  end if;
  if not v_active then
    raise exception 'inactive_user';
  end if;
  if v_role is distinct from 'client' then
    raise exception 'forbidden';
  end if;

  select * into v_request from public.service_requests r
   where r.id = p_request_id and r.client_id = v_uid
   for update;
  if not found then
    raise exception 'not_found';
  end if;
  if v_request.status not in ('open', 'quoted') then
    raise exception 'invalid_state';
  end if;

  update public.service_requests set status = 'cancelled' where id = v_request.id;
  update public.quotes set status = 'rejected', responded_at = now()
   where request_id = v_request.id and status = 'sent';

  select w.owner_id into v_owner from public.workshops w where w.id = v_request.workshop_id;
  insert into public.messages (request_id, sender_id, body, kind)
  values (v_request.id, null, 'Solicitud cancelada por el cliente', 'system');
  insert into public.notifications (user_id, type, payload)
  values (v_owner, 'request_cancelled', jsonb_build_object('request_id', v_request.id));

  return jsonb_build_object('id', v_request.id, 'status', 'cancelled');
end;
$$;

revoke execute on function public.send_quote(uuid, numeric, date, jsonb) from public, anon;
grant execute on function public.send_quote(uuid, numeric, date, jsonb) to authenticated;
revoke execute on function public.respond_quote(uuid, boolean) from public, anon;
grant execute on function public.respond_quote(uuid, boolean) to authenticated;
-- cancel_request conserva los grants de 0010 (create or replace no los cambia).
