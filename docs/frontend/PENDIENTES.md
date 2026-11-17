# Pendientes del frontend

Estado a 16 nov 2026. El backend (CU-01 a CU-08 y las migraciones `0001` a `0020`) está implementado; `0019` y `0020` se aplican con confirmación de Angel (ver `docs/operacion/`). El contrato de cada función está en `docs/contrato-api.md`. Hoy el frontend corre **solo con el simulado** (`USAR_API_SIMULADA = true` en `js/config.js`) y nunca se ha probado contra Supabase.

Lo que ya hay: 26 rutas de cliente y artesano (inicio, mapa Leaflet, talleres, perfil del taller, solicitar cotización, chat, presupuesto, seguimiento, recoger con QR y PIN, calificar, mis pedidos; y del artesano: su taller, solicitudes, enviar presupuesto, chats, tablero, actualizar fase, verificar entrega), con estados de carga, error y vacío, y pruebas.

## 1. Bloqueantes (sin esto la app real no se puede usar)

### 1.1 Pantallas de acceso (CU-01)

> **Hecho (rama `feat/cu-01-acceso`):** rutas `/acceso`, `/acceso/entrar`, `/acceso/crear`, `/acceso/codigo`, `/acceso/rol` y `/acceso/perfil` (`js/features/auth/pages/`). Sin campo de contraseña. El destino tras entrar lo decide `destinoPorPerfil` (`js/features/auth/guardia.js`); el artesano nuevo va a `/artesano/taller` para configurar su taller. Falta probarlo contra Supabase real (1.3) y la pantalla del admin (`/admin`).
No existe ninguna. El router redirige a `RUTA_ACCESO = "/acceso"` (`js/router.js`) y esa ruta no está registrada. Según `docs/diseno.md` son 5 pantallas:

1. **Bienvenida:** Iniciar sesión, Crear cuenta y Continuar con Google (`signInWithGoogle`).
2. **Crear cuenta / entrar con correo** (`signInWithEmail`).
3. **Verificación:** código de 6 dígitos (`verifyEmailCode`) y reenvío con cuenta regresiva (`resendEmailCode`, A2).
4. **Rol:** "Soy cliente" o "Soy artesano" (`setMyRole`). Se elige **una sola vez**; si ya existe, la API lanza `role_already_set`.
5. **Completar perfil:** foto (`addAvatar`), nombre (`updateMyProfile`) y, solo para el cliente, edad y dirección (`saveMyClientPrivate`).

Reglas a respetar:
- **No hay contraseña.** El diseño dice "nombre, correo, contraseña", pero el backend solo usa Google y el código de 6 dígitos por correo. Hay que quitar el campo de contraseña del diseño.
- A1 (credenciales): mostrar el error según `error.code` (`invalid_code`, `auth_failed`, `rate_limited`, `invalid_input`).
- Después de entrar, decidir el destino con `getMyProfile()`: sin rol → pantalla 4; con rol pero sin nombre → pantalla 5; cliente → `/`; artesano → `/artesano/tablero`; admin → panel del admin.
- Google vuelve a la app por PKCE: el callback se procesa antes del router (ver `js/supabaseClient.js`).

### 1.2 Guardia por rol en el router

> **Hecho (rama `feat/cu-01-acceso`):** `soloPara(roles, render)` en `js/features/auth/guardia.js` envuelve el render de cada ruta (sin tocar `js/router.js`): sin sesión → `/acceso`, sin rol → `/acceso/rol`, otro rol → su inicio.
`js/router.js` solo tiene `requiereSesion`. Falta una opción por rol (`client`, `craftsman`, `admin`): un cliente no debe abrir `/artesano/*` y un artesano no debe abrir las rutas de cliente. La base de datos ya lo impide (RLS), pero la pantalla debe redirigir y no mostrar un error de permisos.

### 1.3 Conectar al backend real
1. Poner `SUPABASE_URL` y `SUPABASE_ANON_KEY` en `js/config.js` (clave `anon`; la `service_role` nunca va en el frontend).
2. Cambiar `USAR_API_SIMULADA` a `false`.
3. Recorrer cada flujo con datos reales y reportar los errores de integración al backend con el nombre de la función y el `error.code`.
4. Ocultar o quitar la ruta `/simulacion` (selector de rol de pruebas) cuando el modo no sea simulado.
5. Decidir qué proyecto de Supabase se usa para desarrollo y cuál para producción (hoy solo existe `mixanab`, que la CLI marca como "production"; José tiene un proyecto aparte para pruebas). Las migraciones `0001` a `0018` deben estar aplicadas en el que se use.

## 2. Funcionalidad que falta

### 2.1 Editar el perfil y mostrar fotos de perfil

> **Hecho (rama `feat/cu-01-acceso`):** en parte. "Editar perfil" (Perfil del cliente y Mi taller) reutiliza `/acceso/perfil?desde=…` con nombre, edad, dirección y foto (`addAvatar`, `removeAvatar`, comprimida); la foto propia se muestra con `getAvatarUrl`. Falta mostrar la foto de la contraparte en chats y listas.
- `perfil-cliente.js` solo muestra nombre, edad y dirección ("Sin capturar"); no hay pantalla para editarlos (`updateMyProfile`, `saveMyClientPrivate`).
- Subir, cambiar y quitar la foto de perfil: `addAvatar`, `removeAvatar`. Comprimir antes de subir (`js/lib/imagen.js`).
- Mostrar las fotos de perfil (hoy solo hay iniciales): las fotos son **privadas**, así que cada ruta (`Perfil.avatar_path`, `Contraparte.avatar_path`) se convierte con `getAvatarUrl(path)` en una URL firmada que **caduca en 1 hora**. Hay que pedirla al mostrar y de nuevo si vence. Solo la ve el propio usuario y la contraparte con una solicitud que no sea borrador.

