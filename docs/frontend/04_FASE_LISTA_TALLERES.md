# FASE 04 / 11 — LISTA DE TALLERES (`WorkshopListScreen`, ruta `/talleres/:categoria`)

> **DOCS EXISTENTES:** antes de empezar relee `docs/contrato-api.md`, `docs/diseno.md`, `docs/requisitos.md` y `docs/decisiones/*`. Respétalos (ver sección 1.1 de `00_LEEME_PRIMERO.md`). Los nombres de campo de tus mocks deben coincidir con `contrato-api.md`.

> Inicio de fase: rama `feature/frontend`, `git status` vacío, commit de fase 03 presente.
> Procedimiento de lógica (sección 5 de `00`) y filas en `LOGICA_DETECTADA.md`.

## 1. Usa
`AppShell activeNav="mapa"` (**así está en el diseño: en esta pantalla el ítem activo es `Mapa`; respétalo**), `PageHeader`, `Chip`, `Card`, `ImagePlaceholder`, `Rating`, icono `filter`, `chevron-right`.

## 2. Título según ruta
- `:categoria = reparacion` → título `Reparación`.
- `:categoria = limpieza` → título `Limpieza`. (Misma pantalla y mismos mocks; solo cambia el título.)
- Cualquier otro valor → título `Reparación`.

## 3. Estructura móvil
1. `PageHeader title={título}` con `rightSlot` = icono `filter` (botón 36×36, `aria-label="Filtros"`, sin acción: Nivel 3).
2. **Chips de orden** (fila, gap 8px, margen superior 12px): `Más cercanos` (activo por defecto), `Mejor valorados`, `Precio`. Selección única, estado local. **Solo cambia el chip activo; reordenar con lógica real es Nivel 3.** (Opcional permitido y sencillo: si el chip es `Más cercanos` ordenar el arreglo mock por `km` ascendente; `Mejor valorados` por `rating` descendente. `Precio` no ordena.)
3. **Lista** (columna, gap 12px, margen superior 16px). Una `Card` clicable por taller (→ `/taller/:id`), padding 12px, en fila:
   - `ImagePlaceholder` 56×56.
   - Columna: nombre (14px/600); tags en una línea (12px, muted) con el formato `Suelas · Costuras · Cuero`; fila con `Rating size=12` y `0.8 km` (11px, muted).
   - Derecha: icono `chevron-right` (`color-text-subtle`).
   Orden por defecto y datos (desde `src/mocks/workshops`):
   1. `Talabartería Don Chucho` — `Suelas · Costuras · Cuero` — 5 estrellas — `0.8 km`
   2. `Calzado Los Hermanos` — `Tacones · Suelas` — 4 estrellas — `1.4 km`
   3. `Taller La Ermita` — `Bolsas · Cinturones · Botas` — 4 estrellas — `2.1 km`
   4. `Zapatería Santiago` — `Reparación general` — 3 estrellas — `2.9 km`
4. `BottomNav` con `Mapa` activo.

## 4. Responsive
- **Tablet:** contenido centrado 720px; la lista pasa a **grid de 2 columnas** (gap 12px).
- **Escritorio:** `<main>`; el `PageHeader` sin botón atrás visible puede mantenerse (déjalo). Lista en **grid de 3 columnas** (gap 16px). Cada `Card` sube a padding 16px e `ImagePlaceholder` 72×72. Chips de orden en fila bajo el título.

## 5. Criterios de aceptación
- [ ] Textos exactos de chips y cuatro talleres con sus tags y distancias.
- [ ] Card → `/taller/<id>` correcto para cada uno.
- [ ] Botón atrás regresa a la pantalla anterior.
- [ ] `/talleres/limpieza` muestra título `Limpieza`.
- [ ] Ítem `Mapa` activo en navegación.
- [ ] Build/lint sin errores.

## 6. Cierre de fase (EXACTO)
1. `PROGRESO.md`: marca `[x] Fase 04`. Añade filas a `LOGICA_DETECTADA.md`.
2.
```
git add -A
git commit -m "feat(frontend): fase 04 - lista de talleres"
git push
```
3. `git status` limpio → continúa con `05_FASE_DETALLE_TALLER.md`.
