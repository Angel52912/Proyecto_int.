// Validación y cálculos compartidos por api.js y api.mock.js (CU-02). Refleja la migración 0015.
import { ApiError } from "../../lib/apiError.js";
import { validarCoordenadas } from "../../lib/validate.js";
import { DIAS, SERVICIOS } from "../workshop/validar.js";

export const ZONA_HORARIA = "America/Merida";
export const LIMITE_POR_DEFECTO = 50;
export const LIMITE_MAXIMO = 100;
export const DISTANCIA_MAXIMA_KM = 500;

/**
 * @typedef {{ service: "repair" | "cleaning", lat?: number, lng?: number, max_distance_km?: number, colonia?: string, postal_code?: string, min_rating?: number, open_now?: boolean, max_price?: number, limit?: number, offset?: number }} FiltrosBusqueda
 * @typedef {{ p_service: string, p_lat: number | null, p_lng: number | null, p_max_distance_km: number | null, p_colonia: string | null, p_postal_code: string | null, p_min_rating: number | null, p_open_now: boolean, p_max_price: number | null, p_limit: number, p_offset: number }} ParametrosBusqueda
 */

/**
 * @param {unknown} valor
 * @returns {boolean}
 */
function esNumero(valor) {
  return typeof valor === "number" && Number.isFinite(valor);
}

/**
 * Valida los filtros (la categoría de servicio es obligatoria, paso 1 del CU) y los convierte en los parámetros de
 * `search_workshops`. Lanza invalid_input si algo no cumple.
 * @param {FiltrosBusqueda} filtros
 * @returns {ParametrosBusqueda}
 */
export function validarFiltros(filtros) {
  if (typeof filtros !== "object" || filtros === null) throw new ApiError("invalid_input");
  if (!SERVICIOS.includes(filtros.service)) throw new ApiError("invalid_input");
  const hayLat = filtros.lat !== undefined;
  const hayLng = filtros.lng !== undefined;
  if (hayLat !== hayLng) throw new ApiError("invalid_input"); // la ubicación va completa o no va
  if (hayLat && !validarCoordenadas(filtros.lat, filtros.lng)) throw new ApiError("invalid_input");

  if (filtros.max_distance_km !== undefined) {
    const km = filtros.max_distance_km;
    if (!esNumero(km) || km <= 0 || km > DISTANCIA_MAXIMA_KM || !hayLat) throw new ApiError("invalid_input");
  }
  const colonia = filtros.colonia === undefined ? "" : filtros.colonia;
  if (typeof colonia !== "string" || colonia.trim().length > 100) throw new ApiError("invalid_input");
  if (filtros.postal_code !== undefined && !(typeof filtros.postal_code === "string" && /^[0-9]{5}$/.test(filtros.postal_code))) {
    throw new ApiError("invalid_input");
  }
  if (filtros.min_rating !== undefined && (!esNumero(filtros.min_rating) || filtros.min_rating < 1 || filtros.min_rating > 5)) {
    throw new ApiError("invalid_input");
  }
  if (filtros.open_now !== undefined && typeof filtros.open_now !== "boolean") throw new ApiError("invalid_input");
  if (filtros.max_price !== undefined && (!esNumero(filtros.max_price) || filtros.max_price <= 0 || filtros.max_price >= 100000000)) throw new ApiError("invalid_input");
  const limite = filtros.limit ?? LIMITE_POR_DEFECTO;
  if (!Number.isInteger(limite) || limite < 1 || limite > LIMITE_MAXIMO) throw new ApiError("invalid_input");
  const desfase = filtros.offset ?? 0;
  if (!Number.isInteger(desfase) || desfase < 0) throw new ApiError("invalid_input");

  return {
    p_service: filtros.service,
    p_lat: hayLat ? /** @type {number} */ (filtros.lat) : null,
    p_lng: hayLng ? /** @type {number} */ (filtros.lng) : null,
    p_max_distance_km: filtros.max_distance_km ?? null,
    p_colonia: colonia.trim() === "" ? null : colonia.trim(),
    p_postal_code: filtros.postal_code ?? null,
    p_min_rating: filtros.min_rating ?? null,
    p_open_now: filtros.open_now ?? false,
    p_max_price: filtros.max_price ?? null,
    p_limit: limite,
    p_offset: desfase,
  };
}

/**
 * Ubicación opcional del perfil: `{ lat, lng }` completa o nada.
 * @param {{ lat: number, lng: number } | undefined} ubicacion
 * @returns {{ p_lat: number | null, p_lng: number | null }}
 */
export function validarUbicacion(ubicacion) {
  if (ubicacion === undefined) return { p_lat: null, p_lng: null };
  if (typeof ubicacion !== "object" || ubicacion === null || !validarCoordenadas(ubicacion.lat, ubicacion.lng)) {
    throw new ApiError("invalid_input");
  }
  return { p_lat: ubicacion.lat, p_lng: ubicacion.lng };
}

/**
 * Distancia en km entre dos puntos (haversine), con 2 decimales. Igual que `private.distance_km`.
 * @param {number} lat1
 * @param {number} lng1
 * @param {number} lat2
 * @param {number} lng2
 * @returns {number}
 */
export function distanciaKm(lat1, lng1, lat2, lng2) {
  const rad = Math.PI / 180;
  const a = Math.sin(((lat2 - lat1) * rad) / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(((lng2 - lng1) * rad) / 2) ** 2;
  return Math.round(6371 * 2 * Math.asin(Math.sqrt(Math.min(1, a))) * 100) / 100;
}

/**
 * ¿Está abierto el taller en ese instante? Usa la hora de Mérida. Igual que `private.is_workshop_open`:
 * un rango es [open, close), día ausente o [] = cerrado.
 * @param {import("../workshop/validar.js").Horario | null} horario
 * @param {Date} [fecha]
 * @returns {boolean}
 */
export function estaAbierto(horario, fecha = new Date()) {
  if (!horario) return false;
  const partes = new Intl.DateTimeFormat("en-US", { timeZone: ZONA_HORARIA, weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(fecha);
  const valor = (/** @type {string} */ tipo) => partes.find((p) => p.type === tipo)?.value ?? "";
  const dia = valor("weekday").toLowerCase().slice(0, 3);
  const hora = `${valor("hour")}:${valor("minute")}`;
  if (!DIAS.includes(dia)) return false;
  const rangos = horario[/** @type {keyof import("../workshop/validar.js").Horario} */ (dia)] ?? [];
  return rangos.some((r) => r.open <= hora && hora < r.close);
}
