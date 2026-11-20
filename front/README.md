# `front/` — diseño e interfaz de la PWA

Todo lo que se ve y ejecuta en el navegador. El punto de entrada (`index.html`), el
`manifest.webmanifest` y el `sw.js` están en la [raíz](../README.md) para que el sitio se
sirva desde ahí; las librerías y los datos viven en `apis/`.

## Qué hay aquí

| Ruta | Contenido |
| --- | --- |
| `css/` | Tokens, componentes y una hoja por pantalla. |
| `icons/` | Íconos 192 y 512 px de la PWA. |
| `js/app.js` | Arranque de la app y carga del cliente de Supabase. |
| `js/router.js` | Router por hash. |
| `js/ui/` | Componentes compartidos de interfaz (mensajes, sesión, etc.). |
| `js/features/<modulo>/` | `routes.js`, `index.js` (elige API real/simulada), `pages/`, `componentes.js` y lógica de presentación. |
| `js/lib/` | Utilidades de la interfaz (escape, fechas, imágenes, formato MXN). |
| `js/vendor/` | Generado por `npm run vendor`; no se versiona. |
| `tests/unit/` | Pruebas Jest/jsdom de la interfaz. |

## Qué NO hay aquí

- Los `api.js`, `api.mock.js`, `config.js`, `supabaseClient.js` ni las validaciones del
  contrato: están en [`../apis/`](../apis/README.md). Las pantallas los consumen mediante
  `front/js/features/<modulo>/index.js`.
- SQL, migraciones, RLS ni pruebas de permisos: están en [`../back/`](../back/README.md).
- Configuración de npm y de lint: está en la raíz.

## Cómo servirlo

Desde la raíz: `npm run dev` → http://localhost:5500 (el servidor sirve la raíz, donde
está `index.html`).

> Al mover o renombrar un módulo hay que actualizar a la vez la lista `INTERFAZ` de
> `../sw.js`: si un archivo falta ahí, la PWA no funciona sin red.
