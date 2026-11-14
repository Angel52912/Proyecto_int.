# Contrato de API

Acuerdo entre backend (`api.js`) y frontend (`api.mock.js`). Ambas versiones deben tener **la misma forma** de parámetros, respuesta y errores.
Si algo cambia aquí, se actualiza en el mismo commit que el cambio de código.

## Convenciones

- Cada función de `api.js` devuelve una promesa. Éxito: el valor descrito en "Respuesta". Error: lanza `ApiError` (`js/lib/apiError.js`) con `error.code` igual a uno de los códigos de la tabla de errores.
- Las pantallas importan `api` de `js/features/<modulo>/index.js`, que elige real o simulado según `USAR_API_SIMULADA`.
- Los errores de funciones SQL viajan en el mensaje de la excepción (`raise exception 'role_already_set'`) y `traducirError` los convierte en `code`.
- Excepción: las funciones que lo indiquen (p. ej. `verify_delivery_pin`) devuelven el resultado en lugar de lanzar.
- Nombres de campos en `snake_case` (igual que la base de datos). Fechas en ISO 8601; montos en MXN como número.
- El frontend nunca llama a Supabase directo: solo importa `api.js` del módulo.
- Roles: `client`, `craftsman`, `admin`, `sin rol` (sesión sin rol elegido) y `anónimo` (sin sesión).

## Plantilla por función

### `nombreFuncion(parametros)`
- **Módulo:** `js/features/<modulo>/api.js`
- **Parámetros:** `nombre: tipo` (obligatorio u opcional, restricciones).
- **Respuesta:** forma del objeto devuelto.
- **Errores:** códigos que puede lanzar.
- **Roles permitidos:** cuáles pueden llamarla.
- **Notas:** efectos secundarios, límites, tiempo real.

## Errores comunes

| Código | Significado |
|---|---|
| `not_authenticated` | No hay sesión. |
| `forbidden` | El rol o la relación con el recurso no permiten la acción. |
| `inactive_user` | `profiles.active` es falso. |
| `not_found` | El recurso no existe o no es visible para el usuario. |
| `invalid_input` | Parámetros inválidos (formato, longitud, rango). |
| `unexpected` | Error no reconocido (se traduce en `js/lib/apiError.js`). |

## CU-01. Registro, rol y perfil (módulo `auth`)

Estado: **backend listo para revisión** (migraciones `0001_base`, `0002_profiles`, `0003_client_private`; sin aplicar). `api.js` y `api.mock.js` en `js/features/auth/`.
Simulado: el código de verificación válido es `123456` (`CODIGO_SIMULADO`); `reiniciarSimulacion()` limpia el estado (solo mock, para pruebas).

Tipos: `Perfil = { id, role: 'client' | 'craftsman' | 'admin' | null, full_name: string, avatar_path: string | null, active: boolean }`.
Perfil nuevo: `role: null`, `full_name: ''`, `active: true`. El nombre no se toma de Google ni de `user_metadata`: se captura en la pantalla de perfil.

### `signInWithGoogle()`
- **Parámetros:** ninguno. **Respuesta:** `void` (redirige a Google; el callback PKCE se procesa antes del router).
- **Errores:** `auth_failed`. **Roles permitidos:** anónimo.

### `signInWithEmail(email)`
- **Parámetros:** `email: string` (formato válido).
- **Respuesta:** `{ sent: true }`. Siempre igual exista o no el correo (A3 eliminado); la pantalla muestra "Revisa tu correo".
- **Errores:** `invalid_input`, `rate_limited`, `auth_failed`. **Roles permitidos:** anónimo.
- **Notas:** envía código de 6 dígitos (D5). Requiere que la plantilla de correo de Supabase incluya `{{ .Token }}` y que el OTP sea de 6 dígitos.

### `verifyEmailCode(email, code)`
- **Parámetros:** `email: string`, `code: string` (6 dígitos).
- **Respuesta:** `{ session: { user_id: string } }`.
- **Errores:** `invalid_input` (formato), `invalid_code` (incorrecto o vencido, A1). **Roles permitidos:** anónimo.

### `resendEmailCode(email)`
- **Parámetros:** `email: string`. **Respuesta:** `{ sent: true }`.
- **Errores:** `invalid_input`, `rate_limited` (A2). **Roles permitidos:** anónimo.

### `getMyProfile()`
- **Parámetros:** ninguno. **Respuesta:** `Perfil`.
- **Errores:** `not_authenticated`, `not_found`. **Roles permitidos:** cualquiera con sesión, incluso sin rol (también desactivado).
- **Notas:** el rol viene de `profiles.role`, nunca de `user_metadata`.

### `setMyRole(role)` (RPC `set_my_role`)
- **Parámetros:** `role: 'client' | 'craftsman'`.
- **Respuesta:** `{ role }`.
- **Errores:** `role_already_set`, `invalid_input` (cualquier otro valor, incluido `admin`), `not_authenticated`, `inactive_user`, `not_found`.
- **Roles permitidos:** sin rol. Una sola vez; no se puede cambiar desde la app.

### `updateMyProfile({ full_name?, avatar_path? })`
- **Parámetros:** `full_name: string` (1 a 100, opcional), `avatar_path: string` (1 a 300, opcional). Al menos uno.
- **Respuesta:** `Perfil` actualizado.
- **Errores:** `not_authenticated`, `invalid_input`, `forbidden` (sin rol, admin o cuenta desactivada).
- **Roles permitidos:** `client`, `craftsman` activos.
- **Notas:** no puede modificar `role` ni `active` (grant por columna). La subida de foto al bucket `avatars` llega en otro CU; por ahora `avatar_path` es solo una ruta.

