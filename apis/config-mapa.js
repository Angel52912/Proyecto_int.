// Proveedor del mapa y de las direcciones (geocodificación). Ver docs/mapa-google.md.
//
// "osm": OpenStreetMap + Nominatim (sin llave). Es lo que usa la app si no hay llave de Google.
// "google": Google Maps (mapa, pines y direcciones). Necesita una llave del navegador restringida a tu dominio,
//           con "Maps JavaScript API" y "Geocoding API" activadas. La llave de Google va en el navegador, así que
//           SIEMPRE debe estar restringida por dominio (HTTP referrer) en Google Cloud Console.
export const PROVEEDOR_MAPA = "osm";

// Llave de Google Maps. Déjala vacía en el repositorio y ponla solo en tu copia local o en el servidor.
export const GOOGLE_MAPS_API_KEY = "";

// Id de mapa de Google (Map ID). Lo piden los pines personalizados; "DEMO_MAP_ID" sirve para probar.
// Para producción crea uno en Google Cloud Console → Google Maps Platform → Administración de mapas.
export const GOOGLE_MAPS_MAP_ID = "DEMO_MAP_ID";

/** @returns {boolean} true si la app debe usar Google Maps (proveedor "google" y hay llave). */
export function usaGoogleMaps() {
  return PROVEEDOR_MAPA === "google" && GOOGLE_MAPS_API_KEY.trim() !== "";
}