### 2.2 Notificaciones
La campana de Inicio solo enlaza a `/pedidos`. Falta una pantalla de avisos con `listMyNotifications`, marcar una (`markNotificationRead`) o todas (`markAllNotificationsRead`) como leídas, el contador de la campana (`countUnreadNotifications`, que se mantiene al día con `subscribeToNotifications`) y la navegación según `type`. Tipos que existen: `request_received`, `quote_received`, `quote_accepted`, `quote_rejected`, `order_created`, `order_phase_changed`, `order_ready`, `order_delivered`, `review_received`, `request_cancelled`, `workshop_suspended`, `workshop_reactivated`.

### 2.3 Mensajes de error en español

> **Hecho (rama `feat/cu-01-acceso`):** agregados en `js/ui/mensajes.js`.
`js/ui/mensajes.js` no tiene mensaje para tres códigos del contrato: `invalid_code`, `auth_failed` y `role_already_set` (los usan las pantallas de acceso). Agregarlos con texto claro y corto en español, y mostrar siempre el texto con `textContent`, nunca como HTML.

### 2.4 Pantalla "Mi taller" del artesano
`docs/diseno.md` pide calificación, reseñas, pedidos entregados y porcentaje a tiempo. Hoy `taller.js` no muestra reseñas ni estadísticas. **El backend ya lo tiene (desde `0019`):** `getMyWorkshopStats()` (calificación, pedidos por estado, `on_time_pct` y solicitudes por estado) y `listMyWorkshopReviews({ limit?, offset? })` (reseñas no ocultas, sin datos de quién las escribió). Ambas están en el simulado; para datos de ejemplo usar `fijarDatosMiTallerSimulados`.

### 2.5 Búsqueda: usar los filtros del servidor
Desde `0019`, `searchWorkshops` acepta `search` (texto en nombre o colonia), `order` (`distance`, `rating` o `price`) y un `service` opcional (sin él trae los de todos los servicios, sin repetirlos). El buscador "Buscar taller o colonia", el orden de la lista y la opción "Todos" pueden pasar a usar el servidor en lugar de ordenar, filtrar y unir dos consultas en el cliente (`buscarTalleres`, `ordenarTalleres` y `filtrarPorTexto` en `js/features/map/`). Así no se pierden resultados cuando hay más de 50 talleres.

### 2.6 Panel de administración (CU-08)
Sin pantallas. El módulo `js/features/admin/` ya tiene `api.js` y `api.mock.js` listos y documentados en `docs/contrato-api.md` (sección CU-08): panel con totales, usuarios (listar, buscar, desactivar, reactivar), talleres (suspender, reactivar), reseñas (ocultar, restaurar), solicitudes y pedidos en solo lectura, y bitácora. Está pendiente que el equipo decida quién y cómo.

## 3. Cosas que el backend NO soporta (no construirlas)
- **Adjuntar fotos en el chat:** los mensajes son solo texto (máximo 2000 caracteres).
- **Pago en la app:** no hay pasarela; el diseño dice "pagas al recoger".
- **Eliminar usuarios, editar reseñas o cancelar un pedido ya aceptado:** no existen.
- **Límites nuevos (`0020`) que la pantalla debe mostrar como mensaje, no como error técnico:** 30 mensajes por minuto, 10 presupuestos por hora por solicitud y 10 borradores por cliente (códigos `rate_limited` y `limit_reached`); fotos: 6 por solicitud, 12 por taller y 40 por pedido.
- **Contraseñas:** ver 1.1.

## 4. Calidad y entrega
- **PWA:** hay íconos de 192 y 512 px (`purpose: any`); falta un ícono `maskable`. Subir `CACHE_VERSION` de `sw.js` cada vez que se agreguen archivos y añadir las pantallas nuevas a su lista. El service worker solo guarda la interfaz: nunca Supabase, mapas ni fotos.
- **Rendimiento:** cargar en menos de 2 s con 3G/4G (medir con Chrome DevTools y Lighthouse).
- **Diseño adaptable:** probar en móvil, tableta y escritorio (hay barra lateral en escritorio).
- **Tipografías:** decidir si Poppins e Inter van como archivos locales o solo fuentes del sistema (duda abierta en `CLAUDE.md`).
- **Pruebas:** agregar pruebas de las pantallas nuevas y de la guardia por rol; correr la regresión de los 8 CU y una prueba de extremo a extremo (solicitud, chat, presupuesto, seguimiento, entrega y calificación) con el backend real.
- **Documentación:** `docs/frontend/` describe el prototipo de Milton, que ya no está en el árbol de trabajo (ver `INTEGRACION.md`). Conviene actualizarla o archivarla.
- **Reglas que no se rompen:** texto siempre con `textContent` (ESLint prohíbe `innerHTML`), imágenes solo jpeg, png o webp de hasta 5 MB, interfaz en español, mobile-first.

## 5. Orden sugerido
1. Pantallas de acceso y guardia por rol (1.1 y 1.2).
2. Conectar al backend real y recorrer los flujos de cliente y artesano (1.3).
3. Perfil y fotos (2.1), notificaciones (2.2), mensajes de error (2.3), "Mi taller" (2.4) y búsqueda en el servidor (2.5).
4. Lo que decida el equipo: panel de admin (2.6).
5. Calidad: PWA, rendimiento y pruebas de extremo a extremo (sección 4).
