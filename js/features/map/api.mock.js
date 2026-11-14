// Simulado en memoria de api.js del mapa (CU-02). Misma forma de respuesta y de errores que el real.
// La sesión (rol, activo, sesión) es la compartida de requests/simulacion.js: por defecto un cliente activo.
import { ApiError } from "../../lib/apiError.js";
import { exigirUuid } from "../requests/validar.js";
import { ID_TALLER_SIMULADO, estado, reiniciarSimulacion as reiniciarSesion } from "../requests/simulacion.js";
import { distanciaKm, estaAbierto, validarFiltros, validarUbicacion } from "./validar.js";

export { fijarSesionSimulada } from "../requests/simulacion.js";

/**
 * @typedef {{ id: string, name: string, address: string, colonia: string, postal_code: string | null, lat: number, lng: number, services: ("repair" | "cleaning")[], hours: import("../workshop/validar.js").Horario, price_from: number, rating_avg: number | null, rating_count: number, published: boolean, suspended: boolean, photos: { id: string, path: string, kind: "profile" | "work", sort: number }[] }} TallerSim
 */

const URL_FOTOS = "https://simulado.mixanab.test/workshop-photos/";
const TODO_EL_DIA = [{ open: "00:00", close: "23:59" }];
const SEMANA = /** @type {const} */ (["mon", "tue", "wed", "thu", "fri", "sat", "sun"]);

/**
 * @param {string[]} dias
 * @param {{ open: string, close: string }[]} rangos
 */
function horario(dias, rangos) {
  return Object.fromEntries(dias.map((d) => [d, rangos]));
}

/**
 * @param {string} sufijo
 * @returns {string} uuid simulado de taller
 */
const idTaller = (sufijo) => `00000000-0000-4000-8000-0000000000${sufijo}`;

/** @returns {TallerSim[]} talleres de muestra en Mérida (el primero es el taller de los demás simulados) */
function talleresIniciales() {
  const foto = (/** @type {string} */ id, /** @type {"profile" | "work"} */ kind, /** @type {number} */ sort) => ({
    id: `${id}-f${sort}`,
    path: `${id}/${kind}-${sort}`,
    kind,
    sort,
  });
  return [
    {
      id: ID_TALLER_SIMULADO,
      name: "Calzado El Buen Paso",
      address: "Calle 60 #500, Centro",
      colonia: "Centro",
      postal_code: "97000",
      lat: 20.9674,
      lng: -89.5926,
      services: ["repair", "cleaning"],
      hours: horario(["mon", "tue", "wed", "thu", "fri"], [{ open: "09:00", close: "18:00" }]),
      price_from: 120,
      rating_avg: 4.8,
      rating_count: 25,
      published: true,
      suspended: false,
      photos: [foto(ID_TALLER_SIMULADO, "profile", 0), foto(ID_TALLER_SIMULADO, "work", 1)],
    },
    {
      id: idTaller("a2"),
      name: "Talabartería Yucatán",
      address: "Calle 21 #100, García Ginerés",
      colonia: "García Ginerés",
      postal_code: "97070",
      lat: 20.9812,
      lng: -89.6329,
      services: ["repair"],
      hours: horario([...SEMANA], TODO_EL_DIA),
      price_from: 80,
      rating_avg: 4.2,
      rating_count: 10,
      published: true,
      suspended: false,
      photos: [foto(idTaller("a2"), "profile", 0)],
    },
    {
      id: idTaller("a3"),
      name: "Limpieza de Tenis Itzimná",
      address: "Calle 32 #200, Itzimná",
      colonia: "Itzimná",
      postal_code: "97100",
      lat: 21.0014,
      lng: -89.6001,
      services: ["cleaning"],
      hours: horario(["sat", "sun"], [{ open: "10:00", close: "14:00" }]),
      price_from: 150,
      rating_avg: null,
      rating_count: 0,
      published: true,
      suspended: false,
      photos: [],
    },
    {
      id: idTaller("a4"),
      name: "Zapatería Montejo",
      address: "Av. Montejo #10, Francisco de Montejo",
      colonia: "Francisco de Montejo",
      postal_code: "97203",
      lat: 21.0345,
      lng: -89.6502,
      services: ["repair", "cleaning"],
      hours: horario([...SEMANA], []),
      price_from: 200,
      rating_avg: 3.9,
      rating_count: 4,
      published: true,
      suspended: false,
      photos: [],
    },
    {
      id: idTaller("a5"),
      name: "Taller Oculto (suspendido)",
      address: "Calle 10 #1, Santa Ana",
      colonia: "Santa Ana",
      postal_code: "97000",
      lat: 20.9601,
      lng: -89.6188,
      services: ["repair", "cleaning"],
      hours: horario([...SEMANA], TODO_EL_DIA),
      price_from: 90,
      rating_avg: 5,
      rating_count: 3,
      published: true,
      suspended: true,
      photos: [],
    },
  ];
}

