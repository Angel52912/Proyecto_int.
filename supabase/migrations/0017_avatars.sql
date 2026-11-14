-- 0017_avatars: bucket privado de fotos de perfil (CU-01). Requiere 0002 y 0007 (private.shares_request_with).
-- Ruta en Storage: {uid}/{uuid}. Sube y borra solo el propio usuario (cliente o artesano activo); ve la foto el propio
-- usuario y la contraparte con la que comparte una solicitud. El admin, el usuario sin rol y el anónimo no tienen acceso.

-- La ruta guardada en el perfil debe ser {uid}/{uuid}: nadie apunta a un archivo de otro usuario ni a una ruta
-- arbitraria. NOT VALID: no revisa las filas que ya existían (la columna solo admitía texto libre hasta ahora).
alter table public.profiles
  add constraint profiles_avatar_path_format check (
    avatar_path is null
    or avatar_path ~ ('^' || id::text || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
  ) not valid;

-- Bucket privado: solo jpeg, png o webp, máximo 5 MB.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Políticas de Storage. La carpeta se compara como texto con el uid, o se valida con regex UUID antes de castear.
-- INSERT: en su propia carpeta, usuario activo con rol client o craftsman y como máximo 3 archivos (la api borra los
-- anteriores al cambiar de foto, así que el tope solo frena el abuso).
create policy avatars_storage_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and private.is_active()
    and private.current_user_role() in ('client', 'craftsman')
    and (
      select count(*) from storage.objects o
       where o.bucket_id = 'avatars' and (storage.foldername(o.name))[1] = (select auth.uid())::text
    ) < 3
  );

-- SELECT: la propia foto, o la de la contraparte con la que comparte una solicitud (no `draft`).
create policy avatars_storage_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'avatars'
    and (
      (
        (storage.foldername(name))[1] = (select auth.uid())::text
        and private.is_active()
        and private.current_user_role() in ('client', 'craftsman')
      )
      or case
        when (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          then private.shares_request_with(((storage.foldername(name))[1])::uuid)
        else false
      end
    )
  );

-- DELETE: solo los archivos propios.
create policy avatars_storage_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and private.is_active()
    and private.current_user_role() in ('client', 'craftsman')
  );
