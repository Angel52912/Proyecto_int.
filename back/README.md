# `back/` — base de datos y permisos

Aquí vive **la base de datos y su verificación**. Antes de esta reorganización, el SQL
estaba en `supabase/` y las pruebas de permisos en `tests/rls/` y `tests/helpers/`.

## Qué hay aquí

| Ruta | Contenido |
| --- | --- |
| [`supabase/`](supabase/README.md) | `migrations/` (SQL versionado, una migración por CU) y `seed.sql` (solo desarrollo/pruebas). |
| `tests/rls/` | Pruebas Jest de permisos por rol (cliente, artesano, admin, sin rol, anónimo). |
| `tests/helpers/` | `db.js` (transacciones, roles y Storage), `escenarios.js` (solicitudes y pedidos) y datos de `presupuestos.js`/`solicitudes.js`. |
| [`scripts/`](scripts/README.md) | `vendor.mjs`, usado por `npm run vendor` y por `postinstall`. |

## Qué NO hay aquí

- Pantallas, CSS ni módulos de interfaz: están en [`../front/`](../front/README.md).
- Los `api.js`/`api.mock.js` están en [`../apis/`](../apis/README.md): son el contrato que
  consume el navegador (la lógica sensible vive en funciones SQL de `supabase/`).
  `front/` nunca importa de `back/`.
- La `service_role`: nunca se guarda aquí ni en el frontend.

## Comandos

Ejecutar desde la raíz del repositorio:

```bash
npm run test:rls                       # pruebas de permisos (requiere TEST_DATABASE_URL o Supabase local)
npm run db:init                        # crea back/supabase/config.toml
npm run db:start                       # los scripts db:* working-directory = back/
npm run db:reset
npm run db:stop
```

Las migraciones **no se aplican** sin confirmación explícita y ninguna migración ya aplicada
se edita: se crea una nueva. `TEST_DATABASE_URL` debe apuntar siempre al proyecto de pruebas
(ver `tests/rls/ejemplo-env-pruebas.txt`).
