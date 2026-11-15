# FASE 09 / 11 — SEGUIMIENTO DE PEDIDO (`OrderTrackingScreen`, ruta `/pedido/:pedidoId`)

> **DOCS EXISTENTES:** antes de empezar relee `docs/contrato-api.md`, `docs/diseno.md`, `docs/requisitos.md` y `docs/decisiones/*`. Respétalos (ver sección 1.1 de `00_LEEME_PRIMERO.md`). Los nombres de campo de tus mocks deben coincidir con `contrato-api.md`.

> Inicio de fase: rama `feature/frontend`, `git status` vacío, commit de fase 08 presente.
> Procedimiento de lógica (sección 5 de `00`) y filas en `LOGICA_DETECTADA.md`.
> El avance real de fases y las fotos de avance llegan del backend (**Nivel 3**). Aquí solo se pintan los datos.

## 1. Usa
`AppShell activeNav="pedidos"` (con barra inferior visible en móvil), `PageHeader`, `Card`, `ImagePlaceholder`, `Chip`, `ProgressBar`, `Button`, iconos `check`, `message`.

## 2. Mock (Nivel 2) — amplía `src/mocks/orders.ts`
```
orderDetail = {
  id: "1042", item: "Botas café", workshopName: "Talabartería Don Chucho",
  statusLabel: "En proceso", phase: 3, totalPhases: 4, progress: 72,
  steps: [
    { title: "Inspección",                 meta: "12 nov · 10:30",          state: "done" },
    { title: "Desinfección / pretratamiento", meta: "13 nov · 16:05",       state: "done" },
    { title: "Limpieza / reparación",      meta: "En curso · fotos nuevas", state: "current" },
    { title: "Secado / detallado",         meta: "Estimado 17 nov",         state: "pending" }
  ],
  progressPhotos: 3
}
```
`// TODO(BACKEND)`. Si existe lógica de pedido real (Nivel 1), úsala.

## 3. Estructura móvil

1. `PageHeader title="Pedido #1042"`.
2. **Tarjeta resumen** (`Card`, padding 16px):
   - Fila: `ImagePlaceholder` 48×48; columna con `Botas café` (14px/600) y `Talabartería Don Chucho` (12px, muted); a la derecha `Chip variant="status" tone="amber"` texto `En proceso`.
   - Debajo (margen superior 12px): fila `justify-content: space-between`: `Fase 3 de 4` (12px, muted) y `72%` (12px/600, `color-teal`).
   - Debajo `ProgressBar value={72}`.
3. **Línea de tiempo** (`Card`, padding 16px, margen superior 12px). Lista vertical con 4 pasos. Cada paso: fila con indicador a la izquierda (círculo 20×20) y texto a la derecha (título 13px/600; debajo meta 11px, muted). Una línea vertical de 2px (`color-tan-strong`) conecta los círculos (la parte entre pasos completados en `color-teal`).
   - `done`: círculo relleno `color-teal` con icono `check` blanco (12px).
   - `current`: círculo relleno `color-amber`.
   - `pending`: círculo con borde 2px `color-tan-strong` y fondo blanco.
   Pasos, en este orden exacto:
   1. `Inspección` — `12 nov · 10:30` (done)
   2. `Desinfección / pretratamiento` — `13 nov · 16:05` (done)
   3. `Limpieza / reparación` — `En curso · fotos nuevas` (current)
   4. `Secado / detallado` — `Estimado 17 nov` (pending)
4. **Fotos de avance:** fila `justify-content: space-between` (margen superior 20px): `Fotos de avance` (`section` 15px/600) y `3 fotos` (12px, muted). Debajo grid de 3 columnas (gap 8px) con 3 `ImagePlaceholder` cuadrados.
5. **Botón** (margen superior 16px, `Button variant="outline" fullWidth leftIcon="message"`) texto `Escribir al taller` → `/chat/1042`.
6. NO añadas ningún otro botón o enlace. La ruta `/pedido/1042/recoger` (fase 10) se alcanza escribiendo la URL; el diseño no tiene un botón que lleve a ella desde esta pantalla.

## 4. Responsive
- **Tablet:** contenedor 720px.
- **Escritorio:** dentro de `<main>`, **2 columnas** (gap 32px): izquierda = tarjeta resumen + botón `Escribir al taller`; derecha = línea de tiempo + `Fotos de avance` (3 columnas de fotos, cada una 120px de alto mínimo). Encabezado `Pedido #1042` arriba a todo el ancho.

## 5. Criterios de aceptación
- [ ] Textos exactos: `Pedido #1042`, `Botas café`, `Talabartería Don Chucho`, `En proceso`, `Fase 3 de 4`, `72%`, los 4 títulos y metas de pasos, `Fotos de avance`, `3 fotos`, `Escribir al taller`.
- [ ] Indicadores: 2 teal con check, 1 ámbar, 1 vacío.
- [ ] `Escribir al taller` → `/chat/1042`. Barra inferior con `Pedidos` activo en móvil.
- [ ] Build/lint sin errores.

## 6. Cierre de fase (EXACTO)
1. `PROGRESO.md`: marca `[x] Fase 09`. Añade filas a `LOGICA_DETECTADA.md`.
2.
```
git add -A
git commit -m "feat(frontend): fase 09 - seguimiento de pedido"
git push
```
3. `git status` limpio → continúa con `10_FASE_RECOGER_Y_CALIFICAR.md`.
