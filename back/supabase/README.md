# `back/supabase/` — base de datos (Supabase)

Esta es la **carpeta de la base de datos**. Antes estaba en la raíz como `supabase/`.

## Qué hay aquí

| Ruta | Contenido |
| --- | --- |
| `migrations/` | SQL versionado, una migración por caso de uso (`0001_base.sql`, `0002_profiles.sql`, …). |
| `seed.sql` | Datos de ejemplo. Solo se ejecuta en desarrollo y pruebas, **nunca en producción**. |
| `config.toml` | Lo genera `npm run db:init` (no está versionado). |

## Reglas

- Toda tabla y todo bucket de Storage con RLS activo; sin política = denegado.
- Lógica sensible (PIN de entrega, transiciones de fase, promedios) en funciones
  `security definer` con `search_path = ''`, nunca en el navegador.
- No editar migraciones ya aplicadas: crear una nueva.
- Solo Angel aplica migraciones, y siempre con confirmación previa.
- Nunca guardar la `service_role` aquí ni en ningún archivo del repositorio.

Las pruebas de estos permisos están en [`../tests/rls/`](../tests/rls/).
Visión general del backend: [`../README.md`](../README.md).
