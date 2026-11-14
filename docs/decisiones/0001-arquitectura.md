# 0001. Arquitectura: base de datos, seguridad y plan de trabajo

Estado: aprobada el 2026-11-12. Alcance: CU-01 a CU-08. Sin servidor propio: toda la seguridad vive en RLS y funciones SQL de Supabase.

## 1. Decisiones aprobadas

| # | Decisión |
|---|---|
| D1 | Docker solo para quien escribe migraciones y pruebas RLS (Supabase local). El resto del equipo trabaja con `api.js` simulado (`js/features/<modulo>/api.mock.js`) y `USAR_API_SIMULADA = true` en `js/config.js`. |
| D2 | Los grants del esquema `private` se verifican con una prueba RLS (ver sección 5). |
| D3 | Sin `pg_cron`, sin CI y sin typecheck por ahora. Los borradores de solicitud huérfanos se limpian a mano. |
| D4 | El service worker solo cachea la interfaz (HTML, CSS, JS, íconos). Nunca cachea Supabase, tiles del mapa ni fotos (privadas o públicas). |
| D5 | OTP de 6 dígitos y PIN de entrega de 6 dígitos. Se elimina A3 de CU-01. |
| D6 | Foto de avance obligatoria en cada cambio de fase. |
| D7 | Cancelación solo con la solicitud en `open` o `quoted`. Máximo 5 solicitudes activas por cliente. |
| D8 | Reseña sin edición ni borrado por el cliente. |
| D9 | Mapa solo con sesión iniciada y rol elegido. |
| D10 | `workshops` incluye `hours` (jsonb) y `price_from` (precio "desde", MXN). |
| D11 | Se aprueban los cambios al modelo de `requisitos.md` §3: `client_private`, `workshop_photos`, `request_photos`, `notifications` y PIN rotativo. |

Definición de "activa" (D7): solicitud en `open` o `quoted`. Los `draft`, `accepted`, `declined` y `cancelled` no cuentan. El límite se valida en `submit_request`.

## 2. Esquema

### Base común (migración `0001_base`)
- Esquemas: `public` (tablas y RPC) y `private` (helpers de RLS, no expuesto por PostgREST).
- Se revocan los privilegios por defecto de `anon`. `authenticated` recibe solo lo necesario, incluso por columna.
- Funciones: `security definer`, `search_path = ''`, nombres calificados, `execute` revocado a `public` y `anon`, concedido a `authenticated`. Cada una valida `auth.uid()`, rol y `profiles.active`.
- Extensión: `pgcrypto` (schema `extensions`).
- Helpers en `private`: `current_user_role()` (no `current_role()`, que es palabra reservada de SQL), `is_admin()`, `is_active()`, `owns_workshop(id)`, `is_request_participant(id)`, `is_order_participant(id)`, `shares_request_with(uid)`.
- Enums: `user_role` (client, craftsman, admin); `service_type` (repair, cleaning); `request_status` (draft, open, quoted, accepted, declined, cancelled); `quote_status` (sent, accepted, rejected, superseded); `order_status` (in_progress, ready, delivered, cancelled); `message_kind` (text, quote_card, system).

### Tablas
| Tabla | Campos clave |
|---|---|
| `profiles` | id (= auth.users), role (null al inicio), full_name, avatar_path, active |
| `client_private` | user_id, age, address |
| `workshops` | owner_id (único), name, address, colonia, postal_code, lat, lng, services[], hours jsonb, price_from, published, suspended, rating_avg, rating_count |
| `workshop_photos` | workshop_id, path, sort |
| `service_requests` | client_id, workshop_id, service_type, description, status |
| `request_photos` | request_id, path (prefijo = request_id) |
| `messages` | request_id, sender_id, body (1 a 2000), kind, quote_id |
| `quotes` | request_id, amount_mxn (> 0), delivery_date, detail jsonb, status |
| `orders` | quote_id (único), request_id, client_id, workshop_id, phase 1-4, status, due_date, ready_at, delivered_at |
| `private.order_pins` | order_id (PK), pin_hash, attempts, locked_until, revealed_at. Esquema `private`, RLS activo y sin grants: solo las funciones del PIN la tocan (ver sección 4) |
| `order_updates` | order_id, phase, photo_path (NOT NULL), note, corrected, created_by |
| `reviews` | order_id (único), client_id, workshop_id, rating 1-5, tags[], comment (≤ 1000), hidden |
| `notifications` | user_id, type, payload jsonb, read_at |
| `admin_actions` | admin_id, action, target_table, target_id, details jsonb, created_at |