let talleres = talleresIniciales();

/** Reinicia la sesión y los talleres de muestra (para pruebas). */
export function reiniciarSimulacion() {
  reiniciarSesion();
  talleres = talleresIniciales();
}

/**
 * Sustituye los talleres simulados (para pruebas).
 * @param {TallerSim[]} lista
 */
export function fijarTalleresSimulados(lista) {
  talleres = lista;
}

/** Cliente activo con sesión (igual que las funciones SQL: inactive_user antes que forbidden). */
function exigirClienteActivo() {
  if (!estado.sesion) throw new ApiError("not_authenticated");
  if (!estado.activo) throw new ApiError("inactive_user");
  if (estado.rol !== "client") throw new ApiError("forbidden");
}

/** @param {string} path */
const urlFoto = (path) => `${URL_FOTOS}${path}`;

/**
 * Campos públicos del taller (sin owner_id, published ni suspended).
 * @param {TallerSim} t
 * @param {{ lat: number, lng: number } | null} origen
 */
function aTallerBase(t, origen) {
  return {
    id: t.id,
    name: t.name,
    address: t.address,
    colonia: t.colonia,
    postal_code: t.postal_code,
    lat: t.lat,
    lng: t.lng,
    services: [...t.services],
    hours: JSON.parse(JSON.stringify(t.hours)),
    price_from: t.price_from,
    rating_avg: t.rating_avg,
    rating_count: t.rating_count,
    distance_km: origen ? distanciaKm(origen.lat, origen.lng, t.lat, t.lng) : null,
    is_open: estaAbierto(t.hours),
  };
}

/**
 * Busca talleres publicados y no suspendidos. Mismo orden que la función SQL: con ubicación por cercanía;
 * sin ella por calificación; luego por número de reseñas y nombre.
 * @param {import("./validar.js").FiltrosBusqueda} filtros
 */
export async function searchWorkshops(filtros) {
  const p = validarFiltros(filtros);
  exigirClienteActivo();
  const origen = p.p_lat === null || p.p_lng === null ? null : { lat: p.p_lat, lng: p.p_lng };
  const colonia = p.p_colonia?.toLowerCase() ?? null;

  const filas = talleres
    .filter((t) => t.published && !t.suspended)
    .filter((t) => t.services.includes(/** @type {"repair" | "cleaning"} */ (p.p_service)))
    .filter((t) => colonia === null || t.colonia.toLowerCase().includes(colonia))
    .filter((t) => p.p_postal_code === null || t.postal_code === p.p_postal_code)
    .filter((t) => p.p_min_rating === null || (t.rating_avg !== null && t.rating_avg >= p.p_min_rating))
    .filter((t) => p.p_max_price === null || t.price_from <= p.p_max_price)
    .map((t) => ({ t, base: aTallerBase(t, origen) }))
    .filter(({ base }) => p.p_max_distance_km === null || (base.distance_km !== null && base.distance_km <= p.p_max_distance_km))
    .filter(({ base }) => !p.p_open_now || base.is_open);

  filas.sort((a, b) => {
    if (origen) {
      const porDistancia = /** @type {number} */ (a.base.distance_km) - /** @type {number} */ (b.base.distance_km);
      if (porDistancia !== 0) return porDistancia;
    }
    const porRating = (b.t.rating_avg ?? -1) - (a.t.rating_avg ?? -1);
    if (porRating !== 0) return porRating;
    return b.t.rating_count - a.t.rating_count || a.t.name.localeCompare(b.t.name) || a.t.id.localeCompare(b.t.id);
  });

  return filas.slice(p.p_offset, p.p_offset + p.p_limit).map(({ t, base }) => {
    const perfil = t.photos.find((f) => f.kind === "profile");
    return { ...base, profile_photo_url: perfil ? urlFoto(perfil.path) : null };
  });
}

/**
 * Perfil del taller: la foto de perfil primero y luego los trabajos, del más reciente al más antiguo (mayor `sort`).
 * @param {string} workshopId
 * @param {{ lat: number, lng: number }} [ubicacion]
 */
export async function getWorkshopProfile(workshopId, ubicacion) {
  exigirUuid(workshopId);
  const { p_lat, p_lng } = validarUbicacion(ubicacion);
  exigirClienteActivo();
  const taller = talleres.find((t) => t.id === workshopId && t.published && !t.suspended);
  if (!taller) throw new ApiError("not_found");
  const origen = p_lat === null || p_lng === null ? null : { lat: p_lat, lng: p_lng };
  const fotos = [...taller.photos].sort((a, b) => Number(b.kind === "profile") - Number(a.kind === "profile") || b.sort - a.sort);
  return { ...aTallerBase(taller, origen), photos: fotos.map((f) => ({ ...f, url: urlFoto(f.path) })) };
}
