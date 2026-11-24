// Geocodificación con Nominatim (OpenStreetMap), en los dos sentidos:
// - al tocar el mapa, de punto a dirección;
// - al escribir dirección, colonia y C.P., de dirección a punto.
// Nominatim permite 1 petición por segundo: las peticiones se encolan y se memoizan.

/** @typedef {{ direccion: string, colonia: string, codigoPostal: string }} DireccionMapa */
/** @typedef {{ lat: number, lng: number }} Punto */

/** @type {Map<string, Promise<DireccionMapa | null>>} */
const cacheInversa = new Map();
/** @type {Map<string, Promise<Punto | null>>} */
const cacheDirecta = new Map();
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
 * Convierte la respuesta de `/search` al punto que debe mostrar el mapa.
 * @param {any} datos
 * @returns {Punto | null}
 */
export function puntoDeNominatim(datos) {
  const primero = Array.isArray(datos) ? datos[0] : datos;
  if (!primero) return null;
  const latTexto = texto(primero.lat);
  const lngTexto = texto(primero.lon ?? primero.longitude);
  if (!latTexto || !lngTexto) return null;
  const lat = Number(latTexto);
  const lng = Number(lngTexto);
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
}

/** @param {string} url @returns {Promise<any>} */
async function pedirJson(url) {
  const control = new AbortController();
  const temporizador = setTimeout(() => control.abort(), 8000);
  try {
    const respuesta = await fetch(url, { signal: control.signal, headers: { Accept: "application/json" } });
    return respuesta.ok ? await respuesta.json() : null;
  } finally {
    clearTimeout(temporizador);
  }
}

/**
 * Serializa las consultas para no pasar el límite de Nominatim y evita repetir la misma búsqueda.
 * @template T
 * @param {string} clave
 * @param {Map<string, Promise<T | null>>} cache
 * @param {string} url
 * @param {(datos: any) => T | null} convertir
 * @returns {Promise<T | null>}
 */
function enCola(clave, cache, url, convertir) {
  if (cache.has(clave)) return cache.get(clave);
  const promesa = cola
    .then(async () => {
      const espera = Math.max(0, INTERVALO_MS - (Date.now() - ultimaPeticion));
      if (espera > 0) await new Promise((resolver) => setTimeout(resolver, espera));
      ultimaPeticion = Date.now();
      return convertir(await pedirJson(url));
    })
    .catch(() => {
      cache.delete(clave);
      return null;
    });
  cache.set(clave, promesa);
  cola = promesa.then(() => undefined, () => undefined);
  return promesa;
}

/**
 * Devuelve la dirección asociada a un punto.
 * @param {Punto} punto
 * @returns {Promise<DireccionMapa | null>}
 */
export function reverseGeocode(punto) {
  const lat = Number(punto.lat.toFixed(5));
  const lng = Number(punto.lng.toFixed(5));
  const url = new URL("https://nominatim.openstreetmap.org/reverse");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("accept-language", "es");
  url.searchParams.set("countrycodes", "mx");
  url.searchParams.set("zoom", "18");
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lon", String(lng));
  return enCola(`inv:${lat},${lng}`, cacheInversa, url.toString(), direccionDeNominatim);
}

/**
 * Devuelve el punto de una dirección escrita por el artesano. Si Nominatim no encuentra el lugar,
 * devuelve null y el mapa se deja como estaba.
 * @param {DireccionMapa} campos
 * @returns {Promise<Punto | null>}
 */
export function geocodificarDireccion(campos) {
  const calle = texto(campos.direccion);
  const colonia = texto(campos.colonia);
  const codigoPostal = /(\d{5})/.exec(texto(campos.codigoPostal))?.[1] ?? "";
  if (calle.length < 5 || (!codigoPostal && colonia.length < 3)) return null;
  const consulta = [calle, colonia, codigoPostal && `C.P. ${codigoPostal}`, "Mérida", "Yucatán", "México"].filter(Boolean).join(", ");
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "1");
  url.searchParams.set("accept-language", "es");
  url.searchParams.set("countrycodes", "mx");
  url.searchParams.set("q", consulta);
  return enCola(`dir:${consulta.toLowerCase()}`, cacheDirecta, url.toString(), puntoDeNominatim);
}
