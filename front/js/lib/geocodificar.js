// Geocodificación con Nominatim (OpenStreetMap), en los dos sentidos:
// - al tocar el mapa, de punto a dirección;
// - al escribir dirección, colonia y C.P., de dirección a punto.
// Nominatim permite 1 petición por segundo: las peticiones se encolan y se memoizan.

/** @typedef {{ direccion: string, colonia: string, codigoPostal: string }} DireccionMapa */
/** @typedef {{ lat: number, lng: number }} Punto */
/** @typedef {"encontrado" | "no_encontrado" | "incompleto" | "error"} Motivo */
/** @typedef {{ valor: any, motivo: Motivo }} Resultado */
/** @typedef {{ punto: Punto | null, categoria: string, tipo: string, nombre: string, cp: string }} DetalleLugar */
/** @typedef {{ punto: Punto, cp: string, fuerte: boolean }} CentroColonia */

/** @type {Map<string, Promise<Resultado>>} */
const cacheInversa = new Map();
/** @type {Map<string, Promise<Resultado>>} */
const cacheDirecta = new Map();
/** @type {Map<string, Promise<Resultado>>} */
const cacheColonia = new Map();
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
 * Quita lo que Nominatim no entiende en una búsqueda (#, "C.P.", espacios dobles).
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

/** @param {Punto} a @param {Punto} b @returns {number} */
const distancia = (a, b) => Math.hypot((a.lat - b.lat) * 111, (a.lng - b.lng) * 96);

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
  return detalleDeNominatim(datos).punto;
}

/**
 * Datos del mejor resultado: punto, tipo (calle, casa, colonia…) y C.P. cuando viene en el nombre.
 * @param {any} datos
 * @returns {DetalleLugar}
 */
export function detalleDeNominatim(datos) {
  const primero = Array.isArray(datos) ? datos[0] : datos;
  if (!primero) return { punto: null, categoria: "", tipo: "", nombre: "", cp: "" };
  const latTexto = typeof primero.lat === "number" ? String(primero.lat) : texto(primero.lat);
  const lngTexto = typeof primero.lon === "number" ? String(primero.lon) : texto(primero.lon ?? primero.longitude);
  const lat = Number(latTexto);
  const lng = Number(lngTexto);
  const nombre = texto(primero.display_name);
  return {
    punto: latTexto && lngTexto && Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null,
    categoria: texto(primero.category),
    tipo: texto(primero.type),
    nombre,
    cp: /\b(\d{5})\b/.exec(nombre)?.[1] ?? "",
  };
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
function urlDeConsulta(consulta) {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "5");
  url.searchParams.set("accept-language", "es");
  url.searchParams.set("countrycodes", "mx");
  url.searchParams.set("q", consulta);
  return url.toString();
}

/**
 * Búsqueda estructurada: respeta el nombre de la calle y el número aunque la colonia no esté en OSM.
 * No se mezcla `q` con parámetros estructurados porque Nominatim lo rechaza con HTTP 400.
 * @param {string} calle @param {string} numero @param {string} cp
 * @returns {string}
 */
function urlEstructurada(calle, numero, cp) {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "10");
  url.searchParams.set("accept-language", "es");
  url.searchParams.set("countrycodes", "mx");
  url.searchParams.set("street", calle);
  if (numero) url.searchParams.set("housenumber", numero);
  url.searchParams.set("city", "Mérida");
  url.searchParams.set("state", "Yucatán");
  url.searchParams.set("country", "México");
  if (cp) url.searchParams.set("postalcode", cp);
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
 * Separa "C. 62 #512" en calle "C. 62" y número "512" para la búsqueda estructurada.
 * @param {DireccionMapa} campos
 * @returns {{ calle: string, numero: string }}
 */
export function partesDeDireccion(campos) {
  const completa = limpiar(campos.direccion).split(",")[0].trim();
  const coincidencia = /^(.*?)\s+(\d+[A-Za-z]?)$/.exec(completa);
  return coincidencia
    ? { calle: coincidencia[1].trim(), numero: coincidencia[2] }
    : { calle: completa, numero: "" };
}

