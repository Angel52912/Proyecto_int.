// Marca <html data-escritorio> cuando la app se ve en modo PC: pantalla de 1024px o más (salvo que el
// admin fuerce la vista Android) o vista PC forzada. Así cada regla de escritorio se escribe una sola vez
// en el CSS (`html[data-escritorio] …`) en lugar de repetirla para el @media y para la vista forzada.

export const CONSULTA_ESCRITORIO = "(min-width: 1024px)";

/**
 * @param {string | undefined} vista valor de `<html data-vista>` ("pc", "movil" o sin valor)
 * @param {boolean} anchoDeEscritorio si la ventana mide 1024px o más
 * @returns {boolean}
 */
export function esEscritorio(vista, anchoDeEscritorio) {
  return vista === "pc" || (vista !== "movil" && anchoDeEscritorio);
}

/** Mantiene `data-escritorio` al día al cambiar el ancho de la ventana o la vista forzada. */
export function instalarDeteccionEscritorio() {
  const raiz = document.documentElement;
  const consulta = window.matchMedia?.(CONSULTA_ESCRITORIO);
  const actualizar = () => raiz.toggleAttribute("data-escritorio", esEscritorio(raiz.dataset.vista, consulta?.matches === true));
  consulta?.addEventListener?.("change", actualizar);
  new MutationObserver(actualizar).observe(raiz, { attributes: true, attributeFilter: ["data-vista"] });
  actualizar();
}
