-- 0022_workshop_photos_select: el artesano dueño puede leer (y por eso borrar) los archivos de la carpeta de su taller.
-- Hallazgo de las pruebas RLS contra un proyecto real: el bucket público `workshop-photos` no tenía política de SELECT
-- (se lee por URL pública y no se lista). Pero Supabase exige SELECT y DELETE para borrar un archivo: con solo DELETE,
-- `storage.remove()` no encuentra el objeto y no lo borra, sin error. `removeWorkshopPhoto` borraba la fila de
-- `workshop_photos` y dejaba el archivo huérfano y todavía público por su URL.
-- Esta política NO cambia la lectura pública por URL y solo permite listar al dueño del taller, en su propia carpeta.
-- Ningún otro usuario (ni el cliente, ni otro artesano, ni el admin) puede listar archivos de otro taller.

create policy workshop_photos_storage_select_owner on storage.objects
  for select to authenticated
  using (
    bucket_id = 'workshop-photos'
    and array_length(storage.foldername(name), 1) = 1
    and case
      when (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        then private.owns_workshop(((storage.foldername(name))[1])::uuid)
      else false
    end
  );
