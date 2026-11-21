// Validación compartida por api.js y api.mock.js de presupuestos (CU-04). Refleja las restricciones de 0011_quotes_orders.
import { ApiError } from "../../lib/apiError.js";

export const MAX_MONTO_MXN = 99999999.99;
export const MAX_DETALLE_CARACTERES = 2000;
const FECHA = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * @typedef {{ amount_mxn: number, delivery_date: string, detail?: Record<string, unknown> }} DatosPresupuesto
 * @typedef {{ amount_mxn: number, delivery_date: string, detail: Record<string, unknown> }} PresupuestoValidado
 */

/**
 * Fecha de hoy en formato `YYYY-MM-DD` (hora local).
 * @param {Date} [ahora]
 * @returns {string}
 */
export function fechaDeHoy(ahora = new Date()) {
  const mes = String(ahora.getMonth() + 1).padStart(2, "0");
  const dia = String(ahora.getDate()).padStart(2, "0");
  return `${ahora.getFullYear()}-${mes}-${dia}`;
}

/**
 * ¿Es una fecha real con formato `YYYY-MM-DD`?
 * @param {unknown} valor
 * @returns {boolean}
 */
function esFechaValida(valor) {
  if (typeof valor !== "string") return false;
  const partes = FECHA.exec(valor);
  if (!partes) return false;
  const [anio, mes, dia] = [Number(partes[1]), Number(partes[2]), Number(partes[3])];
  const fecha = new Date(Date.UTC(anio, mes - 1, dia));
  return fecha.getUTCFullYear() === anio && fecha.getUTCMonth() === mes - 1 && fecha.getUTCDate() === dia;
}

/**
 * Valida y normaliza los datos de un presupuesto: monto en MXN (> 0, máximo 2 decimales), fecha de entrega
 * `YYYY-MM-DD` no anterior a hoy y detalle opcional (objeto de hasta 2000 caracteres al serializar).
 * @param {DatosPresupuesto} datos
 * @param {Date} [ahora]
 * @returns {PresupuestoValidado}
 */
export function validarDatosPresupuesto(datos, ahora = new Date()) {
  if (typeof datos !== "object" || datos === null) throw new ApiError("invalid_input");
  const { amount_mxn: monto, delivery_date: fecha, detail } = datos;
  if (typeof monto !== "number" || !Number.isFinite(monto) || monto <= 0 || monto > MAX_MONTO_MXN) throw new ApiError("invalid_input");
  if (Math.round(monto * 100) / 100 !== monto) throw new ApiError("invalid_input");
  if (!esFechaValida(fecha) || fecha < fechaDeHoy(ahora)) throw new ApiError("invalid_input");
  const detalle = detail ?? {};
  if (typeof detalle !== "object" || Array.isArray(detalle)) throw new ApiError("invalid_input");
  if (JSON.stringify(detalle).length > MAX_DETALLE_CARACTERES) throw new ApiError("invalid_input");
  return { amount_mxn: monto, delivery_date: fecha, detail: detalle };
}
