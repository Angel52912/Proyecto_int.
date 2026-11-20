const REEMPLAZOS = /** @type {const} */ ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
});

/**
 * Escapa texto para usarlo dentro de HTML. Para mostrar texto de usuarios usa `textContent`;
 * esta función es solo para casos donde un atributo o cadena deba ir escapada.
 * @param {unknown} valor
 * @returns {string}
 */
export function escaparHtml(valor) {
  return String(valor ?? "").replace(/[&<>"']/g, (caracter) => REEMPLAZOS[/** @type {keyof typeof REEMPLAZOS} */ (caracter)]);
}
