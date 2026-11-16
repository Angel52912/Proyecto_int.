# FASE 10 / 11 — RECOGER PEDIDO Y CALIFICAR (`PickupScreen` + `RatingScreen`)

> **DOCS EXISTENTES:** antes de empezar relee `docs/contrato-api.md`, `docs/diseno.md`, `docs/requisitos.md` y `docs/decisiones/*`. Respétalos (ver sección 1.1 de `00_LEEME_PRIMERO.md`). Los nombres de campo de tus mocks deben coincidir con `contrato-api.md`.

> Inicio de fase: rama `feature/frontend`, `git status` vacío, commit de fase 09 presente.
> Procedimiento de lógica (sección 5 de `00`) y filas en `LOGICA_DETECTADA.md`.
> Esta fase construye **2 pantallas** pero genera **1 solo commit**.
> Generar/validar el QR y el PIN reales es **Nivel 3**: muestra los valores del mock. Guardar la calificación es **Nivel 3**.

# PARTE A — RECOGER PEDIDO (`PickupScreen`, ruta `/pedido/:pedidoId/recoger`)

## A1. Usa
`AppShell activeNav="pedidos" hideNavOnMobile`, `PageHeader`, `Chip`, `Card`, `Button`, icono `map-pin`, `navigation`.

## A2. Mock (Nivel 2) — `src/mocks/pickup.ts`
```
pickup = {
  readyLabel: "¡Tu calzado está listo!",
  pin: ["8","3","5","1"],
  qrValue: "pedido-1042",
  workshopName: "Talabartería Don Chucho",
  addressLine: "C. 62 #512, Centro · Abierto hasta 7 pm",
  mapsQuery: "C. 62 #512, Centro, Mérida"
}
```
`// TODO(BACKEND)`. Si ya existe una librería QR en el proyecto (Nivel 1) úsala con `qrValue`. Si no, crea `QrPlaceholder` (SVG): cuadrícula 21×21 de cuadros negros/blancos generada de forma **determinista** a partir de `qrValue` (por ejemplo, con un hash simple del texto), más los tres cuadros de esquina clásicos (superior izq., superior der., inferior izq.). **Debe verse como un QR pero NO pretende ser escaneable**; añade `// TODO(BACKEND): QR real`.

## A3. Estructura móvil (SIN barra inferior en móvil)

1. `PageHeader title="Recoger pedido"`.
2. `Chip variant="status" tone="green"` texto `¡Tu calzado está listo!`, centrado (margen superior 16px).
3. Título centrado `Muestra este código en el taller` (`title-page` 20px, Poppins 600, margen superior 12px).
4. **Tarjeta QR:** `Card` blanca centrada, padding 16px, ancho 200px (`radius-lg`), con `QrPlaceholder` 168×168 (módulos color `#2B1D14`, es decir `color-text`).
5. Texto centrado `o dicta el PIN de entrega` (12px, muted, margen superior 12px).
6. **PIN:** 4 cajas en fila centrada (gap 12px), cada una 44×52, fondo blanco, borde `color-border`, `radius-sm`, número 22px (Poppins 600), valores `8` `3` `5` `1`. Son `<span>` de solo lectura (no inputs). Con `aria-label="PIN de entrega 8 3 5 1"` en el contenedor.
7. **Tarjeta del taller** (`Card`, padding 12px, fila, margen superior 16px): icono `map-pin` (18px, `color-teal`); columna con `Talabartería Don Chucho` (14px/600) y `C. 62 #512, Centro · Abierto hasta 7 pm` (11px, muted).
8. `StickyActionBar` con `Button variant="teal" fullWidth leftIcon="map-pin"` texto `Cómo llegar` → abre en pestaña nueva (`target="_blank" rel="noopener noreferrer"`) `https://www.google.com/maps/search/?api=1&query=` + `encodeURIComponent(mapsQuery)`.

## A4. Responsive Parte A
- **Tablet:** contenedor 720px.
- **Escritorio:** columna centrada `max-width: 480px` dentro de `<main>`; QR 220×220 en tarjeta de 260px; `Cómo llegar` ancho completo de esa columna (no fijo).

---

