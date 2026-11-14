-- 0003_client_private: datos personales del cliente (edad y dirección) para CU-01.
-- Requiere 0002_profiles. El artesano y el admin no tienen acceso.

create table public.client_private (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  age integer check (age between 1 and 120),
  address text check (char_length(address) between 1 and 300),
  updated_at timestamptz not null default now()
);

alter table public.client_private enable row level security;

-- CRUD propio por columna; solo el cliente activo.
revoke all on public.client_private from anon, authenticated;
grant select, delete on public.client_private to authenticated;
grant insert (user_id, age, address) on public.client_private to authenticated;
grant update (age, address) on public.client_private to authenticated;

create policy client_private_select_own on public.client_private
  for select to authenticated
  using (user_id = (select auth.uid()) and private.current_user_role() = 'client');

create policy client_private_insert_own on public.client_private
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and private.is_active()
    and private.current_user_role() = 'client'
  );

create policy client_private_update_own on public.client_private
  for update to authenticated
  using (
    user_id = (select auth.uid())
    and private.is_active()
    and private.current_user_role() = 'client'
  )
  with check (user_id = (select auth.uid()));

create policy client_private_delete_own on public.client_private
  for delete to authenticated
  using (user_id = (select auth.uid()) and private.current_user_role() = 'client');

-- Mantiene updated_at sin confiar en el cliente.
create function private.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger client_private_touch
  before update on public.client_private
  for each row execute function private.touch_updated_at();