Restricciones:
- Índice único parcial `(client_id, workshop_id)` para solicitudes en `draft`, `open` o `quoted`.
- Índice único parcial: una sola cotización `sent` por solicitud.
- Check en `workshops`: si `published`, los campos obligatorios no pueden ser nulos.
- `order_updates` y `admin_actions` son append-only (sin UPDATE ni DELETE; trigger de bloqueo en `admin_actions`).

Formato de `workshops.hours` (cierra la duda 5): `{ "mon": [{"open":"09:00","close":"18:00"}], "tue": [...], ..., "sun": [] }`. Claves `mon` a `sun`; de 0 a 2 rangos `HH:MM` (24 h) por día con `open < close`; día ausente o `[]` = cerrado. Es la hora local de Mérida (`America/Merida`, UTC-6 sin horario de verano). El rango es `[open, close)`: a la hora de cierre ya está cerrado. Para publicar se exige al menos un rango en la semana. Un horario que cruza la medianoche se captura como dos días (`22:00-23:59` y `00:00-02:00` del siguiente).

### Matriz RLS
| Tabla | client | craftsman | admin | anon |
|---|---|---|---|---|
| profiles | SELECT propio y de contrapartes; UPDATE solo `full_name` y `avatar_path` (grant por columna) | Igual | Solo funciones | Nada |
| client_private | CRUD propio | Nada | Nada | Nada |
| workshops | SELECT publicados y no suspendidos | SELECT propio; INSERT con rol craftsman; UPDATE por columnas (sin `suspended` ni `rating_*`) | Funciones | Nada |
| workshop_photos | SELECT de talleres visibles | CRUD del dueño | Funciones | Nada |
| service_requests | SELECT e INSERT propios (solo `draft`) | SELECT de su taller, excepto `draft` | Lista solo lectura por función | Nada |
| request_photos | INSERT y DELETE en `draft`; SELECT participantes | SELECT participantes | Nada | Nada |
| messages | SELECT e INSERT (`kind = text`, `sender = uid`) si participa | Igual | Nada | Nada |
| quotes, orders, order_updates | SELECT participantes; escritura solo por función | Igual | Lista sin fotos | Nada |
| reviews | SELECT no ocultas y las propias; escritura por función | SELECT no ocultas | Funciones | Nada |
| notifications | SELECT y UPDATE de `read_at` propios | Igual | Nada | Nada |
| admin_actions | Nada | Nada | Solo por función | Nada |

- Un usuario con `role` null solo ve su perfil y puede llamar a `set_my_role`.
- Realtime: `messages`, `orders`, `order_updates`, `notifications`, `service_requests` y `quotes` en la publicación. Aplica el RLS del SELECT.

### Storage
Todos los buckets: MIME jpeg, png o webp (sin SVG), máximo 5 MB. El cliente comprime antes de subir.

| Bucket | Visibilidad | Ruta | INSERT | SELECT |
|---|---|---|---|---|
| `workshop-photos` | Público | `{workshop_id}/{uuid}` | Dueño del taller | Público (sin política de listado) |
| `avatars` | Privado | `{uid}/{uuid}` | El propio usuario | Propio o contraparte con solicitud |
| `request-photos` | Privado | `{request_id}/{uuid}` | Cliente, con la solicitud en `draft` | Participantes |
| `progress-photos` | Privado | `{order_id}/{uuid}` | Artesano dueño, con pedido `in_progress` | Participantes |

El admin no tiene políticas en los buckets privados. Las políticas validan la ruta con regex UUID antes de castear.

