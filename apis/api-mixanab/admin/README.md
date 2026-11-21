# `apis/api-mixanab/admin/`

| Archivo | Contenido |
| --- | --- |
| `api.js` | Panel y acciones de administración mediante funciones SQL `security definer`. |
| `api.mock.js` | Usuarios, talleres, reseñas y bitácora simulados. |
| `validar.js` | Validaciones de motivos y filtros del panel. |

El admin no lee chats ni fotos privadas; cada acción queda en `admin_actions`. Contrato:
CU-08 en [`docs/contrato-api.md`](../../../docs/contrato-api.md).
