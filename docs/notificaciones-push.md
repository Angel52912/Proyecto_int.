# Avisos fuera de la app (notificaciones del sistema)

## Lo que ya funciona (solo front)

- **Dentro de la app:** campana, pantalla Avisos, contadores rojos en la barra y aviso flotante en vivo (Realtime sobre
  `notifications`).
- **Con la app abierta pero en segundo plano** (otra pestaña o la app minimizada): si la persona activó los avisos en
  la pantalla Avisos ("Recibe avisos en este dispositivo"), cada novedad en vivo se muestra como **aviso del sistema**.
  Al tocarlo, la app se abre en la pantalla de esa novedad.
  - Código: `front/js/ui/avisos-sistema.js` (permiso y aviso), `features/requests/insignias.js` (decide si va aviso
    del sistema o flotante) y `sw.js` (`notificationclick`).
  - El permiso se pide **solo al tocar "Activar"**, nunca al abrir la app.

**Límite:** si la app está **cerrada**, no hay JavaScript corriendo que escuche Realtime, y el aviso no llega. Para eso
hace falta **push del servidor** (abajo).

## Lo que falta para avisar con la app cerrada (backend)

Propuesta para quien tenga el backend (Angel). Antes de implementarla hay que acordarla en `docs/contrato-api.md`.

1. **Llaves VAPID** (un par por proyecto): la pública va en el front (`apis/config.js`); la privada **solo** en las
   variables de entorno de la Edge Function, nunca en el repositorio.
2. **Tabla `push_subscriptions`**: `id`, `user_id` (FK a `profiles`), `endpoint` (único), `p256dh`, `auth`,
   `created_at`. RLS: cada quien solo inserta, lee y borra las suyas. Sin acceso para `anon`.
3. **Funciones** (o `insert`/`delete` directos con RLS): `savePushSubscription({ endpoint, keys })` y
   `deletePushSubscription(endpoint)` en `apis/api-mixanab/requests/api.js` (y su versión simulada).
4. **Edge Function `enviar-push`**, disparada por un *Database Webhook* en `INSERT` de `notifications`. Lee las
   suscripciones del `user_id` del aviso y envía Web Push con este contenido (JSON):

   ```json
   { "titulo": "Te enviaron un presupuesto", "detalle": "Revísalo y decide si lo aceptas.", "ruta": "/presupuesto/<id>", "tag": "<id del aviso>" }
   ```

   Los textos y rutas son los mismos de `textoDelAviso` en `front/js/features/requests/avisos.js`. Si el servicio de
   push responde 404 o 410, la suscripción ya no sirve y se borra.

## Lo que hará el front cuando exista lo anterior

- `sw.js` ya escucha `push` y muestra el aviso con ese JSON. Al tocarlo, abre la `ruta`.
- Falta solo: al tocar "Activar", además del permiso, `registration.pushManager.subscribe({ userVisibleOnly: true,
  applicationServerKey: <VAPID pública> })` y guardar la suscripción con `savePushSubscription`. Al cerrar sesión,
  `deletePushSubscription`.

## Notas

- En iPhone, Web Push solo funciona si la app está **instalada en la pantalla de inicio** (iOS 16.4 o más nuevo).
- Los avisos no deben llevar datos personales en el texto (el aviso se ve en la pantalla bloqueada).
