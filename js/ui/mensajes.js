// Mensajes en español para los códigos de error del contrato (docs/contrato-api.md).

/** @type {Record<string, string>} */
export const MENSAJES_ERROR = Object.freeze({
  not_authenticated: "Tu sesión terminó. Inicia sesión de nuevo.",
  forbidden: "No tienes permiso para hacer esto.",
  inactive_user: "Tu cuenta está desactivada. Escríbenos si crees que es un error.",
  not_found: "No encontramos lo que buscas.",
  invalid_input: "Revisa los datos e intenta de nuevo.",
  limit_reached: "Llegaste al límite permitido.",
  invalid_state: "Esta acción ya no está disponible.",
  photo_required: "Agrega al menos una foto.",
  confirmation_required: "Confirma el cambio y escribe una nota para el cliente.",
  rate_limited: "Demasiados intentos. Espera un momento.",
  unexpected: "Algo salió mal. Intenta de nuevo.",
});

/**
 * Mensaje para mostrar al usuario. `especificos` permite que cada pantalla precise el texto de un código.
 * @param {unknown} error
 * @param {Record<string, string>} [especificos]
 * @returns {string}
 */
export function mensajeDeError(error, especificos = {}) {
  const codigo = /** @type {{ code?: unknown } | null} */ (error)?.code;
  if (typeof codigo === "string") return especificos[codigo] ?? MENSAJES_ERROR[codigo] ?? MENSAJES_ERROR.unexpected;
  return MENSAJES_ERROR.unexpected;
}
