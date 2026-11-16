# FASE 06 / 11 — SOLICITAR COTIZACIÓN (`QuoteRequestScreen`, ruta `/taller/:tallerId/cotizar`)

> **DOCS EXISTENTES:** antes de empezar relee `docs/contrato-api.md`, `docs/diseno.md`, `docs/requisitos.md` y `docs/decisiones/*`. Respétalos (ver sección 1.1 de `00_LEEME_PRIMERO.md`). Los nombres de campo de tus mocks deben coincidir con `contrato-api.md`.

> Inicio de fase: rama `feature/frontend`, `git status` vacío, commit de fase 05 presente.
> Procedimiento de lógica (sección 5 de `00`) y filas en `LOGICA_DETECTADA.md`.

## 1. Usa
`AppShell activeNav="mapa" hideNavOnMobile`, `PageHeader`, `Card`, `ImagePlaceholder`, `Chip`, `TextArea`, `Button`, `StickyActionBar`, iconos `camera`, `wrench`, `sparkle`, `send`.

## 2. Estado local (frontend permitido)
```
photos: string[]            // inicia con 2 elementos mock (placeholders)
serviceType: "reparacion" | "limpieza"   // inicia "reparacion"
description: string          // inicia vacío
```
Los 2 placeholders iniciales reproducen el diseño. (Mock Nivel 2: `// TODO(BACKEND)`.)

## 3. Estructura móvil (SIN barra inferior en móvil)

1. `PageHeader title="Solicitar cotización"`.
2. **Tarjeta del taller** (`Card`, padding 12px, fila, margen superior 12px): `ImagePlaceholder` 36×36; columna con `Para` (11px, muted) y debajo `Talabartería Don Chucho` (14px/600). Datos desde `getWorkshopById(tallerId)`.
3. **Fotos del calzado:** etiqueta `Fotos del calzado` (12px/500, margen superior 20px). Debajo grid de 3 columnas (gap 8px), cuadrados (aspect-ratio 1/1):
   - Casillas 1 y 2: `ImagePlaceholder` (las fotos).
   - Casilla 3: botón con borde **discontinuo** 1px `color-primary`, `radius-sm`, fondo transparente, icono `camera` (22px, `color-primary`) y texto `Agregar` (11px, `color-primary`) centrados. Acción: abrir selector de archivos `<input type="file" accept="image/*" multiple hidden>` y mostrar las miniaturas locales con `URL.createObjectURL` (preview local, permitido). **La subida real es Nivel 3: NO la implementes.** Máximo 3 casillas visibles en móvil; si hay más fotos, la fila hace wrap.
4. **Tipo de servicio:** etiqueta `Tipo de servicio` (12px/500, margen superior 20px). Fila de 2 `Chip variant="filter"`:
   - `Reparación` con `leftIcon` `wrench` (activo si `serviceType==="reparacion"`).
   - `Limpieza` con `leftIcon` `sparkle`.
   Selección única.
5. **Descripción:** etiqueta `Describe el problema` (12px/500, margen superior 20px) y `TextArea rows={4}` con `placeholder="La suela izquierda está despegada y el cuero tiene manchas de agua."` (el diseño muestra este texto de ejemplo; lo usamos como placeholder).
6. `StickyActionBar` con `Button variant="primary" fullWidth leftIcon="send"` texto `Enviar solicitud`. Acción: llama a `onSubmit` (si existe lógica Nivel 1 de crear solicitud, úsala; si no, `// TODO(BACKEND)`) y luego navega a `/pedidos`.

## 4. Responsive
- **Tablet:** contenedor 720px.
- **Escritorio:** `<main>` con **2 columnas** (gap 32px):
  - Izquierda: tarjeta del taller + `Fotos del calzado` (grid de 4 columnas).
  - Derecha: `Tipo de servicio`, `Describe el problema` (TextArea rows 8) y al final el botón `Enviar solicitud` (ancho automático, mínimo 240px, alineado a la derecha; `StickyActionBar` ya es estático).

## 5. Criterios de aceptación
- [ ] Textos exactos: `Solicitar cotización`, `Para`, `Talabartería Don Chucho`, `Fotos del calzado`, `Agregar`, `Tipo de servicio`, `Reparación`, `Limpieza`, `Describe el problema`, `Enviar solicitud`.
- [ ] Chip activo cambia (solo uno activo a la vez). `Reparación` activo al abrir.
- [ ] Casilla `Agregar` abre selector de archivos y muestra preview local.
- [ ] `Enviar solicitud` navega a `/pedidos`.
- [ ] Sin barra inferior en móvil. Build/lint sin errores.

## 6. Cierre de fase (EXACTO)
1. `PROGRESO.md`: marca `[x] Fase 06`. Añade filas a `LOGICA_DETECTADA.md`.
2.
```
git add -A
git commit -m "feat(frontend): fase 06 - solicitar cotizacion"
git push
```
3. `git status` limpio → continúa con `07_FASE_CHAT.md`.
