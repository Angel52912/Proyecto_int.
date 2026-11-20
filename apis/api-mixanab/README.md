# `apis/api-mixanab/` — APIs de MiXanab (CU-02 a CU-08)

Cada carpeta tiene `api.js` (Supabase) y `api.mock.js` (simulado); varias añaden
`validar.js`. Las pantallas las consumen a través de `front/js/features/<modulo>/index.js`.

| Carpeta | Caso de uso |
| --- | --- |
| [`map/`](map/README.md) | Buscar talleres y ver su perfil público (CU-02). |
| [`requests/`](requests/README.md) | Crear, listar y cancelar solicitudes con fotos (CU-03). |
| [`chat/`](chat/README.md) | Mensajes y notificaciones de una solicitud (CU-04). |
| [`quotes/`](quotes/README.md) | Enviar presupuestos y tarjetas de presupuesto (CU-05). |
| [`orders/`](orders/README.md) | Fases, fotos de avance, PIN/QR de entrega y reseñas (CU-06 y CU-07). |
| [`workshop/`](workshop/README.md) | Datos y fotos del taller del artesano (CU-07). |
| [`admin/`](admin/README.md) | Usuarios, talleres, reseñas y bitácora (CU-08). |

`requests/simulacion.js` guarda el estado compartido de los mocks (sesión, solicitudes,
pedidos y talleres). Contrato: [`docs/contrato-api.md`](../../docs/contrato-api.md).
