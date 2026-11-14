-- 0009_messages_notifications: chat de la solicitud y avisos en la app (CU-03). Requiere 0007.
-- Los mensajes de usuario son `text`; `system` y `quote_card` solo los crean funciones.
-- `quote_id` queda sin llave foránea hasta que CU-04 cree `quotes` (ahí se agrega).

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.service_requests (id) on delete cascade,
  sender_id uuid default auth.uid() references public.profiles (id) on delete set null,
  body text not null check (char_length(body) between 1 and 2000),
  kind public.message_kind not null default 'text',
  quote_id uuid,
  created_at timestamptz not null default now(),
  -- Solo los mensajes de sistema pueden carecer de remitente.
  constraint messages_sender_required check (kind = 'system' or sender_id is not null)
);

create index messages_request_idx on public.messages (request_id, created_at);

alter table public.messages enable row level security;

-- ¿La solicitud admite mensajes? Abierta, cotizada o aceptada (no `draft`, `declined` ni `cancelled`).
create function private.request_allows_chat(p_request_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.service_requests r
     where r.id = p_request_id
       and r.status in ('open', 'quoted', 'accepted')
  );
$$;

-- Privilegios: el remitente sale de auth.uid() (default) y `kind` queda en `text`. Sin UPDATE ni DELETE.
revoke all on public.messages from anon, authenticated;
grant select on public.messages to authenticated;
grant insert (request_id, body) on public.messages to authenticated;

create policy messages_select_participant on public.messages
  for select to authenticated
  using (private.is_request_participant(request_id));

create policy messages_insert_participant on public.messages
  for insert to authenticated
  with check (
    sender_id = (select auth.uid())
    and kind = 'text'
    and private.is_request_participant(request_id)
    and private.request_allows_chat(request_id)
  );

-- Notificaciones en la app (Realtime). Las crean las funciones; el usuario solo las lee y marca como leídas.
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  type text not null check (char_length(type) between 1 and 50),
  payload jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_user_idx on public.notifications (user_id, created_at desc);

alter table public.notifications enable row level security;

revoke all on public.notifications from anon, authenticated;
grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;

create policy notifications_select_own on public.notifications
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy notifications_update_own on public.notifications
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Realtime: aplica el RLS del SELECT. quotes, orders y order_updates se agregan en sus CU.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.messages, public.notifications, public.service_requests;
  end if;
end;
$$;
