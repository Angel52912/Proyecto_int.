# Cuenta de administración

El admin es una cuenta interna del equipo (CU-08). **No se elige en el registro ni se asigna desde la app**: `set_my_role` solo acepta `client` y `craftsman`, y ningún usuario puede editar su propio `role`. Se crea a mano, una vez por proyecto de Supabase.

## Crear el admin

1. **Crear el usuario.** Dos opciones:
   - **Recomendada:** abrir la app con ese correo e iniciar sesión con el código de 6 dígitos (o Google). Se crea el usuario y su perfil sin rol. Si la pantalla pide elegir rol, se puede cerrar sin elegir.
   - Panel de Supabase → Authentication → Users → *Add user* → *Create new user* (marcar *Auto Confirm User*).
2. **Darle el rol.** En el panel de Supabase → SQL Editor (corre como `postgres`, el único que puede cambiar `role`):

   ```sql
   update public.profiles
      set role = 'admin', full_name = 'Administración MiXanab'
    where id = (select id from auth.users where email = 'admin@tu-dominio.com');
   ```

3. **Verificar.** Debe devolver una fila con `role = admin` y `active = true`:

   ```sql
   select p.id, u.email, p.role, p.active
     from public.profiles p join auth.users u on u.id = p.id
    where p.role = 'admin';
   ```

4. **Probar.** Iniciar sesión con ese correo: `getMyProfile()` devuelve `role: 'admin'` y `getDashboard()` (módulo `admin`) responde con los totales. Cualquier otro rol recibe `forbidden`.

## Reglas

- Se recomienda **al menos dos** cuentas admin: el sistema nunca deja desactivar al último admin activo (A1), y un admin no puede desactivarse a sí mismo; otro admin tiene que hacerlo.
- Nunca se usa la `service_role` desde la app ni se guarda en el repositorio. Para crear el admin basta el editor SQL del panel.
- Toda acción del admin (desactivar o reactivar usuarios, suspender o reactivar talleres, ocultar o restaurar reseñas) queda en la bitácora `admin_actions`, que no se puede editar ni borrar. Se consulta con `listActions()`.
- El admin **no** puede leer chats, fotos privadas, descripciones de solicitudes, montos ni datos privados del cliente (edad y dirección). Solo ve totales y listados de estatus y fechas.
- Para quitarle el rol a un admin (por ejemplo, si cambia de equipo): `update public.profiles set role = null where id = '<uuid>'` desde el editor SQL, y después desactivarlo desde la app si ya no debe entrar.
