# FASE 01 / 11 — FUNDACIÓN (tokens, shell adaptativo, componentes base)

> **DOCS EXISTENTES:** antes de empezar relee `docs/contrato-api.md`, `docs/diseno.md`, `docs/requisitos.md` y `docs/decisiones/*`. Respétalos (ver sección 1.1 de `00_LEEME_PRIMERO.md`). Los nombres de campo de tus mocks deben coincidir con `contrato-api.md`.

> Antes de empezar: lee `00_LEEME_PRIMERO.md` completo. Verifica rama `feature/frontend`.
> Esta fase NO construye pantallas del diseño (salvo el stub de Perfil). Construye la base que usan las otras 10 fases.

## 1. Objetivo
Crear: tokens de diseño, tipografías, shell adaptativo (barra inferior móvil / barra lateral escritorio), rutas vacías de todas las pantallas, iconos y componentes base reutilizables.

## 2. Pasos en orden

### 2.1 Detectar stack
Haz la detección de la sección 4 de `00_LEEME_PRIMERO.md`. Crea `docs/frontend/LOGICA_DETECTADA.md` con el encabezado de tabla del punto 5 (vacío por ahora) y una línea al inicio: `STACK DETECTADO: <framework> / <estilos> / <router> / <iconos>`.

### 2.2 Tokens de diseño
Crea los tokens en el sistema de estilos del proyecto (variables CSS en `:root`, o `theme` de Tailwind, etc.). Valores (estimados del diseño; si el repo YA tiene tokens equivalentes, úsalos y no dupliques):

| Token | Valor | Uso |
|---|---|---|
| `color-bg` | `#FAF6EF` | Fondo de pantallas |
| `color-surface` | `#FFFFFF` | Tarjetas, inputs |
| `color-tan` | `#EFE3D6` | Fondo de placeholders de imagen, botones secundarios tenues |
| `color-tan-strong` | `#E6D8C8` | Pista de barra de progreso, pestañas inactivas |
| `color-border` | `#EADFD2` | Bordes de tarjetas/inputs |
| `color-primary` | `#7A4528` | Café: botones principales, chips activos, ítem activo de navegación, mensajes enviados |
| `color-primary-hover` | `#653821` | Hover/pressed del primario |
| `color-on-primary` | `#FFFFFF` | Texto sobre primario |
| `color-teal` | `#1F7F7A` | Acción teal, progreso, check, pin seleccionado |
| `color-teal-soft` | `#DCEEEC` | Fondo chip/tarjeta Limpieza, banner informativo |
| `color-amber` | `#E8A33D` | Estrellas, punto "en curso" |
| `color-amber-soft` | `#FBEFD2` | Fondo chip "Limpieza" de estado, tarjeta contexto de chat |
| `color-amber-text` | `#B7791F` | Texto sobre amber-soft |
| `color-green-soft` | `#DDF0E2` | Chip "Abierto", "Entregado", "¡Tu calzado está listo!" |
| `color-green-text` | `#2E7D4F` | Texto sobre green-soft, "En línea" |
| `color-card-repair` | `#F1E2D3` | Tarjeta categoría Reparación |
| `color-text` | `#2B1D14` | Texto principal |
| `color-text-muted` | `#7A6A5E` | Texto secundario |
| `color-text-subtle` | `#A39485` | Placeholders, hora de mensajes |
| `color-map-land` | `#E8EFE3` | Fondo mapa |
| `color-map-road` | `#FAF6EF` | Calles del mapa |
| `color-map-park` | `#D5E6D2` | Zonas verdes del mapa |

Radios: `radius-sm 8px` (inputs/chips pequeños), `radius-md 12px` (tarjetas), `radius-lg 16px` (hojas/paneles), `radius-full 999px` (chips, avatares, botón enviar).
Sombra de tarjeta: `0 1px 2px rgba(43,29,20,0.06)`. Borde de tarjeta: `1px solid color-border`.
Espaciado (múltiplos de 4): 4, 8, 12, 16, 20, 24, 32. Padding horizontal de pantalla móvil: **20px**.

### 2.3 Tipografía
- Títulos (h1/h2/h3 y nombres de taller): **Poppins**, peso 600.
- Resto: **Inter**, pesos 400 y 500.
- Cárgalas con el mecanismo estándar del framework (ej. `next/font`, `<link>` de Google Fonts en el HTML raíz). Fallback: `system-ui, -apple-system, "Segoe UI", sans-serif`.
- Escala: `title-page 20px/28px (600)`, `title-hero 22px/30px (600)`, `section 15px/22px (600)`, `body 14px/20px (400)`, `body-strong 14px/20px (500)`, `small 12px/16px (400)`, `tiny 11px/14px (400)`.
- En escritorio (≥1024): `title-page` pasa a 28px/36px y `title-hero` a 32px/40px. Lo demás no cambia.

