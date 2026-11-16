# FASE 08 / 11 — PRESUPUESTO (`BudgetScreen`, ruta `/pedido/:pedidoId/presupuesto`)

> **DOCS EXISTENTES:** antes de empezar relee `docs/contrato-api.md`, `docs/diseno.md`, `docs/requisitos.md` y `docs/decisiones/*`. Respétalos (ver sección 1.1 de `00_LEEME_PRIMERO.md`). Los nombres de campo de tus mocks deben coincidir con `contrato-api.md`.

> Inicio de fase: rama `feature/frontend`, `git status` vacío, commit de fase 07 presente.
> Procedimiento de lógica (sección 5 de `00`) y filas en `LOGICA_DETECTADA.md`.
> Aceptar/rechazar un presupuesto de verdad (y cualquier cobro) es **Nivel 3**. Los totales se muestran desde el mock; NO calcules con lógica de negocio.

## 1. Usa
`AppShell activeNav="pedidos" hideNavOnMobile`, `PageHeader`, `Card`, `ImagePlaceholder`, `Rating`, `Button`, `StickyActionBar`, iconos `calendar`, `clock`, `shield-check`.

## 2. Mock (Nivel 2) — `src/mocks/budget.ts`
```
budget = {
  workshopId: "don-chucho", workshopName: "Talabartería Don Chucho", rating: 4.9,
  title: "Cambio de suela y limpieza",
  description: "Suela de cuero nueva, costura reforzada y limpieza profunda con nutrición del cuero.",
  lines: [ { label: "Suela de cuero", amount: "$300" }, { label: "Limpieza y nutrición", amount: "$150" } ],
  total: "$450 MXN",
  delivery: "18 nov", time: "5 días",
  notice: "Pagas al recoger tu calzado, después de verificar la entrega."
}
```
Los importes son TEXTO ya formateado (no sumes en código). `// TODO(BACKEND)`.

## 3. Estructura móvil (SIN barra inferior en móvil)

1. `PageHeader title="Presupuesto"`.
2. **Tarjeta principal** (`Card`, padding 16px, margen superior 12px):
   - Fila taller: `ImagePlaceholder` 36×36; columna con `Talabartería Don Chucho` (14px/600) y fila `Rating value={5} size=11` + `4.9` (11px, muted).
   - Línea divisoria 1px `color-border` (margen vertical 12px).
   - Título `Cambio de suela y limpieza` (`section` 15px/600).
   - Descripción (12px, muted, margen superior 4px): `Suela de cuero nueva, costura reforzada y limpieza profunda con nutrición del cuero.`
   - Líneas de desglose (margen superior 12px): cada una en fila `justify-content: space-between`, 12px, texto izquierdo muted, importe derecho `color-text`: `Suela de cuero` — `$300`; `Limpieza y nutrición` — `$150`.
   - Línea divisoria.
   - Fila total: `Total` (12px, muted) a la izquierda y `$450 MXN` (16px, Poppins 600) a la derecha.
3. **Dos tarjetas pequeñas** (grid 2 columnas, gap 12px, margen superior 12px). Cada `Card` padding 12px, fila: icono (`calendar` / `clock`, 20px, `color-primary`) + columna con etiqueta (11px, muted) y valor (14px/600):
   - `Entrega` / `18 nov`
   - `Tiempo` / `5 días`
4. **Banner informativo** (margen superior 12px): fondo `color-teal-soft`, `radius-md`, padding 12px, fila: icono `shield-check` (18px, `color-teal`) + texto (12px, `color-teal`) `Pagas al recoger tu calzado, después de verificar la entrega.`
5. `StickyActionBar` con 2 botones en fila (gap 12px, cada uno `flex:1`):
   - `Button variant="outline"` texto `Rechazar` → llama `onReject` (`// TODO(BACKEND)`) y navega a `/chat/1042`.
   - `Button variant="primary"` texto `Aceptar` → llama `onAccept` (`// TODO(BACKEND)`) y navega a `/pedido/1042`.

## 4. Responsive
- **Tablet:** contenedor 720px.
- **Escritorio:** dentro de `<main>`, contenido en una columna centrada `max-width: 640px`; las dos tarjetas pequeñas siguen en 2 columnas; los botones (`StickyActionBar` estático) alineados a la derecha, cada uno ancho mínimo 160px.

## 5. Criterios de aceptación
- [ ] Textos y montos exactos: `$300`, `$150`, `$450 MXN`, `18 nov`, `5 días`, y el texto del banner.
- [ ] `Aceptar` → `/pedido/1042`; `Rechazar` → `/chat/1042`; atrás regresa.
- [ ] Sin barra inferior en móvil. Build/lint sin errores.

## 6. Cierre de fase (EXACTO)
1. `PROGRESO.md`: marca `[x] Fase 08`. Añade filas a `LOGICA_DETECTADA.md`.
2.
```
git add -A
git commit -m "feat(frontend): fase 08 - presupuesto"
git push
```
3. `git status` limpio → continúa con `09_FASE_SEGUIMIENTO_PEDIDO.md`.
