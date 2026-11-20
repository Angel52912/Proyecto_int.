# `apis/api-inicio-sesion/` — acceso (CU-01)

| Archivo | Contenido |
| --- | --- |
| `api.js` | Acceso real con Supabase: Google, OTP por correo, cierre de sesión, perfil y `set_my_role`. |
| `api.mock.js` | Misma forma de respuesta, sin Supabase; expone helpers para reiniciar la simulación. |
| `validar.js` | Validaciones del formulario de acceso y del perfil. |

Lo consume `front/js/features/auth/index.js`. El contrato está en
[`docs/contrato-api.md`](../../docs/contrato-api.md) (CU-01).
