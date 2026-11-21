export const LONGITUD_CODIGO = 6;
export const LONGITUD_MINIMA_CONTRASENA = 8;
export const MAX_IMAGEN_BYTES = 5 * 1024 * 1024;
export const TIPOS_IMAGEN = /** @type {ReadonlyArray<string>} */ (["image/jpeg", "image/png", "image/webp"]);

/**
 * @param {unknown} valor
 * @returns {boolean}
 */
export function validarCorreo(valor) {
  return typeof valor === "string" && valor.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor);
}

/**
 * @param {unknown} valor
 * @returns {boolean}
 */
export function validarContrasena(valor) {
  return typeof valor === "string" && valor.length >= LONGITUD_MINIMA_CONTRASENA;
}

/**
 * Código de verificación (OTP) o PIN de entrega: exactamente 6 dígitos.
 * @param {unknown} valor
 * @returns {boolean}
 */
export function validarCodigo(valor) {
  return typeof valor === "string" && new RegExp(`^\\d{${LONGITUD_CODIGO}}$`).test(valor);
}

/**
 * @param {{ type: string, size: number }} archivo
 * @returns {{ valido: boolean, error: string | null }}
 */
export function validarImagen(archivo) {
  if (!TIPOS_IMAGEN.includes(archivo.type)) {
    return { valido: false, error: "Solo se permiten imágenes JPG, PNG o WebP." };
  }
  if (archivo.size > MAX_IMAGEN_BYTES) {
    return { valido: false, error: "La imagen no debe pesar más de 5 MB." };
  }
  return { valido: true, error: null };
}

/**
 * @param {unknown} valor
 * @returns {boolean}
 */
export function validarCalificacion(valor) {
  return Number.isInteger(valor) && /** @type {number} */ (valor) >= 1 && /** @type {number} */ (valor) <= 5;
}

/**
 * @param {unknown} lat
 * @param {unknown} lng
 * @returns {boolean}
 */
export function validarCoordenadas(lat, lng) {
  return (
    typeof lat === "number" &&
    typeof lng === "number" &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}
