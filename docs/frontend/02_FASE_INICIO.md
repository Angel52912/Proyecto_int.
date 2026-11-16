# FASE 02 / 11 — PANTALLA INICIO (`HomeScreen`, ruta `/`)

> **DOCS EXISTENTES:** antes de empezar relee `docs/contrato-api.md`, `docs/diseno.md`, `docs/requisitos.md` y `docs/decisiones/*`. Respétalos (ver sección 1.1 de `00_LEEME_PRIMERO.md`). Los nombres de campo de tus mocks deben coincidir con `contrato-api.md`.

> Inicio de fase: rama `feature/frontend`, `git status` vacío, commit de fase 01 presente.
> Haz el procedimiento de lógica (sección 5 de `00`) y registra filas en `LOGICA_DETECTADA.md`.

## 1. Usa
`AppShell activeNav="inicio"`, `Card`, `SearchInput`, `SectionHeader`, `MapBackdrop`, `MapPin`, `ImagePlaceholder`, `Chip`, `ProgressBar`, `Button`/enlaces, icono `bell`, `wrench`, `sparkle`.

## 2. Estructura (de arriba hacia abajo, móvil 390px)

1. **Encabezado** (fila, `justify-content: space-between`, `align-items: flex-start`):
   - Izquierda, dos líneas:
     - Línea 1: `Hola, José` — 12px, `color-text-muted`. (Nombre del usuario: Nivel 1 si existe usuario en sesión; si no, mock `"José"`.)
     - Línea 2: `¿Qué restauramos hoy?` — `title-hero`, Poppins 600.
   - Derecha: botón 36×36, fondo blanco, borde `color-border`, `radius-sm`, icono `bell`, `aria-label="Notificaciones"`. Sin acción (Nivel 3, notificaciones).
2. **Buscador**: `SearchInput placeholder="Buscar taller o servicio"`. Margen superior 16px. Al enfocar/presionar Enter → navega a `/mapa` (sin lógica de búsqueda real; Nivel 3).
3. **Categorías** (grid de 2 columnas, gap 12px, margen superior 16px). Cada tarjeta: padding 16px, `radius-md`, alto mínimo 112px, sin borde.
   - Tarjeta A, fondo `color-card-repair`: cuadro blanco 32×32 `radius-sm` con icono `wrench` en `color-primary` arriba a la izquierda; abajo título `Reparación` (15px/600) y subtítulo `Suelas, costuras, tacones` (11px, `color-text-muted`). Click → `/talleres/reparacion`.
   - Tarjeta B, fondo `color-teal-soft`: cuadro blanco con icono `sparkle` en `color-teal`; título `Limpieza`; subtítulo `Lavado, desinfección, tinte`. Click → `/talleres/limpieza`.
4. **Sección "Talleres cerca de ti"**: `SectionHeader title="Talleres cerca de ti" actionLabel="Ver mapa" href="/mapa"`. Margen superior 24px.
   - Debajo, vista previa de mapa: `MapBackdrop height=96px` en móvil, ancho completo, `radius-md`, `overflow:hidden`. Con 3 `MapPin` (posiciones aprox.: x 22%/y 55%, x 62%/y 35%, x 82%/y 95% (este último cortado por el borde)). Click en el bloque → `/mapa`.
5. **Sección "Mi pedido en curso"**: título `section` (sin acción), margen superior 24px. Debajo una `Card` clicable (→ `/pedido/1042`), padding 12px, en fila:
   - Izquierda: `ImagePlaceholder` 56×56.
   - Derecha (columna, flex 1): fila superior con `Botas café` (14px/600) a la izquierda y `Chip variant="status" tone="amber"` con texto `Limpieza` a la derecha; debajo `Talabartería Don Chucho` (12px, muted); debajo `ProgressBar value={72}`.
6. Navegación: `BottomNav` con `Inicio` activo (del shell).

## 3. Mock (Nivel 2) — `src/mocks/orders.ts`
Crea (o amplía si existe en esta fase) con `// TODO(BACKEND)`:
```
currentOrder = { id: "1042", item: "Botas café", workshopId: "don-chucho", workshopName: "Talabartería Don Chucho", serviceLabel: "Limpieza", progress: 72 }
currentUser  = { firstName: "José" }
```
Si ya existe lógica de pedido en curso / usuario (Nivel 1), úsala en lugar de estos mocks.

## 4. Responsive
- **Tablet (768–1023):** contenido centrado `max-width: 720px`. Igual que móvil.
- **Escritorio (≥1024):** AppShell con `SideNav`. Dentro de `<main>`:
  - Encabezado igual, pero el `SearchInput` se coloca en la misma fila que el saludo, a la derecha, con ancho 360px (y la campana a su derecha).
  - Categorías: 2 columnas, cada tarjeta alto mínimo 140px.
  - Debajo, un grid de **2 columnas** (gap 24px): columna izquierda = "Talleres cerca de ti" con mapa de alto 280px; columna derecha = "Mi pedido en curso".
  - El mapa preview crece a `height: 280px`.

## 5. Criterios de aceptación
- [ ] Textos exactos: `Hola, José`, `¿Qué restauramos hoy?`, `Buscar taller o servicio`, `Reparación`, `Suelas, costuras, tacones`, `Limpieza`, `Lavado, desinfección, tinte`, `Talleres cerca de ti`, `Ver mapa`, `Mi pedido en curso`, `Botas café`, `Talabartería Don Chucho`.
- [ ] Navegaciones: tarjeta Reparación → `/talleres/reparacion`; Limpieza → `/talleres/limpieza`; "Ver mapa" y mapa → `/mapa`; pedido → `/pedido/1042`; buscador → `/mapa`.
- [ ] Sin barra de estado "9:41". Sin scroll horizontal a 360px.
- [ ] Build/lint sin errores.

## 6. Cierre de fase (EXACTO)
1. `PROGRESO.md`: marca `[x] Fase 02`. Añade filas a `LOGICA_DETECTADA.md`.
2. 
```
git add -A
git commit -m "feat(frontend): fase 02 - pantalla Inicio"
git push
```
3. `git status` limpio → continúa con `03_FASE_MAPA.md`.
