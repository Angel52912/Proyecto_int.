# `apis/api-mixanab/orders/`

| Archivo | Contenido |
| --- | --- |
| `api.js` | Avance de fases, fotos de progreso, PIN/QR de entrega, reseñas y consultas de pedidos. |
| `api.mock.js` | Pedidos simulados; el artesano se activa con `fijarSesionSimulada({ rol: "craftsman" })`. |
| `validar.js` | Validaciones de fases, fotos y calificaciones. |

La verificación del PIN y las transiciones de fase son funciones SQL `security definer`,
no lógica del navegador. Contrato: CU-06 y CU-07 en
[`docs/contrato-api.md`](../../../docs/contrato-api.md).
