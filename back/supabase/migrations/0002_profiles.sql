-- 0002_profiles: perfiles, helpers de RLS, trigger de alta y set_my_role (CU-01).
-- Requiere 0001_base.

-- Perfiles: 1 a 1 con auth.users. El rol empieza en nulo y se elige una sola vez.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role public.user_role,
  full_name text not null default '' check (char_length(full_name) <= 100),
  avatar_path text check (char_length(avatar_path) <= 300),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Helpers de RLS (esquema private). security definer para leer profiles sin recursión de políticas.
create function private.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = ''
as $$
  select p.role from public.profiles p where p.id = (select auth.uid());
$$;

create function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select p.role = 'admin' and p.active from public.profiles p where p.id = (select auth.uid())),
    false
  );
$$;

create function private.is_active()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select p.active from public.profiles p where p.id = (select auth.uid())), false);
$$;

-- Alta automática del perfil. No lee user_metadata: el perfil nace sin rol y sin nombre.
create function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- Perfiles de usuarios que ya existían antes de esta migración.
insert into public.profiles (id)
select u.id from auth.users u
on conflict (id) do nothing;

-- Privilegios: authenticated lee y solo edita nombre y foto. Sin INSERT, DELETE ni UPDATE(role/active).
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (full_name, avatar_path) on public.profiles to authenticated;

-- Políticas. Sin política = denegado. El admin solo opera por funciones.
create policy profiles_select_own on public.profiles
  for select to authenticated
  using (id = (select auth.uid()));

create policy profiles_update_own on public.profiles
  for update to authenticated
  using (
    id = (select auth.uid())
    and private.is_active()
    and private.current_user_role() in ('client', 'craftsman')
  )
  with check (id = (select auth.uid()));

-- Elección de rol: una sola vez, solo client o craftsman. Los errores viajan en el mensaje.
create function public.set_my_role(p_role text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_role public.user_role;
  v_active boolean;
  v_rows integer;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  if p_role is null or p_role not in ('client', 'craftsman') then
    raise exception 'invalid_input';
  end if;

  select p.role, p.active into v_role, v_active from public.profiles p where p.id = v_uid;
  if not found then
    raise exception 'not_found';
  end if;
  if not v_active then
    raise exception 'inactive_user';
  end if;
  if v_role is not null then
    raise exception 'role_already_set';
  end if;

  update public.profiles
     set role = p_role::public.user_role
   where id = v_uid and role is null;
  get diagnostics v_rows = row_count;
  if v_rows = 0 then
    raise exception 'role_already_set';
  end if;

  return p_role;
end;
$$;

revoke execute on function public.set_my_role(text) from public, anon;
grant execute on function public.set_my_role(text) to authenticated;
