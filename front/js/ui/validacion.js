// Validación mientras se escribe: un campo se revisa al salir de él (si ya tiene algo escrito)
// y, desde entonces, en cada tecla, así el error se quita en cuanto se corrige.
// Cada formulario conserva su propia función de validación (la misma que usa al enviar).

/**
 * Muestra (o quita) el error de un campo: texto en su `.campo__error`, clase `campo--error` y `aria-invalid`.
 * @param {HTMLInputElement | HTMLTextAreaElement} control
 * @param {string} mensaje Vacío para quitar el error.
 */
export function mostrarErrorCampo(control, mensaje) {
  const campo = control.closest(".campo");
  const salida = campo?.querySelector(".campo__error");
  if (salida) salida.textContent = mensaje;
  campo?.classList.toggle("campo--error", Boolean(mensaje));
  if (mensaje) control.setAttribute("aria-invalid", "true");
  else control.removeAttribute("aria-invalid");
}

/**
 * @param {Record<string, HTMLInputElement | HTMLTextAreaElement | null | undefined>} controles por clave de error
 * @param {() => Record<string, string>} validar devuelve los errores actuales por clave
 * @returns {{ tocados: Set<string> }}
 */
export function validarEnVivo(controles, validar) {
  /** @type {Set<string>} */
  const tocados = new Set();
  const pintar = () => {
    const errores = validar();
    for (const clave of tocados) {
      const control = controles[clave];
      if (control) mostrarErrorCampo(control, errores[clave] ?? "");
    }
  };
  for (const [clave, control] of Object.entries(controles)) {
    if (!control) continue;
    control.addEventListener("blur", () => {
      // Pasar por un campo vacío sin escribir no muestra error; eso lo hace el botón de enviar.
      if (!tocados.has(clave) && control.value.trim() === "") return;
      tocados.add(clave);
      pintar();
    });
    control.addEventListener("input", () => {
      if (tocados.has(clave)) pintar();
    });
  }
  return { tocados };
}