## 3. Registro y rol
1. Un trigger en `auth.users` crea `profiles(id)` con `role = null` y `full_name` vacío. No lee `user_metadata` (ni rol ni nombre).
2. `set_my_role(p_role)` acepta solo `client` o `craftsman`; hace `update ... where id = auth.uid() and role is null`. Si afecta 0 filas lanza `role_already_set`.
3. `authenticated` no tiene `INSERT` en `profiles` ni `UPDATE(role)`.
4. El admin se crea a mano con la clave de servicio.
5. Ninguna política usa `user_metadata` ni `raw_user_meta_data`.
6. Correo ya registrado: no se distingue (se elimina A3). Se muestra un mensaje genérico ("Revisa tu correo").

## 4. Lógica sensible (RPC `security definer`)
| Regla | Función | Detalle |
|---|---|---|
| Enviar solicitud | `submit_request` | Exige al menos 1 foto y máximo 5 activas; pasa de `draft` a `open`. |
| Cancelar | `cancel_request` | Solo desde `open` o `quoted`. |
| Presupuesto | `send_quote`, `respond_quote` | `send_quote` marca los anteriores `superseded`, inserta la tarjeta en el chat y deja la solicitud en `quoted`. Al aceptar, `respond_quote` crea la orden en la misma transacción. |
| Fases | `advance_phase(order, to, photo, note, confirm)` | `select ... for update`. Solo `phase + 1`. Un salto o retroceso exige `confirm = true` y nota, y marca `corrected`. La foto es obligatoria siempre. |
| Listo | `mark_ready` | Exige fase 4. |
| PIN | `reveal_delivery_pin`, `verify_delivery_pin` | Ver abajo. |
| Búsqueda | `search_workshops`, `get_workshop_profile` | Solo cliente activo; solo talleres `published` y no `suspended`; nunca devuelven `owner_id`. Distancia con haversine (sin PostGIS) y "Abierto" con la hora de `America/Merida`. Migración `0015`. |
| Reseña | `create_review` | Cliente de la orden, orden `delivered`, `unique(order_id)`. Sin política INSERT, UPDATE ni DELETE. |
| Promedio | Trigger en `reviews` | Recalcula avg y count desde cero sobre las no ocultas. |
| Admin | `admin_*` | Validan `is_admin()` y escriben `admin_actions` en la misma transacción. No autodesactivarse; siempre queda un admin activo. |

PIN de entrega:
- El hash, los intentos y el bloqueo viven en `private.order_pins` (migración `0013`), no en `orders`: Realtime envía la fila completa a quien pase el RLS y no respeta los permisos por columna, así que cualquier dato sensible en `orders` (publicada) se filtraría.
- `reveal_delivery_pin` solo con la orden en `ready`: genera 6 dígitos con `gen_random_bytes`, guarda `crypt(pin, gen_salt('bf'))`, reinicia intentos (no levanta un bloqueo vigente) y devuelve el PIN una sola vez. Cada llamada rota el PIN.
- `verify_delivery_pin`: solo el artesano dueño, orden en `ready`. 5 intentos y bloqueo de 15 minutos.
- Un PIN incorrecto no lanza excepción (revertiría el contador). Devuelve `{ok, attempts_left, locked_until}`.
- El QR codifica `order_id:pin` y usa la misma función.

## 5. Grants del esquema `private` (D2)
Las políticas RLS llaman a funciones de `private`. Si `authenticated` no tiene `USAGE` en el esquema o `EXECUTE` en la función, toda consulta falla con `permission denied`. `0001_base` debe incluir:

1. `revoke all on schema private from public, anon;` y `grant usage on schema private to authenticated;`.
2. `alter default privileges in schema private revoke execute on functions from public;` y luego `grant execute on functions to authenticated;`.
3. `revoke execute on all functions in schema private from public, anon;` y `grant execute on all functions in schema private to authenticated;` para las ya creadas.
4. `anon` no recibe nada en `private`.

