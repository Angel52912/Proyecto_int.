# FASE 03 / 11 — PANTALLA MAPA (`MapScreen`, ruta `/mapa`)

> **DOCS EXISTENTES:** antes de empezar relee `docs/contrato-api.md`, `docs/diseno.md`, `docs/requisitos.md` y `docs/decisiones/*`. Respétalos (ver sección 1.1 de `00_LEEME_PRIMERO.md`). Los nombres de campo de tus mocks deben coincidir con `contrato-api.md`.

> Inicio de fase: rama `feature/frontend`, `git status` vacío, commit de fase 02 presente.
> Procedimiento de lógica (sección 5 de `00`) y filas en `LOGICA_DETECTADA.md`.

## 1. Usa
`AppShell activeNav="mapa"`, `SearchInput`, `Chip`, `MapBackdrop`, `MapPin`, `Card`, `ImagePlaceholder`, `Rating`, icono `filter`, `chevron-right`.
El mapa es **Nivel 3** (sin proveedor real). Si el repo YA tiene un mapa real, úsalo (Nivel 1) y pon los pines encima.

## 2. Estructura móvil (el mapa ocupa TODA el área entre la parte superior y la barra inferior)

1. **Fondo:** `MapBackdrop` a pantalla completa (`position:absolute; inset:0` dentro del área del shell; alto = 100vh − 64px de barra inferior).
2. **Pines** (todos `MapPin`; posiciones aprox. en % del lienzo): 
   - A: x 14%, y 24% (marrón)
   - B: x 72%, y 15% (marrón; queda parcialmente bajo los chips)
   - C: x 33%, y 40% (**seleccionado**, teal) → corresponde a `don-chucho`
   - D: x 85%, y 49% (marrón)
   - E: x 27%, y 60% (marrón)
   Cada pin es clicable: marca ese taller como seleccionado (estado local). Mapea pines → talleres: C=`don-chucho`, A=`los-hermanos`, B=`la-ermita`, D=`santiago`, E=`don-chucho` (relleno visual).
3. **Buscador flotante:** arriba, margen 16px, `position:absolute`, ancho completo − 32px, sombra suave. `SearchInput placeholder="Buscar en Mérida"` con `rightSlot` = icono `filter` (`color-text-muted`). Sin lógica real (Nivel 3).
4. **Chips de filtro:** fila horizontal justo debajo del buscador (margen superior 8px, gap 8px, `overflow-x:auto` sin mostrar scrollbar). `Chip variant="filter"`: `Todos` (activo por defecto), `Reparación`, `Limpieza`, `Abierto`. Selección única, estado local. El filtro SOLO cambia el chip activo (filtrar pines reales es Nivel 3; NO lo implementes).
5. **Tarjeta inferior del taller seleccionado:** `position:absolute; left:16px; right:16px; bottom:16px` (encima de la barra inferior). `Card` clicable (→ `/taller/:id` del seleccionado), padding 12px, en fila:
   - `ImagePlaceholder` 56×56.
   - Columna: nombre (14px/600) `Talabartería Don Chucho`; fila con `Rating value={5} size=12`, texto `4.9 · 0.8 km` (12px, muted); `Chip variant="status" tone="green"` con texto `Abierto hasta 7 pm`.
   - Derecha: icono `chevron-right`.
   Los datos salen de `getWorkshopById(selectedId)`. Para talleres sin horario no muestres el chip verde.

## 3. Responsive
- **Tablet:** igual que móvil.
- **Escritorio (≥1024):** dentro de `<main>` (sin padding de 32px en esta pantalla; el mapa llena el área) usa layout de 2 columnas: **panel izquierdo de 380px** (fondo `color-bg`, borde derecho, padding 16px, scroll vertical) y **mapa a la derecha** ocupando el resto (alto 100vh).
  - Panel izquierdo, de arriba abajo: `SearchInput` (con `filter`), fila de chips (con wrap), y debajo la lista de los 4 talleres como `Card` (misma estructura que la tarjeta inferior; la del seleccionado con borde `color-teal` 1.5px). Click en una tarjeta = seleccionarla; segundo click/botón → `/taller/:id`.
  - En el mapa de escritorio NO se muestran buscador flotante ni tarjeta inferior (ya están en el panel).

## 4. Criterios de aceptación
- [ ] Textos exactos: `Buscar en Mérida`, `Todos`, `Reparación`, `Limpieza`, `Abierto`, `Talabartería Don Chucho`, `4.9 · 0.8 km`, `Abierto hasta 7 pm`.
- [ ] Pin seleccionado en teal, los demás marrón. Click en pin cambia la tarjeta inferior.
- [ ] Tarjeta → `/taller/don-chucho`.
- [ ] En escritorio aparece el panel de lista y desaparecen buscador flotante y tarjeta inferior.
- [ ] La tarjeta inferior NO queda oculta tras la barra inferior.
- [ ] Build/lint sin errores.

## 5. Cierre de fase (EXACTO)
1. `PROGRESO.md`: marca `[x] Fase 03`. Añade filas a `LOGICA_DETECTADA.md`.
2.
```
git add -A
git commit -m "feat(frontend): fase 03 - pantalla Mapa"
git push
```
3. `git status` limpio → continúa con `04_FASE_LISTA_TALLERES.md`.
