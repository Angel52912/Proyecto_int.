# Configuración de Supabase (lista de verificación)

Lo que **no** vive en las migraciones y se configura a mano en el panel de cada proyecto. Hay que revisarla en cada proyecto nuevo (desarrollo, pruebas y producción) y después de cualquier cambio de plan.

## 1. Proyectos separados

| Proyecto | Para qué | Quién aplica migraciones |
|---|---|---|
| Desarrollo | El frontend contra el backend real y los datos de ejemplo (`back/supabase/seed.sql`) | Angel, con confirmación |
| Pruebas | `npm run test:rls` (cada prueba revierte su transacción) | José |
| Producción | Usuarios reales | Angel, con confirmación |

Hoy la CLI marca `mixanab` como *production*. Antes de tener usuarios reales conviene crear un proyecto aparte de desarrollo y dejar `mixanab` solo para producción. Para cada proyecto: `npx supabase link` y `npx supabase db push` (siempre con `--dry-run` primero). `back/supabase/seed.sql` **solo** se ejecuta en desarrollo y pruebas.

## 2. Authentication

- **Providers → Email:** activado. Código de 6 dígitos por correo (*Email OTP Length* = 6) y caducidad corta (*Email OTP Expiration*, por ejemplo 600 s). El flujo de la app es solo Google y código por correo: **no hay contraseñas**.
- **Providers → Google:** activado, con el *Client ID* y *Secret* de Google Cloud. En Google Cloud, agregar como URI de redirección autorizada la que muestra Supabase (`https://<proyecto>.supabase.co/auth/v1/callback`).
- **URL Configuration:**
  - *Site URL*: la URL pública de la PWA.
  - *Redirect URLs*: la misma URL y, solo en desarrollo, `http://localhost:5500`. Sin esto el regreso de Google (PKCE) falla.
- **Sign In / Providers → Allow anonymous sign-ins:** **desactivado**. Las políticas asumen que `anon` no tiene nada y que `authenticated` siempre es un usuario real.
- **Rate Limits:** revisar los límites de envío de correos y de verificación de OTP; la app ya traduce el error a `rate_limited`.
- **Email templates:** poner en español el correo del código de verificación.
- Si se configura SMTP propio (recomendado para producción: el SMTP por defecto de Supabase tiene un límite muy bajo), probar el envío de punta a punta.

## 3. Data API (PostgREST)

- **Settings → API → Exposed schemas:** solo `public`. El esquema `private` (helpers de RLS y `private.order_pins`) **no** debe estar expuesto.
- La `anon key` es pública y puede ir en `front/js/config.js`. La `service_role` **nunca** va en el frontend ni en el repositorio.

## 4. Realtime

Database → Replication → publicación `supabase_realtime`: deben estar `messages`, `notifications`, `service_requests`, `quotes`, `orders` y `order_updates` (las migraciones ya las agregan). `private.order_pins` **no** debe estar.

## 5. Storage

Cinco buckets, creados por las migraciones: `workshop-photos` (**público**), `request-photos`, `progress-photos` y `avatars` (**privados**). Los cuatro: solo jpeg, png y webp, máximo 5 MB. Verificar que ninguno de los privados esté marcado como público.

## 6. Verificaciones rápidas (SQL Editor)

Todas las tablas de `public` y `private.order_pins` con RLS activo (no debe devolver filas):

```sql
select schemaname, tablename
  from pg_tables
 where (schemaname = 'public' or (schemaname = 'private' and tablename = 'order_pins'))
   and not rowsecurity;
```

Buckets (visibilidad, tamaño y tipos):

```sql
select id, public, file_size_limit, allowed_mime_types from storage.buckets order by id;
```

`anon` no debe ejecutar ninguna función de `public` ni de `private` (no debe devolver filas):

```sql
select n.nspname, p.proname
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname in ('public', 'private')
   and has_function_privilege('anon', p.oid, 'execute');
```

Tablas en Realtime:

```sql
select tablename from pg_publication_tables where pubname = 'supabase_realtime' order by tablename;
```

Además, `npm run test:rls` (en el proyecto de pruebas) comprueba grants, políticas y funciones por rol.

## 7. Respaldo y operación

- **Respaldos:** los automáticos dependen del plan de Supabase. Antes de cada despliegue importante hacer uno manual: `npx supabase db dump --linked -f respaldo-AAAA-MM-DD.sql` (el archivo contiene datos: no se sube al repositorio).
- **Migraciones:** nunca se edita una migración ya aplicada; se crea una nueva. Aplicar siempre con `npx supabase db push --dry-run` antes.
- **Cuenta admin:** ver `docs/operacion/cuenta-admin.md`.
- **Sin `pg_cron`** (decisión D3): lo que antes sería un recordatorio programado se resuelve con notificaciones al evento y listados que la pantalla consulta (por ejemplo `listPendingReviews`).