### 2.4 Iconos
Usa la librería de iconos que YA exista. Si no existe ninguna, crea `Icon` con SVG propios (trazo 1.75px, `currentColor`, viewBox 24×24, `fill="none"`). Nombres que debe exponer, EXACTOS:
`home`, `map-pin`, `clipboard`, `user`, `bell`, `search`, `filter`, `wrench`, `sparkle`, `chevron-right`, `chevron-left`, `star`, `star-outline`, `camera`, `image`, `send`, `message`, `calendar`, `clock`, `shield-check`, `check`, `x`, `navigation`.
Prop `size` (default 20) y `color` heredado.

### 2.5 Componentes base (crear TODOS, con estos nombres y props)

1. **`ImagePlaceholder`** — props: `src?`, `alt`, `width?`, `height?`, `rounded?`, `iconSize?`. Si hay `src` muestra `<img>` con `object-fit: cover`; si no, caja `color-tan` con icono `image` centrado en `color-text-subtle`. Radio `radius-sm` por defecto. (Todas las imágenes del diseño son este placeholder.)
2. **`Button`** — props: `variant` (`primary` | `outline` | `teal` | `icon`), `fullWidth?`, `leftIcon?`, `onClick?`, `href?` (si hay, renderiza como enlace), `children`, `ariaLabel?`. Altura 48px, radio 10px, texto 15px/500. `primary`: fondo `color-primary`, texto blanco. `outline`: fondo transparente, borde 1px `color-primary`, texto `color-primary`. `teal`: fondo `color-teal`, texto blanco. `icon`: 44×44, borde `color-primary`, icono `color-primary`, radio 10px.
3. **`Chip`** — props: `variant` (`filter` | `tag` | `status`), `tone` (`neutral` | `primary` | `teal` | `amber` | `green`), `active?`, `leftIcon?`, `onClick?`, `children`. Altura 32px (tag/status: 22px, texto 11px), radio full, padding horizontal 12px. `filter` inactivo: fondo blanco, borde `color-border`, texto `color-text`. `filter` activo: fondo `color-primary`, texto blanco. `tag` tonos: neutral=`color-tan`/texto `color-text-muted`; teal=`color-teal-soft`/texto `color-teal`. `status` tonos: amber=`amber-soft`/`amber-text`; teal=`teal-soft`/`teal`; green=`green-soft`/`green-text`.
4. **`Rating`** — props: `value` (0–5 entero), `size?` (14 por defecto), `interactive?`, `onChange?`. Estrellas llenas `color-amber`; vacías: contorno `color-amber` o `color-tan-strong`. Si `interactive`, cada estrella es `<button>` con `aria-label="N estrellas"`.
5. **`ProgressBar`** — props: `value` (0–100), `tone?` (`teal` por defecto). Altura 6px, radio full, pista `color-tan-strong`, relleno color del tono. `role="progressbar"` con `aria-valuenow`.
6. **`Card`** — props: `onClick?`, `padding?` (16 por defecto), `tone?` (`default` | `amber-soft` | `teal-soft` | `repair`), `children`. Fondo `color-surface`, borde, `radius-md`, sombra. Si hay `onClick` es `<button>`/enlace accesible.
7. **`SearchInput`** — props: `placeholder`, `value?`, `onChange?`, `rightSlot?`. Altura 44px, fondo blanco, borde, `radius-sm`, icono `search` a la izquierda (`color-text-subtle`).
8. **`TextArea`** — props: `label?`, `placeholder`, `value`, `onChange`, `rows` (4 por defecto). Fondo blanco, borde, `radius-sm`, padding 12px, texto 14px.
9. **`Avatar`** — props: `initials`, `size` (36 por defecto). Círculo `color-tan`, iniciales `color-text-muted` 12px/500.
10. **`SectionHeader`** — props: `title`, `actionLabel?`, `onAction?`/`href?`. Título `section`; acción a la derecha en 12px/500 `color-text-muted`.
11. **`MapBackdrop`** — fondo de mapa ESTILIZADO (Nivel 3: no hay mapa real). Props: `height?`, `children` (los pines se posicionan con `position:absolute` en %). Pinta: fondo `color-map-land`, 2–3 calles blancas (`color-map-road`) horizontales y verticales con divs/SVG, y 1–2 manchas `color-map-park`. **Si el proyecto YA tiene un componente de mapa real, úsalo en su lugar (Nivel 1).**
12. **`MapPin`** — props: `selected?`, `x`, `y` (porcentajes), `onClick?`, `ariaLabel`. Marcador de gota 32×38: fondo `color-primary` (o `color-teal` si `selected`), icono `wrench` blanco al centro, borde blanco 2px.
13. **`PageHeader`** — props: `title`, `onBack?` (si no hay, usa navegación atrás del router), `showBack?` (true), `rightSlot?`. Fila con botón atrás (icono `chevron-left`, 36×36, `aria-label="Volver"`), título `section` 16px/600 y `rightSlot` a la derecha.
14. **`StickyActionBar`** — props: `children`. Móvil/tablet: `position: fixed; bottom: 0; left: 0; right: 0`, padding 16px 20px + safe-area, fondo `color-bg`, el contenido de la página debe tener `padding-bottom` suficiente para no taparse. Escritorio: NO fijo; bloque normal, `display:flex; gap:12px; justify-content:flex-end; margin-top:24px`.
15. **`BottomNav`** (solo <1024px) y **`SideNav`** (solo ≥1024px). Mismos 4 destinos, EXACTOS: `Inicio` (`home`, `/`), `Mapa` (`map-pin`, `/mapa`), `Pedidos` (`clipboard`, `/pedidos`), `Perfil` (`user`, `/perfil`). `BottomNav`: altura 64px, fondo `color-bg`, borde superior `color-border`, icono 22px sobre etiqueta 11px; activo = `color-primary`, inactivo = `color-text-muted`. `SideNav`: ancho 240px, alto 100vh, `position: sticky; top:0`, borde derecho, ítems en fila (icono + etiqueta 14px/500, alto 44px, radio 10px), activo = fondo `color-tan` + texto `color-primary`.
   - Prop `activeItem` en el shell para marcar el activo (ver tabla de cada fase).
