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
- **Parámetros:** `full_name: string` (1 a 100, opcional), `avatar_path: string` (opcional; debe ser `{tu_uid}/{uuid}` en minúsculas, la ruta de un archivo ya subido con `addAvatar`). Al menos uno. Para subir o cambiar la foto usa `addAvatar`, no este método.
- **Respuesta:** `Perfil` actualizado.
- **Errores:** `not_authenticated`, `invalid_input` (incluye una ruta que no es `{tu_uid}/{uuid}`), `forbidden` (sin rol, admin o cuenta desactivada).
- **Roles permitidos:** `client`, `craftsman` activos.
- **Notas:** no puede modificar `role` ni `active` (grant por columna). Desde `0017` la base rechaza (`invalid_input`) cualquier `avatar_path` que no sea `{uid}/{uuid}` del propio usuario.

### `addAvatar(archivo)` (bucket privado `avatars`)
- **Parámetros:** `archivo: File` (jpeg, png o webp, máximo 5 MB; se comprime antes de subir).
- **Respuesta:** `{ path, url }`: la ruta guardada en `Perfil.avatar_path` (`{uid}/{uuid}`) y una URL firmada de 1 h. Sube a `avatars/{uid}/{uuid}`, actualiza el perfil y borra la foto anterior y cualquier archivo huérfano de la carpeta (si el perfil no se actualiza, borra el archivo nuevo).
- **Errores:** `not_authenticated`, `invalid_input` (tipo o tamaño), `forbidden` (sin rol, admin o cuenta desactivada).
- **Roles permitidos:** `client`, `craftsman` activos. Máximo 3 archivos por usuario en el bucket.

### `removeAvatar()`
- **Respuesta:** `Perfil` con `avatar_path: null`; borra el archivo. No falla si no había foto. **Errores:** `not_authenticated`, `forbidden`. **Roles permitidos:** `client`, `craftsman` activos.

### `getAvatarUrl(avatarPath)`
- **Parámetros:** `avatarPath: string` (`{uid}/{uuid}`, lo trae `Perfil.avatar_path` o `Contraparte.avatar_path`). **Respuesta:** URL firmada de 1 h (`string`). Las fotos de perfil son privadas: solo las ve el propio usuario y la contraparte con la que comparte una solicitud (no `draft`); admin, sin rol y anónimo no. Hay que llamarla otra vez al caducar la URL.
- **Errores:** `not_authenticated`, `invalid_input` (ruta mal formada), `forbidden` o `not_found` (la foto no existe o no se puede ver).

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
| `photo_required` | Se intentó enviar una solicitud sin fotos, o cambiar la fase de un pedido sin foto de avance. |
| `confirmation_required` | Cambio de fase que no es `phase + 1` y falta `confirm: true` o la nota (CU-05, A1). |

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
- **Errores:** `not_authenticated`, `invalid_input`, `inactive_user`, `forbidden` (no es cliente), `not_found` (no existe o no es de su solicitud), `invalid_state` (el presupuesto ya no está `sent`, la solicitud ya no está `quoted`, o al **aceptar** el taller está suspendido o su artesano desactivado; rechazar sí se puede).
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
- **Notas:** entrega y PIN están en la sección CU-06.

## CU-05. Fases del pedido y fotos de avance (módulo `orders`)

Estado: **backend listo para revisión** (migración `0012_order_phases`, sin aplicar). `api.js` y `api.mock.js` en `js/features/orders/`. Simulado: comparte estado con `requests`; el artesano actúa con `fijarSesionSimulada({ rol: "craftsman" })`.

