// Validación compartida por api.js y api.mock.js (CU-06). Refleja las restricciones de la migración 0014.
import { ApiError } from "../../lib/apiError.js";

export const MAX_COMENTARIO = 1000;
export const MAX_ETIQUETAS = 5;
export const MAX_LARGO_ETIQUETA = 30;
export const INTENTOS_PIN = 5;
export const MINUTOS_BLOQUEO_PIN = 15;
const QR = /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}):(\d{6})$/i;

/**
 * Obtiene el PIN de 6 dígitos del texto escrito o escaneado: `123456` o `order_id:123456` (QR).
 * Un formato inválido lanza invalid_input (A1) y no cuenta como intento; un PIN bien formado pero incorrecto lo
 * resuelve la función SQL y devuelve `{ ok: false }`.
 * @param {string} orderId
 * @param {unknown} codigo
 * @returns {string}
 */
export function extraerPin(orderId, codigo) {
  if (typeof codigo !== "string") throw new ApiError("invalid_input");
  const texto = codigo.trim();
  const qr = QR.exec(texto);
  if (qr) {
    if (qr[1].toLowerCase() !== orderId.toLowerCase()) throw new ApiError("invalid_input"); // QR de otro pedido
    return qr[2];
  }
  if (!/^\d{6}$/.test(texto)) throw new ApiError("invalid_input");
  return texto;
}

/**
 * @typedef {{ rating: number, comment?: string | null, tags?: string[] }} DatosResena
 * @typedef {{ rating: number, comment: string | null, tags: string[] }} ResenaValida
 */

/**
 * Valida y normaliza la reseña: 1 a 5 estrellas, comentario opcional de hasta 1000 caracteres y hasta 5 etiquetas.
 * @param {DatosResena} datos
 * @returns {ResenaValida}
 */
export function validarResena(datos) {
  const rating = datos?.rating;
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw new ApiError("invalid_input");
  if (datos.comment !== undefined && datos.comment !== null && typeof datos.comment !== "string") throw new ApiError("invalid_input");
  const comment = (datos.comment ?? "").trim() || null;
  if (comment !== null && comment.length > MAX_COMENTARIO) throw new ApiError("invalid_input");
  const etiquetas = datos.tags ?? [];
  if (!Array.isArray(etiquetas) || etiquetas.length > MAX_ETIQUETAS) throw new ApiError("invalid_input");
  const tags = etiquetas.map((t) => {
    if (typeof t !== "string") throw new ApiError("invalid_input");
    const limpia = t.trim();
    if (limpia.length < 1 || limpia.length > MAX_LARGO_ETIQUETA) throw new ApiError("invalid_input");
    return limpia;
  });
  return { rating, comment, tags };
}
