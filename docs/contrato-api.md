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

## CU-03. Solicitud de cotización y chat (módulos `requests` y `chat`)

Estado: **backend listo para revisión** (migraciones `0007_service_requests`, `0008_request_photos`, `0009_messages_notifications`, `0010_request_functions`; sin aplicar). `api.js`, `api.mock.js` y `validar.js` en `js/features/requests/` y `js/features/chat/`.
Simulado: ambos módulos comparten estado (`js/features/requests/simulacion.js`). La sesión por defecto es un cliente activo y hay un taller simulado publicado (`ID_TALLER_SIMULADO`, servicios `repair` y `cleaning`). Solo en el mock: `reiniciarSimulacion()`, `fijarSesionSimulada({ sesion, rol, activo })` (cambia a `craftsman` para actuar como el artesano de esa solicitud) y `fijarTallerSimulado({ published, suspended, services })`. Las URLs de fotos son `https://simulado.local/request-photos/{path}`.

Códigos nuevos en errores comunes:

| Código | Significado |
|---|---|
| `invalid_state` | La acción no aplica al estado actual (enviar algo que no es borrador, cancelar fuera de `open` o `quoted`, taller que dejó de estar disponible, ya hay una solicitud viva con ese taller). |
| `photo_required` | Se intentó enviar una solicitud sin fotos. |

Tipos:
- `Solicitud = { id, client_id, workshop_id, service_type: 'repair' | 'cleaning', description, status: 'draft' | 'open' | 'quoted' | 'accepted' | 'declined' | 'cancelled', submitted_at: string | null, created_at, photo_count: number }`.
- `FotoSolicitud = { id, path, url }` (`url` firmada, válida 1 h; el bucket es privado).
- `Contraparte = { id, full_name, avatar_path: string | null }`.
- `SolicitudDetalle = Solicitud & { photos: FotoSolicitud[], counterpart: Contraparte | null }`. `counterpart` es el artesano para el cliente (`null` si el taller ya no está publicado) y el cliente para el artesano.
- `Notificacion = { id, type: string, payload: object, read_at: string | null, created_at }`. Tipos de esta etapa: `request_received` y `request_cancelled`, ambos con `payload.request_id`.
- `Mensaje = { id, request_id, sender_id: string | null, body, kind: 'text' | 'quote_card' | 'system', quote_id: string | null, created_at }`. `sender_id` es `null` en los mensajes de sistema. `body` se muestra siempre con `textContent`, nunca como HTML.

Límites: descripción de 1 a 1000 caracteres, mensaje de 1 a 2000, máximo 5 fotos por solicitud (`limit_reached`) y máximo 5 solicitudes activas por cliente (`open` o `quoted`, se valida al enviar). Solo una solicitud viva (`draft`, `open` o `quoted`) por cliente y taller.

### `createRequestDraft({ workshop_id, service_type, description })` (módulo `requests`)
- **Parámetros:** `workshop_id: uuid`, `service_type: 'repair' | 'cleaning'`, `description: string` (1 a 1000).
- **Respuesta:** `Solicitud` en `draft`. Si ya hay un borrador para ese taller, lo reutiliza y le actualiza la descripción.
- **Errores:** `not_authenticated`, `invalid_input`, `forbidden` (no es cliente activo, o el taller no está publicado, está suspendido o no ofrece ese servicio), `invalid_state` (ya hay una solicitud `open` o `quoted` con ese taller).
- **Roles permitidos:** `client` activo.

### `addRequestPhoto(requestId, archivo)`
- **Parámetros:** `requestId: uuid`, `archivo: File` (jpeg, png o webp, máximo 5 MB; el frontend comprime antes).
- **Respuesta:** `FotoSolicitud`. Sube al bucket privado `request-photos` (ruta `{request_id}/{uuid}`) y la registra.
- **Errores:** `not_authenticated`, `invalid_input` (tipo o tamaño, A1), `forbidden` (no es una solicitud propia en `draft`), `limit_reached` (ya hay 5).
- **Roles permitidos:** `client` dueño, solo con la solicitud en `draft`.

### `removeRequestPhoto(photoId)`
- **Respuesta:** `void` (borra el registro y el archivo). **Errores:** `not_authenticated`, `invalid_input`, `not_found` (no existe, no es suya o la solicitud ya no es `draft`).
- **Roles permitidos:** `client` dueño, solo en `draft`.

