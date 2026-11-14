// Validación compartida por api.js y api.mock.js (CU-08). Refleja las restricciones de la migración 0016.
import { ApiError } from "../../lib/apiError.js";
import { esUuid } from "../requests/validar.js";

export const LIMITE_POR_DEFECTO = 50;
export const LIMITE_MAXIMO = 100;
export const MAX_BUSQUEDA = 100;
export const MAX_MOTIVO = 300;
export const ROLES = /** @type {ReadonlyArray<string>} */ (["client", "craftsman", "admin"]);
export const ESTADOS_SOLICITUD = /** @type {ReadonlyArray<string>} */ (["open", "quoted", "accepted", "declined", "cancelled"]);
export const ESTADOS_PEDIDO = /** @type {ReadonlyArray<string>} */ (["in_progress", "ready", "delivered", "cancelled"]);

/**
 * @typedef {{ limit?: number, offset?: number }} Paginacion
 * @typedef {{ p_limit: number, p_offset: number }} ParametrosPagina
 */

/**
 * @param {Paginacion} filtros
 * @returns {ParametrosPagina}
 */
export function validarPagina(filtros) {
  const limite = filtros.limit ?? LIMITE_POR_DEFECTO;
  const desfase = filtros.offset ?? 0;
  if (!Number.isInteger(limite) || limite < 1 || limite > LIMITE_MAXIMO) throw new ApiError("invalid_input");
  if (!Number.isInteger(desfase) || desfase < 0) throw new ApiError("invalid_input");
  return { p_limit: limite, p_offset: desfase };
}

/**
 * @param {unknown} filtros
 * @returns {Record<string, any>} los mismos filtros, garantizando que es un objeto
 */
export function exigirFiltros(filtros) {
  if (filtros === undefined) return {};
  if (typeof filtros !== "object" || filtros === null || Array.isArray(filtros)) throw new ApiError("invalid_input");
  return /** @type {Record<string, any>} */ (filtros);
}

/**
 * Texto de búsqueda opcional (máximo 100 caracteres; vacío = sin filtro).
 * @param {unknown} texto
 * @returns {string | null}
 */
export function validarBusqueda(texto) {
  if (texto === undefined || texto === null) return null;
  if (typeof texto !== "string" || texto.trim().length > MAX_BUSQUEDA) throw new ApiError("invalid_input");
  return texto.trim() === "" ? null : texto.trim();
}

/**
 * Motivo opcional de una acción (máximo 300 caracteres; vacío = sin motivo).
 * @param {unknown} motivo
 * @returns {string | null}
 */
export function validarMotivo(motivo) {
  if (motivo === undefined || motivo === null) return null;
  if (typeof motivo !== "string" || motivo.trim().length > MAX_MOTIVO) throw new ApiError("invalid_input");
  return motivo.trim() === "" ? null : motivo.trim();
}

/**
 * @param {unknown} valor
 * @param {string} nombre
 * @returns {boolean | null} el booleano, o `null` si no se envió
 */
export function validarBooleanoOpcional(valor, nombre) {
  void nombre;
  if (valor === undefined || valor === null) return null;
  if (typeof valor !== "boolean") throw new ApiError("invalid_input");
  return valor;
}

/**
 * @param {unknown} valor
 * @param {ReadonlyArray<string>} permitidos
 * @returns {string | null} el valor, o `null` si no se envió
 */
export function validarOpcionDeLista(valor, permitidos) {
  if (valor === undefined || valor === null) return null;
  if (typeof valor !== "string" || !permitidos.includes(valor)) throw new ApiError("invalid_input");
  return valor;
}

/**
 * @param {unknown} valor
 * @returns {string | null} uuid opcional
 */
export function validarUuidOpcional(valor) {
  if (valor === undefined || valor === null) return null;
  if (!esUuid(valor)) throw new ApiError("invalid_input");
  return /** @type {string} */ (valor);
}
