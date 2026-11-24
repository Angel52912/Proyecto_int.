// Geocodificación con Nominatim (OpenStreetMap), en los dos sentidos:
// - al tocar el mapa, de punto a dirección;
// - al escribir dirección, colonia y C.P., de dirección a punto.
// Nominatim permite 1 petición por segundo: las peticiones se encolan y se memoizan.

/** @typedef {{ direccion: string, colonia: string, codigoPostal: string }} DireccionMapa */
/** @typedef {{ lat: number, lng: number }} Punto */
/** @typedef {"encontrado" | "no_encontrado" | "incompleto" | "error"} Motivo */
/** @typedef {{ valor: any, motivo: Motivo }} Resultado */

/** @type {Map<string, Promise<Resultado>>} */
const cacheInversa = new Map();
/** @type {Map<string, Promise<Resultado>>} */
const cacheDirecta = new Map();
/** @type {Promise<unknown>} */
let cola = Promise.resolve();
let ultimaPeticion = 0;
const INTERVALO_MS = 1100;
const TIEMPO_ESPERA_MS = 12000;

/**
 * @param {unknown} valor
 * @returns {string}
 */
const texto = (valor) => (typeof valor === "string" ? valor.trim() : "");

/**
 * Quita los caracteres que Nominatim no entiende en una búsqueda (#, "C.P.", espacios dobles).
 * @param {unknown} valor
 * @returns {string}
 */
function limpiar(valor) {
  return texto(valor)
    .replace(/#/g, " ")
    .replace(/\b(?:C\.?\s?P\.?|código\s+postal)\s*/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

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
  const latTexto = typeof primero.lat === "number" ? String(primero.lat) : texto(primero.lat);
  const lngTexto = typeof primero.lon === "number" ? String(primero.lon) : texto(primero.lon ?? primero.longitude);
  if (!latTexto || !lngTexto) return null;
  const lat = Number(latTexto);
  const lng = Number(lngTexto);
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
}

/** @param {string} url @returns {Promise<any>} */
async function pedirJson(url) {
  const control = new AbortController();
  const temporizador = setTimeout(() => control.abort(), TIEMPO_ESPERA_MS);
  try {
    const respuesta = await fetch(url, { signal: control.signal, headers: { Accept: "application/json" } });
    if (!respuesta.ok) throw new Error(`Nominatim respondió ${respuesta.status}`);
    return await respuesta.json();
  } finally {
    clearTimeout(temporizador);
  }
}

/**
 * Serializa las consultas para no pasar el límite de Nominatim y distingue "no encontrado" de error.
 * @template T
 * @param {string} clave
 * @param {Map<string, Promise<Resultado>>} cache
 * @param {string} url
 * @param {(datos: any) => T | null} convertir
 * @returns {Promise<Resultado>}
 */
function enCola(clave, cache, url, convertir) {
  if (cache.has(clave)) return cache.get(clave);
  const promesa = cola.then(async () => {
    const espera = Math.max(0, INTERVALO_MS - (Date.now() - ultimaPeticion));
    if (espera > 0) await new Promise((resolver) => setTimeout(resolver, espera));
    ultimaPeticion = Date.now();
    try {
      const valor = convertir(await pedirJson(url));
      return { valor, motivo: /** @type {Motivo} */ (valor ? "encontrado" : "no_encontrado") };
    } catch {
      // Un error de red o un timeout no se cachea, para poder reintentarlo.
      cache.delete(clave);
      return { valor: null, motivo: /** @type {Motivo} */ ("error") };
    }
  });
  cache.set(clave, promesa);
  cola = promesa.then(() => undefined, () => undefined);
  return promesa;
}

/** @param {string} consulta @returns {string} */
function urlDeBusqueda(consulta) {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "1");
  url.searchParams.set("accept-language", "es");
  url.searchParams.set("countrycodes", "mx");
  // Nominatim rechaza mezclar `q` con parámetros estructurados como `postalcode`.
  url.searchParams.set("q", consulta);
  return url.toString();
}

/**
 * Devuelve la dirección asociada a un punto, con el motivo si no se pudo completar.
 * @param {Punto} punto
 * @returns {Promise<{ direccion: DireccionMapa | null, motivo: Motivo }>}
 */
export async function reverseGeocodeDetallado(punto) {
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
  const { valor, motivo } = await enCola(`inv:${lat},${lng}`, cacheInversa, url.toString(), direccionDeNominatim);
  return { direccion: valor, motivo };
}

/**
 * Devuelve la dirección asociada a un punto (compatibilidad con el llamador anterior).
 * @param {Punto} punto
 * @returns {Promise<DireccionMapa | null>}
 */
export async function reverseGeocode(punto) {
  return (await reverseGeocodeDetallado(punto)).direccion;
}

/**
 * Consulta limpia que se envía a Nominatim. Sin `#` ni `C.P.`: esos caracteres hacen que la
 * búsqueda no devuelva resultados aunque la dirección exista.
 * @param {DireccionMapa} campos
 * @returns {string}
 */
export function consultaDeDireccion(campos) {
  return [limpiar(campos.direccion), limpiar(campos.colonia), /(\d{5})/.exec(limpiar(campos.codigoPostal))?.[1], "Mérida", "Yucatán", "México"]
    .filter(Boolean)
    .join(", ");
}

/**
 * Devuelve el punto de una dirección escrita por el artesano. Si Nominatim no encuentra el lugar,
 * devuelve el motivo para que la pantalla pueda avisar. El mapa se deja como estaba.
 * @param {DireccionMapa} campos
 * @returns {Promise<{ punto: Punto | null, motivo: Motivo }>}
 */
export async function geocodificarDireccion(campos) {
  const calle = limpiar(campos.direccion);
  const colonia = limpiar(campos.colonia);
  const codigoPostal = /(\d{5})/.exec(limpiar(campos.codigoPostal))?.[1] ?? "";
  if (calle.length < 5 || (!codigoPostal && colonia.length < 3)) {
    return { punto: null, motivo: /** @type {Motivo} */ ("incompleto") };
  }
  const consulta = consultaDeDireccion(campos);
  let resultado = await enCola(`dir:${consulta.toLowerCase()}`, cacheDirecta, urlDeBusqueda(consulta), puntoDeNominatim);
  if (resultado.motivo !== "no_encontrado") return { punto: resultado.valor, motivo: resultado.motivo };

  // Si el número de casa no está en OSM, se reintenta con la calle y la colonia.
  const calleBase = calle.replace(/\s+\d+[A-Za-z]?\s*$/, "").trim();
  if (calleBase && calleBase !== calle) {
    const consultaBase = [calleBase, colonia, codigoPostal, "Mérida", "Yucatán"].filter(Boolean).join(", ");
    resultado = await enCola(`dir:${consultaBase.toLowerCase()}`, cacheDirecta, urlDeBusqueda(consultaBase), puntoDeNominatim);
  }
  return { punto: resultado.valor, motivo: resultado.motivo };
}