### `submitRequest(requestId)` (RPC `submit_request`)
- **Respuesta:** `{ id, status: 'open' }`. Efectos: agrega al chat el mensaje de sistema "Solicitud enviada" (el chat queda abierto) y notifica `request_received` al artesano dueño del taller.
- **Errores:** `not_authenticated`, `invalid_input`, `inactive_user`, `forbidden` (no es cliente), `not_found` (no existe o no es suya), `invalid_state` (no es `draft` o el taller ya no recibe solicitudes), `photo_required`, `limit_reached` (5 activas).
- **Roles permitidos:** `client` activo dueño.

### `cancelRequest(requestId)` (RPC `cancel_request`, A2)
- **Respuesta:** `{ id, status: 'cancelled' }`. Efectos: mensaje de sistema "Solicitud cancelada por el cliente" y notificación `request_cancelled` al artesano. El chat deja de admitir mensajes.
- **Errores:** `not_authenticated`, `invalid_input`, `inactive_user`, `forbidden`, `not_found`, `invalid_state` (solo se cancela en `open` o `quoted`).
- **Roles permitidos:** `client` activo dueño. Desde la migración `0011` también marca como `rejected` el presupuesto vigente (si lo hay).

### `listMyRequests()`
- **Respuesta:** `Solicitud[]`, de la más reciente a la más antigua. El cliente ve las suyas (con borradores); el artesano ve las de su taller sin borradores. Otros roles reciben `[]`.
- **Errores:** `not_authenticated`.

### `getRequest(requestId)`
- **Respuesta:** `SolicitudDetalle`. **Errores:** `not_authenticated`, `invalid_input`, `not_found` (no existe o no participa).
- **Roles permitidos:** `client` dueño y `craftsman` del taller (nunca ve borradores). El admin no accede.

### `listMyNotifications({ unreadOnly? })`
- **Respuesta:** `Notificacion[]` propias, de la más reciente a la más antigua (máximo 50). **Errores:** `not_authenticated`.

### `markNotificationRead(notificationId)`
- **Respuesta:** `Notificacion` con `read_at`. **Errores:** `not_authenticated`, `invalid_input`, `not_found` (no existe o no es suya).

### `subscribeToNotifications(alRecibir)`
- **Parámetros:** `alRecibir: (notificacion: Notificacion) => void`. **Respuesta:** promesa de una función que cancela la suscripción.
- **Errores:** `not_authenticated`. **Notas:** Realtime (INSERT en `notifications`); solo llegan las propias.

### `listMessages(requestId, { limit?, before? })` (módulo `chat`)
- **Parámetros:** `limit: number` (1 a 100, por defecto 50), `before: string` (ISO 8601; trae los anteriores a esa fecha, para paginar hacia atrás).
- **Respuesta:** `Mensaje[]` del más antiguo al más reciente (los `limit` últimos).
- **Errores:** `not_authenticated`, `invalid_input`, `not_found` (la solicitud no existe o el usuario no participa; un chat vacío devuelve `[]`).
- **Roles permitidos:** `client` dueño y `craftsman` del taller.

### `sendMessage(requestId, body)`
- **Parámetros:** `body: string` (1 a 2000, se recorta). **Respuesta:** `Mensaje` con `kind: 'text'`; el remitente es siempre el usuario con sesión.
- **Errores:** `not_authenticated`, `invalid_input`, `forbidden` (no participa o la solicitud no admite mensajes: solo en `open`, `quoted` o `accepted`).
- **Roles permitidos:** `client` dueño y `craftsman` del taller, activos.

### `subscribeToMessages(requestId, alRecibir)`
- **Parámetros:** `alRecibir: (mensaje: Mensaje) => void`. **Respuesta:** promesa de una función que cancela la suscripción.
- **Errores:** `not_authenticated`, `invalid_input`. **Notas:** Realtime (INSERT en `messages`); recibe también los mensajes propios y los de sistema, así que la pantalla debe evitar duplicados por `id`.

## CU-04. Presupuesto y orden de trabajo (módulos `quotes` y `orders`)

Estado: **backend listo para revisión** (migración `0011_quotes_orders`, sin aplicar). `api.js`, `api.mock.js` y `validar.js` en `js/features/quotes/`; `api.js` y `api.mock.js` (solo lectura) en `js/features/orders/`.
Simulado: comparte estado con `requests` y `chat` (`js/features/requests/simulacion.js`). El artesano actúa con `fijarSesionSimulada({ rol: "craftsman" })`. La tarjeta de presupuesto aparece en `listMessages` como mensaje `kind: 'quote_card'` con `quote_id`.

