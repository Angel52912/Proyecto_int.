DOCS LEIDOS: contrato-api.md, diseno.md, requisitos.md, decisiones/*
STACK DETECTADO: JavaScript ES6+ sin framework / CSS plano (tokens.css y components.css) / router propio por hash (js/router.js) / iconos SVG propios (js/components/icon.js)

# Lógica detectada

| Fase | Pantalla | Dato / Acción | Nivel (1/2/3) | Archivo existente o mock creado |
|------|----------|---------------|---------------|----------------------------------|
| 01 | Base | Navegación y rutas del cliente | 1 | `js/router.js`, `js/features/*/routes.js` |
| 01 | Base | Iconos de la interfaz | 2 | `js/components/icon.js` (no hay librería de iconos instalada) |
| 01 | Base | Talleres de muestra para las fases 02–06 | 2 | `js/mocks/workshops.js` |
| 01 | Base | Mapa de talleres | 3 | `js/components/ui.js` (`MapBackdrop`, `MapPin`): mapa estilizado, sin proveedor real |
| 01 | Perfil (stub) | Perfil del usuario | 1 | `js/features/auth/index.js` (`getMyProfile`); el stub no lo consume todavía |
| 02 | Inicio | Nombre del usuario | 2 | `js/mocks/orders.js` (`currentUser`); en modo simulado no hay sesión |
| 02 | Inicio | Pedido en curso | 2 | `js/mocks/orders.js` (`currentOrder`) |
| 02 | Inicio | Búsqueda de talleres | 3 | El buscador navega a `/mapa`; no filtra |
| 02 | Inicio | Notificaciones | 3 | Botón sin acción |
| 02 | Inicio | Vista previa del mapa | 3 | `MapBackdrop` estilizado, sin proveedor real |
| 03 | Mapa | Mapa real y pines georreferenciados | 3 | `MapBackdrop` y `MapPin` estilizados; Leaflet está instalado pero no hay componente de mapa |
| 03 | Mapa | Selección de taller con pines y tarjetas | 1 | Estado local de `MapScreen` |
| 03 | Mapa | Filtros de chips | 3 | Solo cambia el chip activo; no filtra pines |
| 03 | Mapa | Datos de los talleres | 2 | `js/mocks/workshops.js` (`workshops`, `getWorkshopById`) |
| 04 | Lista de talleres | Talleres, tags y distancias | 2 | `js/mocks/workshops.js` |
| 04 | Lista de talleres | Orden por cercanía o calificación | 1 | Estado local; ordena el arreglo de muestra (permitido en la fase) |
| 04 | Lista de talleres | Chip Precio y filtros reales | 3 | Solo cambia el chip activo |
| 04 | Lista de talleres | Navegación al detalle | 1 | Router por hash |
| 05 | Detalle de taller | Datos del taller | 2 | `js/mocks/workshops.js` (`getWorkshopById`) |
| 05 | Detalle de taller | Etiquetas del detalle | 2 | `js/mocks/workshops.js` (`detail_tags`); el contrato no define un catálogo de etiquetas |
| 05 | Detalle de taller | Trabajos recientes | 3 | 3 `ImagePlaceholder`; el mock no tiene fotos |
| 05 | Detalle de taller | Mensaje al taller | 3 | Navega a `/chat/1042`; el chat de diseño llega en la fase 07 |
| 05 | Detalle de taller | Solicitar cotización | 1 | Navega a `/taller/:tallerId/cotizar` (fase 06) |
| 05 | Detalle de taller | Volver | 1 | `window.history.back()` |
| 06 | Solicitar cotización | Taller del encabezado | 2 | `js/mocks/workshops.js` (`getWorkshopById`) |
| 06 | Solicitar cotización | Selección de servicio y descripción | 1 | Estado local de `QuoteRequestScreen` |
| 06 | Solicitar cotización | Fotos y vista previa | 2 | `URL.createObjectURL`; la subida real es Nivel 3 |
| 06 | Solicitar cotización | Envío de la solicitud | 3 | `TODO(BACKEND)` y navegación a `/pedidos`; no se llama a `createRequestDraft`/`sendRequest` |
| 07 | Chat | Cabecera, contexto y mensajes de muestra | 2 | `js/mocks/chat.js`; `js/features/chat/api.mock.js` existe pero exige sesión y UUID |
| 07 | Chat | Envío de mensajes | 3 | `TODO(BACKEND)`; la burbuja se agrega en estado local con la hora actual |
| 07 | Chat | Adjuntar foto | 3 | Abre un `<input type="file">`; la imagen no se sube |
| 07 | Chat | Ver presupuesto | 1 | Navega a `/pedido/1042/presupuesto` (fase 08) |
| 07 | Chat | Volver | 1 | `window.history.back()` |
| 08 | Presupuesto | Taller, desglose y totales | 2 | `js/mocks/budget.js`; los importes son texto y no se calculan |
| 08 | Presupuesto | Aceptar o rechazar el presupuesto | 3 | `TODO(BACKEND)`; navega a `/pedido/1042` o `/chat/1042`; `respondQuote` existe pero exige sesión y UUID |
| 08 | Presupuesto | Volver | 1 | `window.history.back()` |

## Contradicciones encontradas

1. **Stack:** las fases suponen un framework y `src/`. El proyecto es JavaScript ES6+ sin framework, con router por hash y carpetas `js/features/`. Se respetó la estructura existente (`js/components/`, `js/mocks/`, `js/features/<modulo>/view.js`).
2. **Tokens de diseño:** la fase 01 propone valores estimados; `docs/diseno.md` define la paleta base. Se conservan los tokens existentes de `tokens.css` (Cuero, Cenote, Miel, Espresso, Hueso, Arena) y se añadieron alias y tonos de estado/mapa que la guía deja por definir.
3. **Tipografías:** la fase sugiere cargar Google Fonts; la decisión abierta de `0001-arquitectura.md` y la CSP del proyecto usan Poppins/Inter con fallback del sistema. No se añadió CDN.
4. **Mocks:** la fase pide `src/mocks/workshops.ts`; se creó `js/mocks/workshops.js` para respetar la estructura del proyecto. Los nombres de campo de contrato se conservan; `tags`, `description` y `hours_label` quedan marcados como texto de presentación.
5. **Git:** la fase pide `git add -A`; `CLAUDE.md` prohíbe ese comando. Se usa `git add` selectivo, con un solo commit por fase.
6. **Mapa real:** el proyecto incluye Leaflet, pero no existe todavía un componente de mapa. Se implementó `MapBackdrop` estilizado como Nivel 3, sin conectar proveedor.
7. **Etiquetas del taller:** la fase 05 pide en el detalle `Suelas`, `Costuras` y `Limpieza`, mientras que la fase 04 muestra en la lista `Suelas · Costuras · Cuero`. El contrato no define etiquetas; se conservó `tags` para la lista y se añadió `detail_tags` (solo presentación) para el detalle.
8. **Envío de la solicitud:** la fase 06 pide llamar a `onSubmit` si existe lógica Nivel 1. El backend de `requests` exige al menos una foto (`photo_required`) y la subida real es Nivel 3, así que el envío queda con `TODO(BACKEND)` y navega a `/pedidos`, como indica la fase.
9. **Forma de los mensajes del chat:** el diseño usa `{ from, type, text, time, amount, delivery }`, mientras que el contrato define `Mensaje = { id, request_id, sender_id, body, kind, quote_id?, created_at }`. Se conservó la forma del diseño en `js/mocks/chat.js` (solo presentación) y se documentó en el propio mock. El servicio `js/features/chat/api.mock.js` existe (Nivel 1), pero exige sesión y un UUID de solicitud; el flujo de diseño usa el id `1042` y el modo simulado no tiene sesión, así que la pantalla no lo consume todavía.
10. **Presupuesto:** los campos del diseño (`workshopName`, `rating`, `title`, `description`, `lines`, `total`, `delivery`, `time`, `notice`) son presentación; el contrato define `Presupuesto = { id, request_id, amount_mxn, delivery_date, detail, status, ... }`. El mock conserva ambos: `amount_mxn: 450` y `detail` con el desglose, además del `total` ya formateado. Aceptar/rechazar usa `TODO(BACKEND)` aunque `respondQuote` exista, porque exige sesión y un UUID y la fase indica que la respuesta real es Nivel 3.