### `getMyClientPrivate()`
- **Parámetros:** ninguno. **Respuesta:** `{ user_id, age, address } | null` (`null` si aún no los captura o si no es cliente).
- **Errores:** `not_authenticated`. **Roles permitidos:** solo `client`; el artesano y el admin no los ven.

### `saveMyClientPrivate({ age, address })`
- **Parámetros:** `age: number` (entero 1 a 120), `address: string` (1 a 300).
- **Respuesta:** `{ user_id, age, address }`.
- **Errores:** `not_authenticated`, `invalid_input`, `forbidden` (artesano, admin, sin rol o desactivado).
- **Roles permitidos:** solo `client`, sobre sus propios datos (crea o actualiza).

### `signOut()`
- **Parámetros:** ninguno. **Respuesta:** `void`. **Roles permitidos:** cualquiera con sesión.

## CU-07. Perfil de taller (módulo `workshop`)

Estado: **backend listo para revisión** (migraciones `0004_workshops`, `0005_workshop_photos`, `0006_workshop_publish`; sin aplicar). `api.js`, `api.mock.js` y `validar.js` en `js/features/workshop/`.
Simulado: la sesión es de un artesano activo; `reiniciarSimulacion()` y `fijarSesionSimulada({ sesion, rol, activo })` solo existen en el mock (para pruebas). Las URLs de fotos son `https://simulado.local/workshop-photos/{path}`.

Código nuevo en errores comunes: `limit_reached` (se superó un límite de negocio: 10 fotos de trabajos por taller; CU-03 lo usará para las 5 solicitudes activas).

Tipos:
- `Horario = { mon?: Rango[], tue?: Rango[], wed?: Rango[], thu?: Rango[], fri?: Rango[], sat?: Rango[], sun?: Rango[] }` con `Rango = { open: "HH:MM", close: "HH:MM" }`. Formato propuesto para la duda 5: hasta 2 rangos por día, `open < close`, 24 h; día ausente o `[]` = cerrado.
- `FotoTaller = { id, path, kind: 'profile' | 'work', sort: number, url: string }` (url pública).
- `Taller = { id, owner_id, name, address, colonia, postal_code, lat, lng, services: ('repair' | 'cleaning')[], hours: Horario | null, price_from: number | null, published, suspended, rating_avg: number | null, rating_count, photos: FotoTaller[] }`. Los campos de texto, `lat`, `lng`, `hours` y `price_from` son `null` hasta que se capturan.

### `getMyWorkshop()`
- **Respuesta:** `Taller | null` (`null` si aún no lo crea o si el usuario no es artesano).
- **Errores:** `not_authenticated`. **Roles permitidos:** `craftsman` (los demás reciben `null`).

### `saveMyWorkshop(datos)`
- **Parámetros:** `datos: { name?, address?, colonia?, postal_code?, lat?, lng?, services?, hours?, price_from? }`, al menos un campo. `name` 1 a 100, `address` 1 a 300, `colonia` 1 a 100, `postal_code` 5 dígitos o `null`, `lat` y `lng` siempre juntas, `services` sin repetidos, `price_from` > 0 (MXN, 2 decimales).
- **Respuesta:** `Taller`. Crea el taller propio si no existe; si existe, actualiza solo los campos enviados. Se puede guardar incompleto (borrador).
- **Errores:** `not_authenticated`, `invalid_input` (también si deja incompleto un taller ya publicado), `forbidden` (no es artesano activo), `inactive_user` (solo mock).
- **Roles permitidos:** `craftsman` activo. No puede tocar `published`, `suspended` ni `rating_*`.

### `publishMyWorkshop()` (RPC `publish_my_workshop`)
- **Respuesta:** `{ published: boolean, missing: string[] }`. **No lanza si faltan datos** (A1): devuelve `published: false` y `missing` con los campos faltantes, entre `name`, `address`, `colonia`, `location`, `services`, `hours` (sin ningún rango), `price_from`. La foto no es obligatoria.
- **Errores:** `not_authenticated`, `inactive_user`, `forbidden` (no es artesano o el taller está suspendido), `not_found` (aún no crea el taller).
- **Roles permitidos:** `craftsman` activo. Un taller publicado y no suspendido aparece en el mapa para los clientes.

### `unpublishMyWorkshop()` (RPC `unpublish_my_workshop`)
- **Respuesta:** `{ published: false, missing: [] }`. Retira el taller del mapa sin borrar datos.
- **Errores:** `not_authenticated`, `inactive_user`, `forbidden`, `not_found`. **Roles permitidos:** `craftsman` activo.

### `addWorkshopPhoto(archivo, kind)`
- **Parámetros:** `archivo: File` (jpeg, png o webp, máximo 5 MB; el frontend comprime antes), `kind: 'profile' | 'work'`.
- **Respuesta:** `FotoTaller`. Sube al bucket público `workshop-photos` (ruta `{workshop_id}/{uuid}`) y registra la foto. La foto `profile` reemplaza a la anterior; máximo 10 fotos `work`.
- **Errores:** `not_authenticated`, `invalid_input` (tipo, tamaño o `kind`), `not_found` (sin taller), `forbidden`, `limit_reached`.
- **Roles permitidos:** `craftsman` activo, solo en su taller.

### `removeWorkshopPhoto(photoId)`
- **Parámetros:** `photoId: string`. **Respuesta:** `void` (borra el registro y el archivo).
- **Errores:** `not_authenticated`, `invalid_input`, `not_found` (no existe o no es suya), `forbidden`. **Roles permitidos:** `craftsman` dueño.

Notas de visibilidad (para CU-02): el cliente activo solo ve talleres `published` y no `suspended`, y sus fotos; el artesano solo ve el suyo; el admin no accede a estas tablas directamente (CU-08 usará funciones).