Tipos:
- `Presupuesto = { id, request_id, amount_mxn: number, delivery_date: 'YYYY-MM-DD', detail: object, status: 'sent' | 'accepted' | 'rejected' | 'superseded', created_at, responded_at: string | null }`. `detail` es un objeto libre (p. ej. desglose); máximo 2000 caracteres al serializar.
- `Orden = { id, quote_id, request_id, client_id, workshop_id, phase: 1 a 4, status: 'in_progress' | 'ready' | 'delivered' | 'cancelled', due_date, ready_at, delivered_at, created_at, updated_at }`. El PIN de entrega nunca se devuelve.
- `Notificacion.type` nuevos: `quote_received` (al cliente; `request_id`, `quote_id`), `quote_accepted` (al artesano; `request_id`, `quote_id`, `order_id`), `order_created` (al cliente; mismos campos), `quote_rejected` (al artesano; `request_id`, `quote_id`).

Reglas: monto en MXN mayor que 0, máximo 2 decimales y menor a 100 000 000; fecha de entrega no anterior a hoy. Una sola cotización vigente (`sent`) por solicitud. Presupuesto reemplazado = `superseded`. Sin pago en la app.
Estados de la solicitud: `send_quote` la deja en `quoted`; aceptar la pasa a `accepted` (el chat sigue abierto); rechazar deja el presupuesto en `rejected` y la solicitud en `quoted` con el chat abierto, para que el artesano envíe otro. Las rondas de presupuesto y rechazo se repiten hasta que el cliente acepta (`accepted`) o cancela la solicitud (`cancelRequest`). `declined` no se usa en este flujo.
Sin códigos de error nuevos.

### `sendQuote(requestId, { amount_mxn, delivery_date, detail? })` (módulo `quotes`, RPC `send_quote`)
- **Parámetros:** `requestId: uuid`; `amount_mxn: number`; `delivery_date: string` (`YYYY-MM-DD`); `detail?: object`.
- **Respuesta:** `Presupuesto` en `sent`. Efectos: solicitud en `quoted`, tarjeta `quote_card` en el chat (remitente: el artesano), notificación `quote_received` al cliente. Si había uno vigente (A2, rectificar) queda `superseded`.
- **Errores:** `not_authenticated`, `invalid_input` (monto, fecha, detalle o id), `inactive_user`, `forbidden` (no es artesano, o su taller está suspendido), `not_found` (la solicitud no existe, no es de su taller o es un borrador), `invalid_state` (solo en `open` o `quoted`).
- **Roles permitidos:** `craftsman` activo dueño del taller.

### `respondQuote(quoteId, aceptar)` (módulo `quotes`, RPC `respond_quote`)
- **Parámetros:** `quoteId: uuid`; `aceptar: boolean`.
- **Respuesta:** `{ quote_id, status: 'accepted' | 'rejected', order_id: string | null }`. Aceptar crea la orden (fase 1, `in_progress`, `due_date` = fecha del presupuesto), mensaje de sistema y notifica a ambos (`quote_accepted` al artesano, `order_created` al cliente). Rechazar (A1) deja el presupuesto `rejected` (la solicitud sigue `quoted`), agrega un mensaje de sistema y notifica `quote_rejected` al artesano; `order_id` es `null`.
- **Errores:** `not_authenticated`, `invalid_input`, `inactive_user`, `forbidden` (no es cliente), `not_found` (no existe o no es de su solicitud), `invalid_state` (el presupuesto ya no está `sent` o la solicitud ya no está `quoted`).
- **Roles permitidos:** `client` activo dueño de la solicitud.

### `getQuote(quoteId)` (módulo `quotes`)
- **Respuesta:** `Presupuesto`. **Errores:** `not_authenticated`, `invalid_input`, `not_found` (no existe o no participa). **Roles permitidos:** `client` dueño y `craftsman` del taller. El admin no accede.

### `listQuotes(requestId)` (módulo `quotes`)
- **Respuesta:** `Presupuesto[]` de la solicitud, del más antiguo al más reciente (historial completo; el vigente es el de `status: 'sent'`). Devuelve `[]` si no participa.
- **Errores:** `not_authenticated`, `invalid_input`.

### `listMyOrders()` (módulo `orders`)
- **Respuesta:** `Orden[]` del cliente o del taller del artesano, de la más reciente a la más antigua. Otros roles reciben `[]`. **Errores:** `not_authenticated`.

### `getOrder(orderId)` (módulo `orders`)
- **Respuesta:** `Orden`. **Errores:** `not_authenticated`, `invalid_input`, `not_found` (no existe o no participa).
- **Notas:** CU-05 y CU-06 agregarán fases, entrega y PIN en este módulo.
