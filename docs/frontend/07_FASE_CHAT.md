# FASE 07 / 11 — CHAT (`ChatScreen`, ruta `/chat/:pedidoId`)

> **DOCS EXISTENTES:** antes de empezar relee `docs/contrato-api.md`, `docs/diseno.md`, `docs/requisitos.md` y `docs/decisiones/*`. Respétalos (ver sección 1.1 de `00_LEEME_PRIMERO.md`). Los nombres de campo de tus mocks deben coincidir con `contrato-api.md`.

> Inicio de fase: rama `feature/frontend`, `git status` vacío, commit de fase 06 presente.
> Procedimiento de lógica (sección 5 de `00`) y filas en `LOGICA_DETECTADA.md`.
> El envío/recepción real de mensajes y fotos es **Nivel 3**. Si ya existe un servicio de chat (Nivel 1), conéctalo.

## 1. Usa
`AppShell activeNav="pedidos" hideNavOnMobile`, `Avatar`, `Card`, `ImagePlaceholder`, `Chip`, `Button`, iconos `chevron-left`, `camera`, `send`.

## 2. Mock (Nivel 2) — `src/mocks/chat.ts`
```
header   = { initials: "DC", name: "Don Chucho", status: "En línea" }
context  = { requestId: "1042", item: "Botas café", service: "Reparación" }
messages = [
  { id: 1, from: "me",   type: "text",  text: "Hola, ¿la suela se puede pegar o hay que cambiarla?", time: "10:21" },
  { id: 2, from: "them", type: "text",  text: "Por las fotos conviene cambiarla. ¿Me compartes una foto de la planta?", time: "10:24" },
  { id: 3, from: "me",   type: "image", time: "" },
  { id: 4, from: "them", type: "text",  text: "Perfecto, te mando el presupuesto en un momento.", time: "10:30" },
  { id: 5, from: "them", type: "quote", amount: "$450 MXN", delivery: "Entrega: 18 nov" }
]
```
`// TODO(BACKEND): reemplazar por lógica real`.

## 3. Estructura móvil (SIN barra inferior de navegación; el chat usa pantalla completa)

1. **Cabecera** (fija arriba, fondo `color-bg`, borde inferior `color-border`, padding 12px 16px, fila): botón atrás (`chevron-left`, `aria-label="Volver"`) → `Avatar initials="DC" size=36` → columna con `Don Chucho` (14px/600) y debajo `En línea` (11px, `color-green-text`).
2. **Tarjeta de contexto** (primer elemento del área de mensajes, `Card tone="amber-soft"`, padding 10px, fila, sin borde marcado): `ImagePlaceholder` 32×32; columna con `Solicitud #1042` (11px, muted) y `Botas café · Reparación` (13px/500).
3. **Área de mensajes:** columna con scroll vertical, padding 16px, gap 12px. Se hace scroll al final al abrir.
   - **Mensaje mío (`from: me`, tipo texto):** alineado a la DERECHA, burbuja fondo `color-primary`, texto blanco 14px, padding 10px 14px, radio 16px (esquina inferior derecha 4px), ancho máx. 75%. Hora debajo alineada a la derecha, 10px, `color-text-subtle`.
   - **Mensaje de ellos (`from: them`, texto):** alineado a la IZQUIERDA, burbuja fondo blanco, borde `color-border`, texto `color-text`, radio 16px (esquina inferior izquierda 4px), ancho máx. 75%. Hora debajo a la izquierda.
   - **Imagen mía (`type: image`):** a la DERECHA, `ImagePlaceholder` 110×80 con `radius-md`.
   - **Tarjeta de presupuesto (`type: quote`):** a la izquierda, ancho 220px, `Card` con borde `1.5px solid color-teal`, padding 12px: `Chip variant="status" tone="teal"` texto `Presupuesto`; debajo `$450 MXN` (20px, Poppins 600); debajo `Entrega: 18 nov` (12px, muted); debajo `Button variant="teal" fullWidth` texto `Ver presupuesto` (altura 36px) → navega a `/pedido/1042/presupuesto`.
4. **Barra de escritura** (fija abajo, fondo blanco, borde superior, padding 12px 16px + safe-area, fila gap 8px): botón icono `camera` (40×40, sin borde, `color-text-muted`, `aria-label="Adjuntar foto"`, abre `<input type="file" accept="image/*" hidden>`; la subida real es Nivel 3); `<input>` redondeado (`radius-full`, alto 40px, borde, placeholder `Escribe un mensaje`); botón enviar circular 40×40 fondo `color-primary` con icono `send` blanco, `aria-label="Enviar"`.
   - Comportamiento frontend permitido: al enviar con texto no vacío, agrega localmente el mensaje a la lista (con hora actual `HH:MM`) y limpia el input. Marca con `// TODO(BACKEND): enviar mensaje real`. Si hay servicio de chat Nivel 1, úsalo en lugar de agregar localmente.

## 4. Responsive
- **Tablet:** contenedor 720px centrado, mensajes ancho máx. 70%.
- **Escritorio:** dentro de `<main>` el chat es una tarjeta centrada (`max-width: 760px`, alto `calc(100vh - 64px)`, `radius-lg`, borde `color-border`, fondo `color-bg`) con la misma cabecera, área de mensajes y barra de escritura **dentro** de la tarjeta (no fijas a la ventana, sino a la tarjeta). La `SideNav` permanece a la izquierda con `Pedidos` activo.

## 5. Criterios de aceptación
- [ ] Textos exactos: `Don Chucho`, `En línea`, `Solicitud #1042`, `Botas café · Reparación`, los 3 textos de mensajes, horas `10:21`, `10:24`, `10:30`, `Presupuesto`, `$450 MXN`, `Entrega: 18 nov`, `Ver presupuesto`, `Escribe un mensaje`.
- [ ] Burbujas: propias a la derecha (café), ajenas a la izquierda (blanco).
- [ ] `Ver presupuesto` → `/pedido/1042/presupuesto`. Atrás regresa.
- [ ] La barra de escritura nunca tapa mensajes ni sale de pantalla en 360px.
- [ ] Build/lint sin errores.

## 6. Cierre de fase (EXACTO)
1. `PROGRESO.md`: marca `[x] Fase 07`. Añade filas a `LOGICA_DETECTADA.md`.
2.
```
git add -A
git commit -m "feat(frontend): fase 07 - chat"
git push
```
3. `git status` limpio → continúa con `08_FASE_PRESUPUESTO.md`.