Verificación obligatoria (prueba en `tests/rls/grants.test.js`, escrita junto con `0001_base`):
- `has_schema_privilege('authenticated', 'private', 'usage')` es verdadero y el de `anon` es falso.
- `has_function_privilege('authenticated', f, 'execute')` es verdadero para cada función de `private`, y falso para `anon` y `public`.
- Un usuario `authenticated` puede hacer SELECT de su propio perfil (la política evalúa el helper sin error).

Estado actual: aún no existen migraciones, así que los grants no se pueden verificar. Quedan como requisito de `0001_base`.

## 6. Service worker (D4)
- Precachea solo la interfaz: `index.html`, `manifest.webmanifest`, `css/`, `js/` (incluye `js/vendor/`) e `icons/`.
- Ignora toda petición de otro origen (Supabase, tiles de OSM) y toda petición que no sea GET. No llama a `respondWith` en esos casos.
- Las rutas same-origin que no están en la lista van a red sin guardarse en caché.
- Las fotos nunca se guardan: ni las privadas (firmadas, de Supabase) ni las públicas.
- Al subir de versión (`CACHE_VERSION`), se borran las cachés anteriores.

## 7. Estructura y scripts
Ver `CLAUDE.md` para la estructura y comandos vigentes. Reglas:
- Cada módulo tiene `routes.js` (lista de rutas), `api.js` (único que toca Supabase), `api.mock.js` (simulado) y `view.js`. `js/router.js` solo importa los `routes.js`.
- Una hoja CSS por pantalla.
- `@supabase/supabase-js` y `leaflet` se copian a `js/vendor/` con `npm run vendor` (se ejecuta en `postinstall`). `js/vendor/` está en `.gitignore`.
- Router por hash (`#/ruta`); el callback PKCE de OAuth se procesa antes del router.
- CSP por `<meta>` en `index.html`.
- La CLI de Supabase no es dependencia: se invoca con `npx supabase` solo en los scripts `db:*`. No existe script de `db push`.

## 8. Etapas y reparto
Reglas: una rama por CU (`feat/cu-NN-...`); migraciones en orden de dependencia, con timestamp asignado al fusionar; nunca se edita una migración aplicada; cada migración pasa por `revisor-rls`.

Quienes escriben migraciones y pruebas RLS (propuesto: Dev 1 y Dev 4) usan Docker. Dev 2 y Dev 3 usan `api.mock.js`.

| Etapa | Dev 1 | Dev 2 | Dev 3 | Dev 4 |
|---|---|---|---|---|
| 0. Base | `0001_base` y CU-01 en SQL | `tokens.css`, `components.css`, router | npm, Jest, ESLint, `lib/` | Supabase local, helpers `tests/rls`, `seed.sql` |
| 1 | CU-01 UI | CU-07 | CU-03 UI | CU-02 UI |
| 2 | CU-08a (usuarios, bitácora, panel) | CU-02 backend | CU-03 backend | CU-05 UI |
| 3 | CU-08a | PWA | CU-04 | CU-05 backend |
| 4 | CU-08b (talleres y reseñas) | Notificaciones | CU-06 UI | CU-06 backend |
| 5 | Auditoría de seguridad | Rendimiento | E2E | Regresión de los 8 CU |

Etapa 0 realizada en este commit: scaffolding, scripts, Jest, ESLint, `vendor/` y service worker. Sin migraciones.

## 9. Decisiones abiertas
1. Tipografías Poppins e Inter: se usan con fallback de sistema; falta decidir si se incluyen como archivos locales (sin CDN).
2. Proveedor de tiles: OSM es aceptable para el piloto; para producción hay que cambiarlo.
3. Notificaciones: en la app por Realtime. Web Push queda fuera.
4. Distancia: haversine en SQL (sin PostGIS).
5. Horarios (`hours`): formato jsonb por día; falta definir el esquema exacto.
6. Alcance del admin (CU-08) pendiente de confirmación del equipo.

## 10. Supuestos
- Los RF, RNF y HU del equipo siguen sin estar en `requisitos.md`.
- Un artesano tiene un solo taller.
- Una orden nace de un presupuesto aceptado; no hay pago en la app.
- Cada solicitud va a un solo taller.
- El admin ve el texto de las reseñas (ya son públicas), pero no chats ni fotos privadas.
