// Validación compartida por api.js y api.mock.js (CU-07). Refleja las restricciones de la migración 0004.
import { ApiError } from "../../lib/apiError.js";
import { validarCoordenadas } from "../../lib/validate.js";

export const DIAS = /** @type {ReadonlyArray<string>} */ (["mon", "tue", "wed", "thu", "fri", "sat", "sun"]);
export const SERVICIOS = /** @type {ReadonlyArray<string>} */ (["repair", "cleaning"]);
export const CAMPOS_TALLER = /** @type {ReadonlyArray<string>} */ ([
  "name",
  "address",
  "colonia",
  "postal_code",
  "lat",
  "lng",
  "services",
  "hours",
  "price_from",
]);
const HORA = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;

/**
 * @typedef {{ open: string, close: string }} RangoHorario
 * @typedef {Partial<Record<"mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun", RangoHorario[]>>} Horario
 * @typedef {{ name?: string, address?: string, colonia?: string, postal_code?: string | null, lat?: number, lng?: number, services?: string[], hours?: Horario, price_from?: number }} DatosTaller
 */

/**
 * @param {unknown} valor
 * @param {number} max
 * @returns {boolean}
 */
function textoValido(valor, max) {
  return typeof valor === "string" && valor.trim().length >= 1 && valor.trim().length <= max;
}

/**
 * @param {unknown} horario
 * @returns {boolean}
 */
export function validarHorario(horario) {
  if (typeof horario !== "object" || horario === null || Array.isArray(horario)) return false;
  for (const [dia, rangos] of Object.entries(horario)) {
    if (!DIAS.includes(dia) || !Array.isArray(rangos) || rangos.length > 2) return false;
    for (const rango of rangos) {
      if (typeof rango !== "object" || rango === null || Object.keys(rango).length !== 2) return false;
      const { open, close } = /** @type {{ open?: unknown, close?: unknown }} */ (rango);
      if (typeof open !== "string" || typeof close !== "string") return false;
      if (!HORA.test(open) || !HORA.test(close) || open >= close) return false;
    }
  }
  return true;
}

/**
 * Valida y normaliza los datos del taller. Lanza invalid_input si algo no cumple.
 * @param {DatosTaller} datos
 * @returns {DatosTaller} fila lista para guardar
 */
export function validarDatosTaller(datos) {
  if (typeof datos !== "object" || datos === null) throw new ApiError("invalid_input");
  const claves = Object.keys(datos);
  if (claves.length === 0 || claves.some((clave) => !CAMPOS_TALLER.includes(clave))) throw new ApiError("invalid_input");

  /** @type {DatosTaller} */
  const fila = {};
  if (datos.name !== undefined) {
    if (!textoValido(datos.name, 100)) throw new ApiError("invalid_input");
    fila.name = datos.name.trim();
  }
  if (datos.address !== undefined) {
    if (!textoValido(datos.address, 300)) throw new ApiError("invalid_input");
    fila.address = datos.address.trim();
  }
  if (datos.colonia !== undefined) {
    if (!textoValido(datos.colonia, 100)) throw new ApiError("invalid_input");
    fila.colonia = datos.colonia.trim();
  }
  if (datos.postal_code !== undefined) {
    if (datos.postal_code !== null && !(typeof datos.postal_code === "string" && /^[0-9]{5}$/.test(datos.postal_code))) {
      throw new ApiError("invalid_input");
    }
    fila.postal_code = datos.postal_code;
  }
  if (datos.lat !== undefined || datos.lng !== undefined) {
    // lat y lng van juntas.
    if (!validarCoordenadas(datos.lat, datos.lng)) throw new ApiError("invalid_input");
    fila.lat = datos.lat;
    fila.lng = datos.lng;
  }
  if (datos.services !== undefined) {
    const servicios = datos.services;
    if (!Array.isArray(servicios) || servicios.some((s) => !SERVICIOS.includes(s)) || new Set(servicios).size !== servicios.length) {
      throw new ApiError("invalid_input");
    }
    fila.services = servicios;
  }
  if (datos.hours !== undefined) {
    if (!validarHorario(datos.hours)) throw new ApiError("invalid_input");
    fila.hours = datos.hours;
  }
  if (datos.price_from !== undefined) {
    const precio = datos.price_from;
    if (typeof precio !== "number" || !Number.isFinite(precio) || precio <= 0 || precio >= 100000000) throw new ApiError("invalid_input");
    fila.price_from = Math.round(precio * 100) / 100;
  }
  return fila;
}

/**
 * Campos obligatorios que faltan para publicar (misma lógica que `private.workshop_missing_fields`).
 * @param {{ name: string | null, address: string | null, colonia: string | null, lat: number | null, lng: number | null, services: string[], hours: Horario | null, price_from: number | null }} taller
 * @returns {string[]}
 */
export function camposFaltantes(taller) {
  /** @type {string[]} */
  const faltan = [];
  if (taller.name === null) faltan.push("name");
  if (taller.address === null) faltan.push("address");
  if (taller.colonia === null) faltan.push("colonia");
  if (taller.lat === null || taller.lng === null) faltan.push("location");
  if (taller.services.length === 0) faltan.push("services");
  const hayHorario = taller.hours !== null && Object.values(taller.hours).some((rangos) => Array.isArray(rangos) && rangos.length > 0);
  if (!hayHorario) faltan.push("hours");
  if (taller.price_from === null) faltan.push("price_from");
  return faltan;
}
