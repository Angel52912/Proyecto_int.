-- 0021_grants_private: quita el EXECUTE implícito de PUBLIC (y por tanto de anon) en las funciones del esquema private.
-- Hallazgo de la auditoría (punto 7), confirmado con tests/rls/grants.test.js en un proyecto real: PostgreSQL concede
-- EXECUTE a PUBLIC por defecto a toda función nueva, y `alter default privileges in schema private ... revoke ... from
-- public` (0001) no lo quita, porque ese permiso viene del valor global y no de uno del esquema.
-- No era explotable (anon no tiene USAGE en private), pero CLAUDE.md pide que anon y public no reciban nada.
-- Las funciones públicas security definer y las políticas RLS siguen funcionando: authenticated conserva EXECUTE y
-- las funciones corren como su dueño.

-- 1. Las funciones que ya existen en private.
revoke execute on all functions in schema private from public, anon;
grant execute on all functions in schema private to authenticated;

-- 2. Las futuras: ninguna función nueva del dueño de las migraciones recibe EXECUTE para PUBLIC.
--    (Las de private reciben EXECUTE para authenticated por los privilegios por defecto de 0001.)
alter default privileges for role postgres revoke execute on functions from public;

-- 3. El trigger de alta de perfiles lo dispara el servicio de Auth al crear un usuario: se le deja el permiso de forma
--    explícita (si el rol existe, como en Supabase) para no depender del valor por defecto de PUBLIC.
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'supabase_auth_admin') then
    grant execute on function private.handle_new_user() to supabase_auth_admin;
  end if;
end;
$$;