Tipos:
- `Avance = { id, order_id, phase: 1 a 4, photo_path, note: string | null, corrected: boolean, created_by, created_at }`; `AvanceConFoto = Avance & { url }` (URL firmada de 1 h; el bucket `progress-photos` es privado).
- Fases: 1 Inspección, 2 Desinfección/pretratamiento, 3 Limpieza/reparación, 4 Secado/detallado. La barra de progreso se calcula con `Orden.phase` (`phase / 4`).
- `Notificacion.type` nuevos (ambos al cliente): `order_phase_changed` (`order_id`, `request_id`, `phase`, `corrected`) y `order_ready` (`order_id`, `request_id`). Al marcar listo se agrega además un mensaje de sistema en el chat.
- Código de error nuevo: `confirmation_required` (el cambio es un salto o un retroceso y falta `confirm: true` o la nota).

### `advanceOrderPhase(orderId, { phase, photo, note?, confirm? })` (RPC `advance_phase`)
- **Parámetros:** `phase: 1 a 4`; `photo: File` (jpeg, png o webp, máximo 5 MB; **obligatoria siempre**); `note?: string` (máximo 500); `confirm?: boolean`. La api sube la foto a `progress-photos/{order_id}/{uuid}` y llama a la función; si falla, borra el archivo.
- **Respuesta:** `{ order_id, phase, status, update: Avance }`. Efectos: actualiza `phase`, agrega el avance (append-only) y notifica `order_phase_changed` al cliente.
- **Reglas:** solo `phase + 1` sin más trámite. Cualquier otra fase (salto o retroceso, A1) exige `confirm: true` y `note`, y el avance queda `corrected: true`. Misma fase que la actual = `invalid_input`.
- **Errores:** `not_authenticated`, `invalid_input` (fase, nota, tipo o tamaño de la foto, ruta), `photo_required` (sin foto o el archivo no llegó a Storage), `inactive_user`, `forbidden` (no es artesano, o su taller está suspendido), `not_found` (la orden no existe o no es de su taller), `invalid_state` (la orden no está `in_progress`), `confirmation_required`.
- **Roles permitidos:** `craftsman` activo dueño del taller.

### `markOrderReady(orderId)` (RPC `mark_ready`)
- **Respuesta:** `{ order_id, status: 'ready', phase: 4, ready_at }`. Notifica `order_ready` al cliente y agrega un mensaje de sistema al chat. No genera el PIN (CU-06).
- **Errores:** `not_authenticated`, `invalid_input`, `inactive_user`, `forbidden`, `not_found`, `invalid_state` (no está `in_progress` o no está en la fase 4). **Roles permitidos:** `craftsman` activo dueño del taller.

### `listOrderUpdates(orderId)`
- **Respuesta:** `AvanceConFoto[]` del más antiguo al más reciente. Devuelve `[]` si no participa. **Errores:** `not_authenticated`, `invalid_input`. **Roles permitidos:** `client` dueño y `craftsman` del taller; el admin no accede.

### `subscribeToOrderUpdates(orderId, alRecibir)`
- **Parámetros:** `alRecibir: (avance: Avance) => void`. **Respuesta:** promesa de una función que cancela la suscripción. **Errores:** `not_authenticated`, `invalid_input`.
- **Notas:** Realtime (INSERT en `order_updates`; trae `phase`, así que sirve para la barra de progreso). El aviso de "listo" llega por la notificación `order_ready` (`subscribeToNotifications`). No se escucha `orders` directamente porque Realtime no respeta los permisos por columna.

## CU-06. Entrega con PIN y calificación (módulo `orders`)

Estado: **backend listo para revisión** (migraciones `0013_order_pins` y `0014_delivery_reviews`, sin aplicar). `api.js`, `api.mock.js` y `validar.js` en `js/features/orders/`. Simulado: comparte estado con `requests`; el cliente es la sesión por defecto y el artesano actúa con `fijarSesionSimulada({ rol: "craftsman" })`.