/**
 * Consulta de texto limpia, sin `#` ni `C.P.` (último recurso si la búsqueda estructurada falla).
 * @param {DireccionMapa} campos
 * @returns {string}
 */
export function consultaDeDireccion(campos) {
  return [limpiar(campos.direccion), limpiar(campos.colonia), /(\d{5})/.exec(limpiar(campos.codigoPostal))?.[1], "Mérida", "Yucatán", "México"]
    .filter(Boolean)
    .join(", ");
}

/**
 * Entre varios tramos de la misma calle elige el más cercano al centro de la colonia cuando
 * Nominatim la reconoce; si no la conoce, conserva el orden de Nominatim.
 * @param {any[]} resultados @param {CentroColonia | null} centro
 * @returns {DetalleLugar | null}
 */
export function elegirResultado(resultados, centro) {
  if (!resultados.length) return null;
  const lugares = resultados.map(detalleDeNominatim).filter((l) => l.punto !== null);
  if (!lugares.length) return null;
  if (!centro?.fuerte) return lugares[0];
  return lugares.slice().sort((a, b) => distancia(a.punto, centro.punto) - distancia(b.punto, centro.punto))[0];
}

/**
 * Obtiene el centro de la colonia. Si Nominatim la reconoce (como división administrativa, parque
 * o cementerio) sirve para elegir el tramo de calle más cercano; si es administrativa además aporta
 * su C.P. real (p. ej. "Fraccionamiento Altabrisa" es 97133).
 * @param {string} colonia
 * @returns {Promise<CentroColonia | null>}
 */
async function centroDeColonia(colonia) {
  if (colonia.length < 3) return null;
  const url = urlDeConsulta(`${colonia}, Mérida, Yucatán`);
  const { valor } = await enCola(`col:${colonia.toLowerCase()}`, cacheColonia, url, detalleDeNominatim);
  if (!valor?.punto) return null;
  return { punto: valor.punto, cp: valor.cp, fuerte: true };
}

/**
 * Devuelve el punto de una dirección escrita por el artesano. Si Nominatim no encuentra el lugar,
 * devuelve el motivo para que la pantalla pueda avisar. El mapa se deja como estaba.
 * @param {DireccionMapa} campos
 * @returns {Promise<{ punto: Punto | null, motivo: Motivo, categoria: string, tipo: string }>}
 */
export async function geocodificarDireccion(campos) {
  const { calle, numero } = partesDeDireccion(campos);
  const colonia = limpiar(campos.colonia);
  const cpUsuario = /(\d{5})/.exec(limpiar(campos.codigoPostal))?.[1] ?? "";
  if (calle.length < 5 || (!cpUsuario && colonia.length < 3)) {
    return { punto: null, motivo: /** @type {Motivo} */ ("incompleto"), categoria: "", tipo: "" };
  }

  const centro = await centroDeColonia(colonia);
  const cp = (centro?.fuerte && centro.cp) || cpUsuario;
  const buscarCalle = (/** @type {string} */ codigoPostal) => {
    const clave = `calle:${calle.toLowerCase()}|${numero}|${codigoPostal}|${centro?.fuerte ? "cerca" : "plano"}`;
    return enCola(clave, cacheDirecta, urlEstructurada(calle, numero, codigoPostal), (datos) =>
      elegirResultado(Array.isArray(datos) ? datos : [], centro),
    );
  };

  let resultado = await buscarCalle(cp);
  if (!resultado.valor && cp !== cpUsuario && cpUsuario) resultado = await buscarCalle(cpUsuario);

  if (!resultado.valor) {
    const consulta = consultaDeDireccion(campos);
    resultado = await enCola(`dir:${consulta.toLowerCase()}`, cacheDirecta, urlDeConsulta(consulta), detalleDeNominatim);
  }

  const lugar = resultado.valor;
  return {
    punto: lugar?.punto ?? null,
    motivo: lugar?.punto && resultado.motivo === "encontrado" ? "encontrado" : resultado.motivo === "error" ? "error" : "no_encontrado",
    categoria: lugar?.categoria ?? "",
    tipo: lugar?.tipo ?? "",
  };
}
