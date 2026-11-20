# `back/scripts/` — utilidades de npm

| Archivo | Para qué sirve |
| --- | --- |
| `vendor.mjs` | Copia supabase-js, Leaflet y qrcode-generator desde `node_modules/` a `front/js/vendor/` para que la PWA no dependa de CDN. |

Se ejecuta automáticamente con `npm install` (`postinstall`) y con `npm run vendor` desde
la raíz del repositorio. `front/js/vendor/` no se versiona. Aquí no hay llaves ni secretos.