Tipos:
- `PinEntrega = { order_id, pin: string }` (6 dígitos). `ResultadoPin = { ok: boolean, attempts_left: 0 a 5, locked_until: string | null, status }`.
- `Resena = { id, order_id, workshop_id, rating: 1 a 5, tags: string[], comment: string | null, hidden: boolean, created_at }`.
- `Notificacion.type` nuevos: `order_delivered` (al cliente; `order_id`, `request_id`, `review_pending: true`) y `review_received` (al artesano; `order_id`, `review_id`, `rating`). Al entregar se agrega además un mensaje de sistema en el chat.
- El PIN no está en `orders` ni en ninguna tabla de la API: vive en `private.order_pins` y solo lo tocan las funciones.
- QR: codifica `${order_id}:${pin}`. `verifyDeliveryPin` acepta el texto del QR o solo el PIN.

### `revealDeliveryPin(orderId)` (RPC `reveal_delivery_pin`)
- **Respuesta:** `PinEntrega`. Solo con el pedido `ready`. **Cada llamada rota el PIN** (el anterior deja de servir) y reinicia los intentos, pero no levanta un bloqueo vigente. El PIN se devuelve solo aquí; no se puede volver a leer.
- **Errores:** `not_authenticated`, `invalid_input`, `inactive_user`, `forbidden` (no es cliente), `not_found` (no existe o no es suyo), `invalid_state` (el pedido no está `ready`). **Roles permitidos:** `client` activo dueño del pedido.

### `verifyDeliveryPin(orderId, codigo)` (RPC `verify_delivery_pin`)
- **Parámetros:** `codigo: string`, `123456` o `order_id:123456` (QR de este mismo pedido).
- **Respuesta:** `ResultadoPin`. **Un PIN incorrecto NO lanza**: devuelve `{ ok: false, attempts_left, locked_until }`. A los 5 intentos fallidos el pedido se bloquea 15 minutos: `{ ok: false, attempts_left: 0, locked_until }` (también si se envía el PIN correcto durante el bloqueo). Si `ok` es `true` el pedido queda `delivered` (`delivered_at`), se agrega un mensaje de sistema y se notifica `order_delivered` al cliente.
- **A1 (rechazar código inválido):** un código mal formado (no son 6 dígitos, o el QR es de otro pedido) lanza `invalid_input` y **no** cuenta como intento. Un PIN bien formado pero equivocado devuelve `ok: false`.
- **Errores:** `not_authenticated`, `invalid_input`, `inactive_user`, `forbidden` (no es artesano, o su taller está suspendido), `not_found` (no existe o no es de su taller), `invalid_state` (el pedido no está `ready`, o el cliente aún no generó el PIN). **Roles permitidos:** `craftsman` activo dueño del taller.

### `createReview(orderId, { rating, comment?, tags? })` (RPC `create_review`)
- **Parámetros:** `rating: 1 a 5` (entero); `comment?: string` (máximo 1000, se recorta; vacío = sin comentario); `tags?: string[]` (máximo 5, de 1 a 30 caracteres cada una).
- **Respuesta:** `Resena`. Recalcula `rating_avg` (1 decimal) y `rating_count` del taller sobre las reseñas no ocultas y notifica `review_received` al artesano. **Sin edición** posterior.
- **Errores:** `not_authenticated`, `invalid_input`, `inactive_user`, `forbidden` (no es cliente), `not_found` (no existe o no es suyo), `invalid_state` (el pedido no está `delivered` o ya tiene reseña). **Roles permitidos:** `client` activo dueño del pedido.

### `getOrderReview(orderId)`
- **Visibilidad (desde `0018`):** la API ya no devuelve `client_id` de las reseñas. Ve una reseña su autor (aunque esté oculta), cualquier cliente o artesano activo si no está oculta y el taller es visible (publicado, no suspendido y con dueño activo), y el artesano dueño del taller si no está oculta.
- **Respuesta:** `Resena | null`. Ven la reseña los clientes y artesanos activos si no está oculta; el autor la ve aunque esté oculta. Admin, sin rol e inactivos reciben `null`. **Errores:** `not_authenticated`, `invalid_input`.

