# FASE 05 / 11 — DETALLE DE TALLER (`WorkshopDetailScreen`, ruta `/taller/:tallerId`)

> **DOCS EXISTENTES:** antes de empezar relee `docs/contrato-api.md`, `docs/diseno.md`, `docs/requisitos.md` y `docs/decisiones/*`. Respétalos (ver sección 1.1 de `00_LEEME_PRIMERO.md`). Los nombres de campo de tus mocks deben coincidir con `contrato-api.md`.

> Inicio de fase: rama `feature/frontend`, `git status` vacío, commit de fase 04 presente.
> Procedimiento de lógica (sección 5 de `00`) y filas en `LOGICA_DETECTADA.md`.

## 1. Usa
`AppShell activeNav="mapa" hideNavOnMobile`, `ImagePlaceholder`, `Rating`, `Chip`, `Button`, `StickyActionBar`, `Card`, iconos `chevron-left`, `map-pin`, `message`.
Datos: `getWorkshopById(tallerId)`. Para este diseño todo el texto corresponde a `don-chucho`. Para otros talleres usa sus datos de mock y deja vacíos (no muestres) los campos que sean vacío.

## 2. Estructura móvil (SIN barra inferior en móvil)

1. **Hero:** bloque a ancho completo (sin padding lateral), alto 220px, fondo `color-tan`, con icono `image` grande (48px, `color-text-subtle`) centrado en la parte superior. Es una imagen placeholder: usa `ImagePlaceholder` a ancho completo, `rounded=false`.
   - Sobre el hero, arriba-izquierda (16px, 16px): botón 36×36 blanco, `radius-sm`, icono `chevron-left`, `aria-label="Volver"`, vuelve atrás.
2. **Panel de contenido:** sube sobre el hero con `margin-top: -24px`, fondo `color-bg`, esquinas superiores `radius-lg`, padding 20px.
   - Título: `Talabartería Don Chucho` (`title-hero` 22px).
   - Fila: `Rating value={5} size=14` + texto `4.9 (128 reseñas) · 0.8 km` (12px, muted).
   - Fila: icono `map-pin` (14px, muted) + `C. 62 #512, Centro, Mérida` (12px, muted).
   - Fila de tags (gap 8px, wrap): `Chip variant="tag"`: `Suelas` (neutral), `Costuras` (neutral), `Limpieza` (tone teal).
   - Descripción (14px, muted, margen superior 16px): `Más de 30 años restaurando botas, huaraches y artículos de piel con técnicas tradicionales.`
   - Sección `Trabajos recientes` (título `section`, margen superior 24px) y debajo grid de 3 columnas (gap 8px) con 3 `ImagePlaceholder` cuadrados (aspect-ratio 1/1).
3. **Barra de acciones inferior** (`StickyActionBar`): fila con
   - `Button variant="icon"` con icono `message`, `ariaLabel="Escribir al taller"` → navega a `/chat/1042`.
   - `Button variant="primary" fullWidth` texto `Solicitar cotización` → `/taller/:tallerId/cotizar`.
   (gap 12px; el botón primario ocupa el espacio restante.)

## 3. Responsive
- **Tablet:** contenedor 720px centrado; hero 280px de alto.
- **Escritorio (≥1024):** quita el hero a ancho completo. Layout de **2 columnas** (gap 32px) dentro de `<main>`:
  - Columna izquierda (flex 1.2): `ImagePlaceholder` 100% de ancho, alto 360px, `radius-lg`; debajo `Trabajos recientes` con 3 columnas.
  - Columna derecha (flex 1): botón/enlace `← Volver` NO (no inventes); usa el mismo botón atrás 36×36 arriba; luego título, rating, dirección, tags, descripción; al final el bloque de acciones (`StickyActionBar` ya es estático en escritorio): botón icono `message` + `Solicitar cotización` en fila.
  - El panel de contenido NO tiene `margin-top` negativo ni esquinas redondeadas en escritorio.

## 4. Criterios de aceptación
- [ ] Textos exactos: `Talabartería Don Chucho`, `4.9 (128 reseñas) · 0.8 km`, `C. 62 #512, Centro, Mérida`, `Suelas`, `Costuras`, `Limpieza`, la descripción completa, `Trabajos recientes`, `Solicitar cotización`.
- [ ] Botón mensaje → `/chat/1042`; `Solicitar cotización` → `/taller/don-chucho/cotizar`; atrás vuelve.
- [ ] En móvil NO hay barra inferior de navegación; en escritorio SÍ hay barra lateral.
- [ ] La barra de acciones fija no tapa el último contenido (hay `padding-bottom`).
- [ ] Build/lint sin errores.

## 5. Cierre de fase (EXACTO)
1. `PROGRESO.md`: marca `[x] Fase 05`. Añade filas a `LOGICA_DETECTADA.md`.
2.
```
git add -A
git commit -m "feat(frontend): fase 05 - detalle de taller"
git push
```
3. `git status` limpio → continúa con `06_FASE_SOLICITAR_COTIZACION.md`.
