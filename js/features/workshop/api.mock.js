// Simulado en memoria de api.js (CU-07). Misma forma de respuesta y de errores que el real.
// Por defecto la sesión simulada es de un artesano activo; `fijarSesionSimulada` cambia eso (solo para pruebas).
import { ApiError } from "../../lib/apiError.js";
import { validarImagen } from "../../lib/validate.js";
import { camposFaltantes, validarDatosTaller } from "./validar.js";

const UID_SIMULADO = "00000000-0000-4000-8000-000000000002";
const ID_TALLER = "00000000-0000-4000-8000-0000000000a1";
const MAX_FOTOS_TRABAJO = 10;
const TIPOS_FOTO = /** @type {ReadonlyArray<string>} */ (["profile", "work"]);

let contadorIds = 0;

/** @returns {string} uuid simulado (sin depender de crypto) */
function idSimulado() {
  contadorIds += 1;
  return `00000000-0000-4000-8000-${String(contadorIds).padStart(12, "0")}`;
}

/** @type {{ sesion: boolean, rol: string | null, activo: boolean, taller: any, fotos: any[] }} */
let estado = estadoInicial();

/** @returns {typeof estado} */
function estadoInicial() {
  return { sesion: true, rol: "craftsman", activo: true, taller: null, fotos: [] };
}

/** Reinicia el estado (para pruebas). */
export function reiniciarSimulacion() {
  estado = estadoInicial();
}

/**
 * Cambia la sesión simulada (para pruebas): rol `client`, `craftsman`, `admin` o null (sin rol); `sesion: false` = anónimo.
 * @param {{ sesion?: boolean, rol?: string | null, activo?: boolean }} cambios
 */
export function fijarSesionSimulada(cambios) {
  Object.assign(estado, cambios);
}

function exigirSesion() {
  if (!estado.sesion) throw new ApiError("not_authenticated");
}

function exigirArtesano() {
  exigirSesion();
  if (!estado.activo) throw new ApiError("inactive_user");
  if (estado.rol !== "craftsman") throw new ApiError("forbidden");
}

/** @returns {any[]} */
function fotosOrdenadas() {
  return estado.fotos.slice().sort((a, b) => a.sort - b.sort).map((f) => ({ ...f, url: `https://simulado.local/workshop-photos/${f.path}` }));
}

/** @returns {any} */
function tallerCompleto() {
  return { ...estado.taller, photos: fotosOrdenadas() };
}

export async function getMyWorkshop() {
  exigirSesion();
  // Un cliente o un admin no tienen taller propio: RLS devuelve vacío.
  if (estado.rol !== "craftsman" || !estado.taller) return null;
  return tallerCompleto();
}

/** @param {import("./validar.js").DatosTaller} datos */
export async function saveMyWorkshop(datos) {
  exigirSesion();
  const fila = validarDatosTaller(datos);
  exigirArtesano();
  estado.taller ??= {
    id: ID_TALLER,
    owner_id: UID_SIMULADO,
    name: null,
    address: null,
    colonia: null,
    postal_code: null,
    lat: null,
    lng: null,
    services: [],
    hours: null,
    price_from: null,
    published: false,
    suspended: false,
    rating_avg: null,
    rating_count: 0,
  };
  const propuesto = { ...estado.taller, ...fila };
  // Igual que el CHECK de la base: un taller publicado no puede quedar incompleto.
  if (propuesto.published && camposFaltantes(propuesto).length > 0) throw new ApiError("invalid_input");
  estado.taller = propuesto;
  return tallerCompleto();
}

export async function publishMyWorkshop() {
  exigirArtesano();
  if (!estado.taller) throw new ApiError("not_found");
  if (estado.taller.suspended) throw new ApiError("forbidden");
  const missing = camposFaltantes(estado.taller);
  if (missing.length > 0) return { published: false, missing };
  estado.taller.published = true;
  return { published: true, missing: /** @type {string[]} */ ([]) };
}

export async function unpublishMyWorkshop() {
  exigirArtesano();
  if (!estado.taller) throw new ApiError("not_found");
  estado.taller.published = false;
  return { published: /** @type {const} */ (false), missing: /** @type {string[]} */ ([]) };
}

/**
 * @param {{ type: string, size: number }} archivo
 * @param {"profile" | "work"} kind
 */
export async function addWorkshopPhoto(archivo, kind) {
  if (!TIPOS_FOTO.includes(kind) || !validarImagen(archivo).valido) throw new ApiError("invalid_input");
  exigirArtesano();
  if (!estado.taller) throw new ApiError("not_found");
  if (kind === "profile") {
    estado.fotos = estado.fotos.filter((f) => f.kind !== "profile");
  } else if (estado.fotos.filter((f) => f.kind === "work").length >= MAX_FOTOS_TRABAJO) {
    throw new ApiError("limit_reached");
  }
  const orden = estado.fotos.reduce((max, f) => Math.max(max, f.sort), -1) + 1;
  const id = idSimulado();
  const foto = { id, path: `${estado.taller.id}/${idSimulado()}`, kind, sort: orden };
  estado.fotos.push(foto);
  return { ...foto, url: `https://simulado.local/workshop-photos/${foto.path}` };
}

/** @param {string} photoId */
export async function removeWorkshopPhoto(photoId) {
  if (typeof photoId !== "string" || photoId.length === 0) throw new ApiError("invalid_input");
  exigirSesion();
  const indice = estado.fotos.findIndex((f) => f.id === photoId);
  if (estado.rol !== "craftsman" || indice === -1) throw new ApiError("not_found");
  estado.fotos.splice(indice, 1);
}