### `listPendingReviews()` (A2)
- **Respuesta:** `Orden[]` entregadas del cliente sin calificación, de la más reciente a la más antigua. Otros roles reciben `[]`. **Errores:** `not_authenticated`.
- **Notas:** sustituye al recordatorio programado (no hay `pg_cron`): la pantalla la consulta al abrir y muestra el aviso; además llega la notificación `order_delivered` al entregar.

## CU-02. Búsqueda de talleres en el mapa (módulo `map`)

Estado: **backend listo para revisión** (migración `0015_workshop_search`, sin aplicar). `api.js`, `api.mock.js` y `validar.js` en `js/features/map/`. Simulado: 5 talleres de muestra en Mérida (uno suspendido, otro sin calificación, uno siempre abierto y otro siempre cerrado); la sesión es la compartida de `requests` (cliente por defecto). Pruebas: `reiniciarSimulacion()`, `fijarTalleresSimulados(lista)` y `fijarSesionSimulada(...)`.

Solo el **cliente activo** busca y ve perfiles. Artesano, admin y usuario sin rol reciben `forbidden`. Solo aparecen talleres publicados y no suspendidos; nunca se devuelve `owner_id`, `published` ni `suspended`.

Formato de `hours` (duda 5 cerrada): `{ mon?: Rango[], ..., sun?: Rango[] }`, `Rango = { open: "HH:MM", close: "HH:MM" }`, hasta 2 rangos por día, `open < close`, hora local de Mérida (`America/Merida`). Día ausente o `[]` = cerrado. El rango es `[open, close)`: a la hora de cierre ya está cerrado. Un horario que cruza la medianoche se captura en dos días.

Tipos:
- `TallerBase = { id, name, address, colonia, postal_code: string | null, lat, lng, services: ('repair' | 'cleaning')[], hours: Horario, price_from: number, rating_avg: number | null, rating_count, distance_km: number | null, is_open: boolean }`. `distance_km` (2 decimales) es `null` si no se envió ubicación.
- `ResultadoBusqueda = TallerBase & { profile_photo_url: string | null }`.
- `PerfilTaller = TallerBase & { photos: { id, path, kind: 'profile' | 'work', sort, url }[] }`. Las fotos del taller son públicas; la de perfil va primero y luego los trabajos, del más reciente al más antiguo.

### `searchWorkshops({ service, lat?, lng?, max_distance_km?, colonia?, postal_code?, min_rating?, open_now?, max_price?, limit?, offset? })` (RPC `search_workshops`)
- **Parámetros:** `service: 'repair' | 'cleaning'` (obligatorio, paso 1 del CU). `lat` y `lng` van juntas (ubicación del cliente). `max_distance_km` (> 0 y máximo 500) **exige ubicación**. `colonia`: subcadena sin distinguir mayúsculas (máximo 100; vacío = sin filtro). `postal_code`: 5 dígitos. `min_rating`: 1 a 5 (excluye talleres sin calificación). `open_now: boolean`: solo los abiertos ahora. `max_price`: precio "desde" máximo (MXN). `limit`: 1 a 100 (50 por defecto). `offset` >= 0.
- **Respuesta:** `ResultadoBusqueda[]`. Con ubicación va del más cercano al más lejano; sin ella (A1: el cliente escribe colonia o C.P.) va por calificación, luego por número de reseñas y nombre.
- **A2 (sin resultados):** devuelve `[]`, no lanza; la pantalla muestra el aviso.
- **Errores:** `not_authenticated`, `invalid_input` (cualquier parámetro fuera de rango, ubicación incompleta o `max_distance_km` sin ubicación), `inactive_user`, `forbidden` (no es cliente). **Roles permitidos:** `client` activo.

### `getWorkshopProfile(workshopId, ubicacion?)` (RPC `get_workshop_profile`)
- **Parámetros:** `workshopId: uuid`; `ubicacion?: { lat, lng }` solo para calcular `distance_km`.
- **Respuesta:** `PerfilTaller` (calificación, servicios, horario, precio "desde", `is_open` y fotos de trabajos).
- **Errores:** `not_authenticated`, `invalid_input`, `inactive_user`, `forbidden` (no es cliente), `not_found` (no existe, no está publicado o está suspendido: no se distingue). **Roles permitidos:** `client` activo.