16. **`AppShell`** — props: `activeNav?` (`inicio`|`mapa`|`pedidos`|`perfil`), `hideNavOnMobile?` (false), `maxWidth?` (1120), `children`. Móvil/tablet: contenido centrado, `max-width: 720px`, fondo `color-bg`, `padding-bottom: 80px` si hay BottomNav. Escritorio: `display:flex`; `SideNav` a la izquierda y `<main>` con `padding: 32px`, `max-width: maxWidth`, `margin: 0 auto`. Si `hideNavOnMobile` es true, la `BottomNav` no se muestra en <1024px, pero la `SideNav` SÍ en ≥1024px.

### 2.6 Rutas y pantallas vacías
Registra TODAS las rutas del mapa (sección 9 de `00`) de forma aditiva (no borres rutas existentes). Cada pantalla es un componente que por ahora renderiza solo `<AppShell activeNav=...><h1>[nombre de la pantalla]</h1></AppShell>`. Archivos/nombres EXACTOS:
`HomeScreen`, `MapScreen`, `WorkshopListScreen`, `WorkshopDetailScreen`, `QuoteRequestScreen`, `ChatScreen`, `BudgetScreen`, `OrderTrackingScreen`, `PickupScreen`, `RatingScreen`, `MyOrdersScreen`, `ProfileScreen`.
`ProfileScreen` (stub): AppShell `activeNav="perfil"` con el texto "Perfil" como título y debajo "Próximamente" en `color-text-muted`. Ya.

### 2.7 Mocks base
Crea `src/mocks/workshops.ts` (o `.js`) con los 4 talleres (los usarán fases 02–06):

| id | nombre | servicios (tags) | estrellas | rating | reseñas | km | dirección | horario |
|---|---|---|---|---|---|---|---|---|
| `don-chucho` | Talabartería Don Chucho | Suelas · Costuras · Cuero | 5 | 4.9 | 128 | 0.8 | C. 62 #512, Centro, Mérida | Abierto hasta 7 pm |
| `los-hermanos` | Calzado Los Hermanos | Tacones · Suelas | 4 | 4.2 | 64 | 1.4 | (vacío) | (vacío) |
| `la-ermita` | Taller La Ermita | Bolsas · Cinturones · Botas | 4 | 4.1 | 40 | 2.1 | (vacío) | (vacío) |
| `santiago` | Zapatería Santiago | Reparación general | 3 | 3.4 | 22 | 2.9 | (vacío) | (vacío) |

Marca con `// TODO(BACKEND): reemplazar por lógica real`. Exporta también una función `getWorkshopById(id)` que lea del arreglo mock (sin red).

## 3. Criterios de aceptación
- [ ] `npm run build` (o equivalente existente) sin errores; lint/typecheck sin errores.
- [ ] Todas las rutas abren sin 404.
- [ ] <1024px se ve la barra inferior con 4 ítems; ≥1024px la barra lateral con 4 ítems.
- [ ] Ningún hex hardcodeado fuera del archivo de tokens.
- [ ] `docs/frontend/LOGICA_DETECTADA.md` existe con la línea `STACK DETECTADO`.
- [ ] No se instaló ninguna dependencia.

## 4. Cierre de fase (EXACTO)
1. En `PROGRESO.md` marca `[x] Fase 01`.
2. Ejecuta, en este orden:
```
git add -A
git commit -m "feat(frontend): fase 01 - fundacion, tokens, shell adaptativo y componentes base"
git push -u origin feature/frontend
```
3. Verifica `git status` limpio. Continúa con `02_FASE_INICIO.md`.
