# `apis/` — capa de datos del navegador

Todo lo que llama a Supabase o simula su respuesta. No es un servidor propio: se ejecuta en
el navegador como módulos ES y la seguridad sigue viviendo en RLS y funciones SQL
([`../back/supabase/`](../back/supabase/README.md)).

## Qué hay aquí

| Ruta | Contenido |
| --- | --- |
| `config.js` | `SUPABASE_URL`, `SUPABASE_ANON_KEY` y `USAR_API_SIMULADA`. |
| `supabaseClient.js` | Cliente compartido de Supabase y lectura de sesión. |
| `lib/` | `ApiError` y validaciones compartidas del contrato. |
| [`api-inicio-sesion/`](api-inicio-sesion/README.md) | Google, código por correo, perfil y rol (CU-01). |
| [`api-mixanab/`](api-mixanab/README.md) | Mapa, solicitudes, chat, presupuestos, pedidos, taller y admin (CU-02 a CU-08). |

## Cómo se usa

Cada módulo de `front/js/features/<modulo>/` tiene un `index.js` que importa `api.js`
(real) o `api.mock.js` (simulado) según `USAR_API_SIMULADA`. Las pantallas solo ven la
forma descrita en [`docs/contrato-api.md`](../docs/contrato-api.md); no importan de `back/`.

- Con `USAR_API_SIMULADA = true` no se necesita Supabase: los mocks comparten estado en
  `api-mixanab/requests/simulacion.js`.
- Con `false`, las funciones reales usan el cliente de `supabaseClient.js`. La `anon key`
  es pública; la `service_role` nunca se pone aquí.