## CU-08. Administración de la plataforma (módulo `admin`)

Estado: **backend listo para revisión** (migración `0016_admin`, sin aplicar). `api.js`, `api.mock.js` y `validar.js` en `js/features/admin/`. Simulado: 7 usuarios (2 admin, 2 clientes, 2 artesanos, 1 sin rol), 3 talleres, 3 reseñas, 4 solicitudes y 3 pedidos. Para actuar como admin: `fijarSesionSimulada({ rol: "admin" })` (el `reiniciarSimulacion()` del módulo ya lo deja así).

**Acceso:** el admin es una cuenta interna creada a mano con la clave de servicio (no se elige en el registro). Inicia sesión con el acceso normal y `getMyProfile()` devuelve `role: 'admin'`; la pantalla del panel solo se muestra con ese rol. **Todas** las funciones exigen un admin activo: cliente, artesano, sin rol y admin inactivo reciben `forbidden` o `inactive_user`.

**Qué NO ve el admin:** el contenido del chat, las fotos de solicitudes y de avance, la descripción de las solicitudes, los montos de los presupuestos, el PIN de entrega ni los datos privados del cliente (edad, dirección). No lee tablas: solo estas funciones.

Convenciones:
- Las listas devuelven `{ total, items }` (`total` = filas que cumplen los filtros, sin paginar). `limit` 1 a 100 (50 por defecto), `offset` >= 0. Orden: de la más reciente a la más antigua. `search` es una subcadena sin distinguir mayúsculas (máximo 100).
- Las acciones aceptan `reason` opcional (máximo 300). Queda en la bitácora; **la pantalla debe mostrarlo con `textContent`** (es texto libre).
- Se registran en la bitácora las acciones que **cambian datos** (desactivar/reactivar usuario, suspender/reactivar taller, ocultar/restaurar reseña), en la misma transacción. Consultar listas y el panel no genera entradas. La bitácora es append-only.
- Un cambio al mismo valor que ya tiene lanza `invalid_state`.
- Desactivar un usuario (`active = false`) le impide usar las funciones de la app, pero **no cierra su sesión ni cambia sus solicitudes o pedidos abiertos**; los usuarios no se eliminan. Si es un artesano, su taller **deja de aparecer en el mapa, en el perfil y en nuevas solicitudes** (desde `0018`) hasta que se reactive; no cambia `published` ni `suspended`.
- Sin códigos de error nuevos.

Tipos: `Panel`, `UsuarioAdmin = { id, role, full_name, email, active, created_at }` (el correo solo sale en esta lista), `TallerAdmin = { id, owner_id, owner_name, name, colonia, services, published, suspended, rating_avg, rating_count, created_at }`, `ResenaAdmin = { id, order_id, workshop_id, workshop_name, client_id, rating, tags, comment, hidden, created_at }`, `SolicitudAdmin = { id, client_id, workshop_id, workshop_name, service_type, status, submitted_at, created_at, updated_at }`, `PedidoAdmin = { id, request_id, client_id, workshop_id, workshop_name, phase, status, due_date, ready_at, delivered_at, created_at, updated_at }`, `AccionAdmin = { id, admin_id, admin_name, action, target_table, target_id, details, created_at }`.
`Notificacion.type` nuevos (al dueño del taller): `workshop_suspended` y `workshop_reactivated` (`workshop_id`; no incluyen el motivo).
Acciones de la bitácora (`action`): `user_deactivated`, `user_reactivated`, `workshop_suspended`, `workshop_reactivated`, `review_hidden`, `review_restored`.

