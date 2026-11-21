# `back/tests/` — verificación del backend

| Ruta | Contenido |
| --- | --- |
| `rls/` | Pruebas Jest de permisos por rol (cliente, artesano, admin, sin rol y anónimo), grants del esquema `private` y funciones `security definer`. |
| `helpers/` | Utilidades de base de datos: transacciones, roles y Storage, escenarios de solicitudes y pedidos, y datos de prueba. |

Se ejecutan con `npm run test:rls` desde la raíz y requieren `TEST_DATABASE_URL` o Supabase
local (Docker). Cada prueba revierte su transacción: nunca se ejecutan contra producción.
