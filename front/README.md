# `front/` — diseño e interfaz de la PWA

Todo lo que se ve y ejecuta en el navegador. El punto de entrada (`index.html`), el
`manifest.webmanifest` y el `sw.js` están en la [raíz](../README.md) para que el sitio se
sirva desde ahí; las librerías y los datos viven en `apis/`.

## Qué hay aquí

| Ruta | Contenido |
| --- | --- |
| `css/` | Tokens, componentes y una hoja por pantalla. |
| `fonts/` | Poppins (600 y 700) e Inter variable en `.woff2`, subconjunto latino (Fontsource, OFL). |
| `icons/` | Íconos 192 y 512 px de la PWA. |
| `js/app.js` | Arranque de la app y carga del cliente de Supabase. |
| `js/router.js` | Router por hash. |
| `js/ui/` | Componentes compartidos de interfaz (mensajes, sesión, `vista.js` para el alternador Android/PC de admin). |
| `js/features/auth/pages/portada.js` | Pantalla de inicio pública: logo, eslogan y acceso. |
| `js/features/<modulo>/` | `routes.js`, `index.js` (elige API real/simulada), `pages/`, `componentes.js` y lógica de presentación. |
| `js/lib/` | Utilidades de la interfaz (escape, fechas, imágenes, formato MXN y `geocodificar.js`). |
| `js/vendor/` | Generado por `npm run vendor`; no se versiona. |
| `tests/unit/` | Pruebas Jest/jsdom de la interfaz. |

## Qué NO hay aquí

- Los `api.js`, `api.mock.js`, `config.js`, `supabaseClient.js` ni las validaciones del
  contrato: están en [`../apis/`](../apis/README.md). Las pantallas los consumen mediante
  `front/js/features/<modulo>/index.js`.
- SQL, migraciones, RLS ni pruebas de permisos: están en [`../back/`](../back/README.md).
- Configuración de npm y de lint: está en la raíz.

## Rutas de la interfaz

| Ruta | Pantalla |
| --- | --- |
| `/`, `/inicio` | Inicio público: logo, “No lo tires, restáuralo.” y **Iniciar sesión**. |
| `/acceso` | Acceso: iniciar sesión, crear cuenta o continuar con Google; el cliente entra a `/principal`. |
| `/principal` | Pantalla principal del cliente: buscador, categorías, talleres y pedido en curso. |

El ancho y la navegación se adaptan a escritorio desde `css/layout.css`. El botón flotante
`js/ui/vista.js` solo aparece para `admin` y fuerza la vista Android o PC.

En **Tu taller**, al tocar el mapa se completa Dirección, Colonia y C.P. con la geocodificación
inversa de Nominatim (OpenStreetMap); al escribir esos campos se mueve el punto al lugar encontrado.
La búsqueda elimina `#` y `C.P.`, separa calle y número para usar la consulta estructurada de
Nominatim y consulta la colonia para obtener su C.P. real (p. ej. `Fraccionamiento Altabrisa` es
97133). Cuando Nominatim reconoce la colonia se elige el tramo de calle más cercano a su centro; si
OSM solo conoce la calle, el aviso indica que se ajuste el punto en el mapa. Si no hay
resultados, faltan datos o falla la petición, se muestra una alerta accesible bajo el mapa. La CSP
de `index.html` permite ese único origen externo en `connect-src`; las peticiones se encolan
(máximo 1 por segundo), se cachean por coordenada, colonia o consulta y las respuestas obsoletas
se descartan.

## Cómo servirlo

Desde la raíz: `npm run dev` → http://localhost:5500 (el servidor sirve la raíz, donde
está `index.html`).

> Al mover o renombrar un módulo hay que actualizar a la vez la lista `INTERFAZ` de
> `../sw.js`: si un archivo falta ahí, la PWA no funciona sin red.
>
> Después de cualquier cambio en la interfaz corre `npm run cache:version`: calcula
> `CACHE_VERSION` a partir del contenido de esos archivos para que los usuarios reciban la versión
> nueva. `npm test` falla (`sw-version.test.js`) si se olvida o si un archivo de `front/` no está
> en `INTERFAZ`.