# PARTE B — CALIFICAR EXPERIENCIA (`RatingScreen`, ruta `/pedido/:pedidoId/calificar`)

## B1. Usa
`AppShell activeNav="pedidos" hideNavOnMobile`, `Rating interactive`, `Chip`, `TextArea`, `Button`, `StickyActionBar`, iconos `x`, `check`.

## B2. Estado local (frontend permitido)
```
stars: number           // inicia 4
tags: string[]          // inicia ["Puntual","Buen acabado"]
review: string          // inicia ""
```
Etiqueta bajo estrellas según `stars`: 1=`Muy mal`, 2=`Mal`, 3=`Regular`, 4=`Muy bien`, 5=`Excelente`.

## B3. Estructura móvil (SIN barra inferior en móvil)

1. **Cabecera:** fila; título `Califica tu experiencia` (`section` 16px/600) **alineado a la izquierda**; a la derecha botón `x` (36×36, `aria-label="Cerrar"`) → navega a `/pedidos`.
2. **Círculo de éxito:** centrado, 96×96, fondo `color-teal-soft`, círculo interior opcional; icono `check` 40px `color-teal` (margen superior 24px).
3. Título centrado `Entrega confirmada` (`title-page` 20px, margen superior 16px).
4. Subtítulo centrado `¿Cómo te fue con Talabartería Don Chucho?` (12px, muted).
5. **Estrellas:** `Rating interactive size=36 value={stars}` centradas, gap 8px (margen superior 16px). Con 4 → 4 llenas + 1 vacía.
6. Etiqueta centrada (`Muy bien` para 4) 14px/600 (`color-text`), margen superior 8px.
7. **Chips de etiqueta** (fila centrada, wrap, gap 8px, margen superior 16px), `Chip variant="filter"` multi-selección, en este orden: `Puntual`, `Buen acabado`, `Buen trato`, `Buen precio`. Activos al inicio: `Puntual` y `Buen acabado`.
8. `TextArea rows={4} placeholder="Escribe una reseña (opcional)"` (margen superior 16px).
9. `StickyActionBar` con `Button variant="primary" fullWidth` texto `Enviar calificación` → llama `onSubmitRating({stars,tags,review})` (`// TODO(BACKEND)`; si existe lógica Nivel 1 de calificar, úsala) y navega a `/pedidos`.

## B4. Responsive Parte B
- **Tablet:** contenedor 720px.
- **Escritorio:** se muestra como **tarjeta modal centrada** (`max-width: 480px`, padding 32px, `radius-lg`, fondo blanco, borde `color-border`) dentro de `<main>`, centrada horizontal y con `margin-top: 48px`. `Enviar calificación` en el flujo, ancho completo de la tarjeta.

---

## 5. Criterios de aceptación
- [ ] Parte A textos exactos: `Recoger pedido`, `¡Tu calzado está listo!`, `Muestra este código en el taller`, `o dicta el PIN de entrega`, PIN `8 3 5 1`, `Talabartería Don Chucho`, `C. 62 #512, Centro · Abierto hasta 7 pm`, `Cómo llegar`.
- [ ] `Cómo llegar` abre Google Maps en pestaña nueva.
- [ ] Parte B textos exactos: `Califica tu experiencia`, `Entrega confirmada`, `¿Cómo te fue con Talabartería Don Chucho?`, `Muy bien`, `Puntual`, `Buen acabado`, `Buen trato`, `Buen precio`, `Escribe una reseña (opcional)`, `Enviar calificación`.
- [ ] Click en estrella cambia valor y la etiqueta; chips se activan/desactivan individualmente.
- [ ] `x` y `Enviar calificación` → `/pedidos`.
- [ ] Sin barra inferior en móvil en ambas pantallas. Build/lint sin errores.

## 6. Cierre de fase (EXACTO)
1. `PROGRESO.md`: marca `[x] Fase 10`. Añade filas a `LOGICA_DETECTADA.md`.
2.
```
git add -A
git commit -m "feat(frontend): fase 10 - recoger pedido y calificacion"
git push
```
3. `git status` limpio → continúa con `11_FASE_MIS_PEDIDOS_Y_REVISION.md`.
