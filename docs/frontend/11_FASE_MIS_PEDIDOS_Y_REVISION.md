# FASE 11 / 11 — MIS PEDIDOS + REVISIÓN FINAL (`MyOrdersScreen`, ruta `/pedidos`)

> **DOCS EXISTENTES:** antes de empezar relee `docs/contrato-api.md`, `docs/diseno.md`, `docs/requisitos.md` y `docs/decisiones/*`. Respétalos (ver sección 1.1 de `00_LEEME_PRIMERO.md`). Los nombres de campo de tus mocks deben coincidir con `contrato-api.md`.

> Inicio de fase: rama `feature/frontend`, `git status` vacío, commit de fase 10 presente.
> Procedimiento de lógica (sección 5 de `00`) y filas en `LOGICA_DETECTADA.md`.
> Esta es la ÚLTIMA fase. Incluye una revisión final que se commitea junto con la pantalla (sigue siendo 1 solo commit).

## 1. Usa
`AppShell activeNav="pedidos"`, `Card`, `ImagePlaceholder`, `Chip`, `ProgressBar`, `Rating`.

## 2. Mock (Nivel 2) — amplía `src/mocks/orders.ts`
```
activeOrders = [
  { id: "1042", item: "Botas café",   workshopName: "Talabartería Don Chucho", chipLabel: "Limpieza",   chipTone: "amber", progress: 72 },
  { id: "1043", item: "Tenis blancos", workshopName: "Taller La Ermita",       chipLabel: "Cotización", chipTone: "teal",  progress: 10 }
]
finishedOrders = [
  { id: "1030", item: "Cinturón de piel", workshopName: "Calzado Los Hermanos", date: "2 oct", chipLabel: "Entregado", chipTone: "green", stars: 5 }
]
```
`// TODO(BACKEND)`. Si existe lógica de pedidos (Nivel 1), úsala.

## 3. Estado local
`tab: "activos" | "historial"` (inicia `activos`).

## 4. Estructura móvil

1. Título `Mis pedidos` (`title-hero` 22px, Poppins 600), margen superior 8px.
2. **Pestañas segmentadas** (margen superior 16px): contenedor fondo `color-tan-strong`, `radius-sm`, padding 4px, 2 botones de igual ancho, alto 36px, texto 13px/500:
   - `Activos (2)` — el número sale de `activeOrders.length`. Activa = fondo blanco, `radius-sm`, sombra suave, texto `color-text`.
   - `Historial` — inactiva = fondo transparente, texto `color-text-muted`.
   Con `role="tablist"` / `role="tab"` y `aria-selected`.
3. **Pestaña Activos** (lo que muestra el diseño):
   - Lista de tarjetas activas (gap 12px, margen superior 16px). `Card` clicable (→ `/pedido/:id`), padding 12px, fila:
     - `ImagePlaceholder` 56×56.
     - Columna (flex 1): fila superior `item` (14px/600) a la izquierda y `Chip variant="status"` con `chipLabel`/`chipTone` a la derecha; debajo `workshopName` (12px, muted); debajo `ProgressBar value={progress}` (tono teal).
     Orden: `Botas café` (Limpieza, ámbar, 72) y luego `Tenis blancos` (Cotización, teal, 10).
   - Debajo, etiqueta `Terminados` (12px, `color-text-muted`, margen superior 24px) y la tarjeta terminada: `Card` clicable (→ `/pedido/:id`), misma estructura pero sin barra: `Cinturón de piel` + chip `Entregado` (green); debajo `Calzado Los Hermanos · 2 oct` (12px, muted); debajo `Rating value={5} size=12`.
4. **Pestaña Historial** (no existe en el diseño): muestra SOLO la sección `Terminados` (etiqueta + tarjetas de `finishedOrders`), sin las activas. No inventes más contenido.
5. `BottomNav` con `Pedidos` activo.

## 5. Responsive
- **Tablet:** contenedor 720px; tarjetas activas en grid de 2 columnas.
- **Escritorio:** dentro de `<main>`; pestañas con ancho 320px alineadas a la izquierda; tarjetas activas en grid de **2 columnas** (gap 16px); sección `Terminados` en grid de 2 columnas debajo.

## 6. REVISIÓN FINAL (haz esto ANTES de commitear)

Recorre las 12 rutas del mapa en `00_LEEME_PRIMERO.md` y confirma, marcando cada una en una lista de tu respuesta final (no crees archivo nuevo):
1. Abre sin error y sin 404.
2. Textos exactos según su fase.
3. Sin scroll horizontal a 360px, 768px y 1280px.
4. <1024px: barra inferior en pantallas con navegación; ≥1024px: barra lateral en TODAS.
5. Ningún hex fuera de los tokens; ningún `console.log`; ningún TODO sin el prefijo `TODO(BACKEND)`.
6. Todos los botones navegan según el mapa de flujo:
   - Inicio → Lista / Mapa / Pedido 1042
   - Mapa → Detalle
   - Lista → Detalle
   - Detalle → Chat / Cotizar
   - Cotizar → Pedidos
   - Chat → Presupuesto
   - Presupuesto → Seguimiento (Aceptar) / Chat (Rechazar)
   - Seguimiento → Chat
   - Calificar → Pedidos
   - Mis pedidos → Seguimiento
7. `git log --oneline` muestra **exactamente 11 commits** de esta rama con los mensajes de la tabla de `00_LEEME_PRIMERO.md` (más los commits previos del usuario, si los hay).
8. Revisa `LOGICA_DETECTADA.md`: que tenga filas de todas las pantallas.

Arregla lo que falle, dentro de esta misma fase.

## 7. Criterios de aceptación
- [ ] Textos exactos: `Mis pedidos`, `Activos (2)`, `Historial`, `Botas café`, `Talabartería Don Chucho`, `Limpieza`, `Tenis blancos`, `Taller La Ermita`, `Cotización`, `Terminados`, `Cinturón de piel`, `Calzado Los Hermanos · 2 oct`, `Entregado`.
- [ ] Pestañas alternan Activos/Historial.
- [ ] Tarjeta Botas café → `/pedido/1042`.
- [ ] Revisión final completada. Build/lint sin errores.

## 8. Cierre de fase (EXACTO)
1. `PROGRESO.md`: marca `[x] Fase 11`.
2.
```
git add -A
git commit -m "feat(frontend): fase 11 - mis pedidos y revision final"
git push
```
3. Verifica `git status` limpio y `git log --oneline` con los 11 commits. Informa al usuario: "Frontend completo en la rama feature/frontend." **No hagas merge ni abras pull request.**