### `getDashboard()` (RPC `admin_dashboard`)
- **Respuesta:** `{ users: { total, active, clients, craftsmen, admins, without_role }, workshops: { total, published, suspended }, requests: { total, open, quoted, accepted, cancelled }, orders: { total, in_progress, ready, delivered, cancelled }, reviews: { count, rating_avg: number | null } }`. Las solicitudes no cuentan los borradores; `published` cuenta los visibles en el mapa (publicados y no suspendidos); `reviews` solo cuenta las no ocultas.

### `listUsers({ search?, role?, active?, limit?, offset? })` (RPC `admin_list_users`)
- **Respuesta:** `{ total, items: UsuarioAdmin[] }`. `search` busca en nombre y correo. `role`: `client`, `craftsman` o `admin`.

### `setUserActive(userId, active, reason?)` (RPC `admin_set_user_active`)
- **Respuesta:** `{ id, active }`. Efecto: cambia `profiles.active` y registra `user_deactivated` o `user_reactivated`.
- **A1:** el admin no puede desactivarse a sí mismo (`forbidden`) y siempre debe quedar al menos un admin activo (`invalid_state`). Las filas de admin se bloquean en orden estable, así que dos admins no pueden desactivarse mutuamente a la vez.
- **Errores:** `not_authenticated`, `invalid_input`, `inactive_user`, `forbidden` (no es admin, o intenta desactivarse a sí mismo), `not_found`, `invalid_state` (ya tenía ese valor, o dejaría sin admin activo).

### `listWorkshops({ search?, published?, suspended?, limit?, offset? })` (RPC `admin_list_workshops`)
- **Respuesta:** `{ total, items: TallerAdmin[] }`. `search` busca en nombre del taller, colonia y nombre del dueño.

### `setWorkshopSuspended(workshopId, suspended, reason?)` (RPC `admin_set_workshop_suspended`)
- **Respuesta:** `{ id, suspended }`. Suspender saca al taller del mapa y no recibe solicitudes ni presupuestos (despublicar efectivo; `published` no cambia, así que al reactivar vuelve a aparecer). Notifica al dueño.
- **Errores:** `not_authenticated`, `invalid_input`, `inactive_user`, `forbidden`, `not_found`, `invalid_state`.

### `listReviews({ workshop_id?, hidden?, limit?, offset? })` (RPC `admin_list_reviews`)
- **Respuesta:** `{ total, items: ResenaAdmin[] }` (incluye el comentario, para moderar).

### `setReviewHidden(reviewId, hidden, reason?)` (RPC `admin_set_review_hidden`)
- **Respuesta:** `{ id, hidden, workshop_id, rating_avg, rating_count }` con el promedio del taller ya recalculado sobre las reseñas no ocultas (`rating_avg` es `null` si no queda ninguna). Una reseña oculta solo la ve su autor.
- **Errores:** `not_authenticated`, `invalid_input`, `inactive_user`, `forbidden`, `not_found`, `invalid_state`.

### `listRequests({ status?, limit?, offset? })` (RPC `admin_list_requests`)
- **Respuesta:** `{ total, items: SolicitudAdmin[] }`, solo lectura. `status`: `open`, `quoted`, `accepted`, `declined` o `cancelled` (`draft` es `invalid_input`: los borradores no se listan).

### `listOrders({ status?, limit?, offset? })` (RPC `admin_list_orders`)
- **Respuesta:** `{ total, items: PedidoAdmin[] }`, solo lectura. `status`: `in_progress`, `ready`, `delivered` o `cancelled`.

### `listActions({ admin_id?, action?, limit?, offset? })` (RPC `admin_list_actions`)
- **Respuesta:** `{ total, items: AccionAdmin[] }`. `details` trae datos de contexto (p. ej. `reason`, `previous_active`, `workshop_id`, `rating`). Consultarla no genera otra entrada.

**Errores comunes de las funciones de lista y panel:** `not_authenticated`, `invalid_input` (filtros, paginación o ids), `inactive_user`, `forbidden`. **Roles permitidos:** `admin` activo.
