# Contrato de API

Acuerdo entre backend (`api.js`) y frontend (`api.mock.js`). Ambas versiones deben tener **la misma forma** de parámetros, respuesta y errores.
Si algo cambia aquí, se actualiza en el mismo commit que el cambio de código.

## Convenciones

- Cada función de `api.js` devuelve una promesa. Éxito: el valor descrito en "Respuesta". Error: lanza `Error` con `error.code` igual a uno de los códigos de la tabla de errores.
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

## CU-01. Registro, rol y perfil (módulo `auth`)

Fuente: `docs/decisiones/0001-arquitectura.md` §3. Estado: **propuesto**, pendiente de implementar. Los nombres de funciones de sesión son de Supabase Auth; confirmar al implementar.

### `signInWithGoogle()`
- **Parámetros:** ninguno.
- **Respuesta:** `void` (redirige a Google; el callback PKCE se procesa antes del router).
- **Errores:** `auth_failed`.
- **Roles permitidos:** anónimo.

### `signInWithEmail(email)`
- **Parámetros:** `email: string` (formato válido).
- **Respuesta:** `{ sent: true }`. Siempre igual exista o no el correo (no se distingue, A3 eliminado). Mensaje en pantalla: "Revisa tu correo".
- **Errores:** `invalid_input`, `rate_limited`.
- **Roles permitidos:** anónimo.
- **Notas:** envía código de 6 dígitos (D5).

### `verifyEmailCode(email, code)`
- **Parámetros:** `email: string`, `code: string` (6 dígitos).
- **Respuesta:** `{ session: { user_id: string } }`.
- **Errores:** `invalid_code` (A1), `invalid_input`.
- **Roles permitidos:** anónimo.

### `resendEmailCode(email)`
- **Parámetros:** `email: string`.
- **Respuesta:** `{ sent: true }`.
- **Errores:** `rate_limited` (A2), `invalid_input`.
- **Roles permitidos:** anónimo.

### `getMyProfile()`
- **Parámetros:** ninguno.
- **Respuesta:** `{ id, role: 'client' | 'craftsman' | 'admin' | null, full_name, avatar_path, active }`.
- **Errores:** `not_authenticated`.
- **Roles permitidos:** cualquiera con sesión, incluso sin rol.
- **Notas:** el rol viene de `profiles.role`, nunca de `user_metadata`.

### `setMyRole(role)` (RPC `set_my_role`)
- **Parámetros:** `role: 'client' | 'craftsman'`.
- **Respuesta:** `{ role }`.
- **Errores:** `role_already_set`, `invalid_input` (cualquier otro valor, incluido `admin`), `not_authenticated`.
- **Roles permitidos:** sin rol. Una sola vez; no se puede cambiar desde la app.

### `updateMyProfile({ full_name, avatar_path })`
- **Parámetros:** `full_name: string` (opcional), `avatar_path: string` (opcional, ruta en el bucket `avatars`).
- **Respuesta:** el perfil actualizado (misma forma que `getMyProfile`).
- **Errores:** `not_authenticated`, `invalid_input`.
- **Roles permitidos:** `client`, `craftsman`.
- **Notas:** no puede modificar `role` ni `active` (grant por columna).

### `getMyClientPrivate()` / `saveMyClientPrivate({ age, address })`
- **Parámetros (guardar):** `age: number` (entero positivo), `address: string`.
- **Respuesta:** `{ user_id, age, address }`.
- **Errores:** `forbidden` (artesano o admin), `invalid_input`.
- **Roles permitidos:** solo `client`, sobre sus propios datos. El artesano no los ve.

### `signOut()`
- **Parámetros:** ninguno. **Respuesta:** `void`. **Roles permitidos:** cualquiera con sesión.

Errores propios de CU-01: `auth_failed`, `invalid_code`, `rate_limited`, `role_already_set`.
