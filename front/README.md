# `front/` — interfaz de la PWA

Aquí vive **todo lo que se ve y ejecuta en el navegador**. Antes de esta reorganización,
estos archivos estaban en la raíz del repositorio (`index.html`, `css/`, `js/`, `icons/`,
`manifest.webmanifest` y `sw.js`).

## Qué hay aquí

| Ruta | Contenido |
| --- | --- |
| `index.html` | Entrada de la PWA; carga `css/` y `js/` con rutas **relativas**. |
| `manifest.webmanifest` | Configuración de instalación; íconos en `icons/`. |
| `sw.js` | Service worker: solo cachea la interfaz (nunca Supabase, tiles ni fotos). |
| `css/` | Tokens, componentes y una hoja por pantalla. |
| `icons/` | Íconos 192 y 512 px de la PWA. |
| `js/` | Router, configuración, `lib/`, `ui/` y `features/<modulo>/`. |
| `js/vendor/` | Generado por `npm run vendor` (no se versiona). |
| `tests/unit/` | Pruebas Jest/jsdom de la interfaz. |

## Qué NO hay aquí

- Migraciones SQL, `seed.sql` ni pruebas RLS: están en [`../back/`](../back/README.md).
- Configuración compartida (`package.json`, `jest.config.js`, `eslint.config.js`): está en la raíz.

## Cómo servirlo

Desde la raíz del repositorio: `npm run dev` → http://localhost:5500
(el script sirve esta carpeta, así que `index.html` queda en la raíz del sitio).

> `index.html`, `manifest.webmanifest` y `sw.js` usan rutas relativas: muévelos siempre
> juntos o habría que corregir sus rutas.
