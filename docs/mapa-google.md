# Mapa con Google Maps

La app funciona con dos proveedores de mapa, que se eligen en `apis/config-mapa.js`:

| Proveedor | Mapa | Direcciones (geocodificación) | Llave |
|---|---|---|---|
| `"osm"` (por defecto) | OpenStreetMap con Leaflet | Nominatim | No |
| `"google"` | Google Maps | Geocoder de Google | Sí |

Sin llave de Google la app usa OpenStreetMap, aunque `PROVEEDOR_MAPA` diga `"google"`.

**Por qué Google:** en Mérida, OpenStreetMap tiene muchas calles sin número de casa y no entiende el formato
"Calle 60 x 57 y 59". Por eso las direcciones salían mal. Las condiciones de Google piden mostrar sus resultados en un
mapa de Google, así que con la llave cambian **el mapa y las direcciones** juntos.

## Pasos (los hace quien tenga la cuenta de Google)

1. Entra a [Google Cloud Console](https://console.cloud.google.com/) y crea un proyecto (por ejemplo, "MiXanab").
2. Activa la facturación del proyecto. Google pide una tarjeta aunque tiene un uso gratis cada mes; revisa la tabla de
   precios vigente de Google Maps Platform antes de publicar.
3. En **APIs y servicios → Biblioteca**, activa:
   - **Maps JavaScript API** (el mapa y los pines);
   - **Geocoding API** (dirección ↔ punto en Mi taller).
4. En **APIs y servicios → Credenciales**, crea una **clave de API** y **restríngela**, porque va en el navegador:
   - **Restricción de aplicación:** "Sitios web (referentes HTTP)", con tus dominios, por ejemplo
     `http://localhost:5500/*` para desarrollo y `https://tu-dominio/*` para producción.
   - **Restricción de API:** solo Maps JavaScript API y Geocoding API.
5. En **Google Maps Platform → Administración de mapas**, crea un **ID de mapa** de tipo JavaScript (vector o trama).
   Lo piden los pines personalizados. Para probar sirve `DEMO_MAP_ID`, que ya viene puesto.

## Dónde va la llave

En `apis/config-mapa.js` (en tu copia local o en el servidor, **no en el repositorio**):

```js
export const PROVEEDOR_MAPA = "google";
export const GOOGLE_MAPS_API_KEY = "tu-llave";
export const GOOGLE_MAPS_MAP_ID = "tu-id-de-mapa"; // o "DEMO_MAP_ID" para probar
```

Después corre `npm run cache:version`, porque el archivo es parte de la interfaz que guarda el service worker, y recarga
la página.

## Qué ya está listo en el código

- `front/js/lib/mapa-google.js`: carga Google Maps solo al abrir el primer mapa, no al arrancar la app.
  Ofrece las mismas funciones que Leaflet, así que Buscar, Inicio (mapa chico en PC), la ficha del taller y Mi taller
  no cambian.
- `front/js/lib/geocodificar.js`: con Google usa su Geocoder y devuelve los mismos datos (calle con número, colonia,
  C.P. y si ubicó el número exacto).
- `index.html`: la política de seguridad (CSP) ya permite los dominios de Google (`maps.googleapis.com`,
  `*.gstatic.com`, `*.google.com`, `*.ggpht.com` y las fuentes de Google).
- Si la llave falla o se acaba el saldo, el mapa muestra el aviso de Google y Mi taller dice "No se pudo consultar la
  dirección". La app no se rompe.

## Cómo comprobar que funciona

1. Abre Buscar: deben verse los pines sobre el mapa de Google.
2. En Mi taller, toca el mapa: la dirección, la colonia y el C.P. se completan solos.
3. Escribe una dirección (por ejemplo "Calle 60 #500", colonia "Centro"): el pin se mueve a ese punto.
4. En la consola del navegador no debe aparecer `InvalidKeyMapError`, `RefererNotAllowedMapError` ni
   `ApiNotActivatedMapError`. Si aparece alguno, revisa el paso 3 o 4.
