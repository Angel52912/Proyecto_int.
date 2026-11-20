// Validación compartida por api.js y api.mock.js (CU-03). Refleja las restricciones de las migraciones 0007 y 0009.
import { ApiError } from "../../lib/apiError.js";

export const SERVICIOS_SOLICITUD = /** @type {ReadonlyArray<string>} */ (["repair", "cleaning"]);
export const MAX_DESCRIPCION = 1000;
export const MAX_MENSAJE = 2000;
export const MAX_FOTOS_SOLICITUD = 5;
export const MAX_SOLICITUDES_ACTIVAS = 5;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * @param {unknown} valor
 * @returns {boolean}
 */
export function esUuid(valor) {
  return typeof valor === "string" && UUID.test(valor);
}

/**
 * Exige un uuid; lanza invalid_input si no lo es.
 * @param {unknown} valor
 * @returns {string}
 */
export function exigirUuid(valor) {
  if (!esUuid(valor)) throw new ApiError("invalid_input");
  return /** @type {string} */ (valor);
}

/**
 * Texto con longitud entre 1 y `max` (sin contar espacios de los extremos). Devuelve el texto recortado.
 * @param {unknown} valor
 * @param {number} max
 * @returns {string}
 */
export function exigirTexto(valor, max) {
  if (typeof valor !== "string") throw new ApiError("invalid_input");
  const texto = valor.trim();
  if (texto.length < 1 || texto.length > max) throw new ApiError("invalid_input");
  return texto;
}

/**
 * @typedef {{ workshop_id: string, service_type: "repair" | "cleaning", description: string }} DatosSolicitud
 */

/**
 * Valida y normaliza los datos de una solicitud nueva.
 * @param {DatosSolicitud} datos
 * @returns {DatosSolicitud}
 */
export function validarDatosSolicitud(datos) {
  if (typeof datos !== "object" || datos === null) throw new ApiError("invalid_input");
  if (!SERVICIOS_SOLICITUD.includes(datos.service_type)) throw new ApiError("invalid_input");
  return {
    workshop_id: exigirUuid(datos.workshop_id),
    service_type: datos.service_type,
    description: exigirTexto(datos.description, MAX_DESCRIPCION),
  };
}
