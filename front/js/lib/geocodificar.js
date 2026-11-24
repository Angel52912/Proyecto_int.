// Geocodificación inversa con Nominatim (OpenStreetMap). Solo se usa al marcar un punto en el mapa.
// Nominatim permite 1 petición/por segundo: las peticiones se encolan y se memoizan por coordenada.

/** @typedef {{ direccion: string, colonia: string, codigoPostal: string }} DireccionMapa */

/** @type {Map<string, Promise<DireccionMapa | null>>} */
const cache = new Map();
/** @type {Promise<unknown>} */
let cola = Promise.resolve();
let ultimaPeticion = 0;
const INTERVALO_MS = 1100;

/**
 * @param {unknown} valor
 * @returns {string}
 */
const texto = (valor) => (typeof valor === "string" ? valor.trim() : "");

/**
 * Convierte la respuesta de Nominatim a los campos del formulario. No inventa datos: si un campo
 * no viene en la respuesta queda vacío y el llamador conserva lo que ya escribió el artesano.
 * @param {any} datos
 * @returns {DireccionMapa | null}
 */
export function direccionDeNominatim(datos) {
  const direccion = datos?.address;
  if (typeof direccion !== "object" || direccion === null) return null;
  const calle = texto(direccion.road ?? direccion.pedestrian ?? direccion.footway);
  const numero = texto(direccion.house_number);
  const conNumero = calle && numero ? `${calle}${numero.startsWith("#") ? " " : " #"}${numero}` : calle;
  const colonia = texto(direccion.neighbourhood ?? direccion.suburb ?? direccion.city_district ?? direccion.quarter ?? direccion.residential);
  const codigoPostal = /(\d{5})/.exec(texto(direccion.postcode))?.[1] ?? "";
  if (!conNumero && !colonia && !codigoPostal) return null;
  return { direccion: conNumero, colonia, codigoPostal };
}

/**
 * Devuelve la dirección asociada a un punto. Las respuestas se cachean y se serializan para
 * respetar el límite de uso de Nominatim.
 * @param {{ lat: number, lng: number }} punto
 * @returns {Promise<DireccionMapa | null>}
 */
export function reverseGeocode(punto) {
  const lat = Number(punto.lat.toFixed(5));
  const lng = Number(punto.lng.toFixed(5));
  const clave = `${lat},${lng}`;
  if (cache.has(clave)) return cache.get(clave);

  const promesa = cola
    .then(async () => {
      const espera = Math.max(0, INTERVALO_MS - (Date.now() - ultimaPeticion));
      if (espera > 0) await new Promise((resolver) => setTimeout(resolver, espera));
      ultimaPeticion = Date.now();
      const url = new URL("https://nominatim.openstreetmap.org/reverse");
      url.searchParams.set("format", "jsonv2");
      url.searchParams.set("addressdetails", "1");
      url.searchParams.set("accept-language", "es");
      url.searchParams.set("countrycodes", "mx");
      url.searchParams.set("zoom", "18");
      url.searchParams.set("lat", String(lat));
      url.searchParams.set("lon", String(lng));
      const control = new AbortController();
      const temporizador = setTimeout(() => control.abort(), 8000);
      try {
        const respuesta = await fetch(url, { signal: control.signal, headers: { Accept: "application/json" } });
        if (!respuesta.ok) return null;
        return direccionDeNominatim(await respuesta.json());
      } finally {
        clearTimeout(temporizador);
      }
    })
    .catch(() => {
      cache.delete(clave);
      return null;
    });
  cache.set(clave, promesa);
  cola = promesa.then(() => undefined, () => undefined);
  return promesa;
}
