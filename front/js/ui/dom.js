// Ayudas para construir la interfaz con el DOM. El texto siempre va con textContent (nunca HTML crudo).

/**
 * @typedef {object} OpcionesElemento
 * @property {string} [clase] Clases CSS.
 * @property {unknown} [texto] Texto del elemento (se asigna con textContent).
 * @property {Record<string, string | number | boolean | null | undefined>} [attrs] Atributos; `false`, `null` y `undefined` se omiten.
 * @property {Record<string, EventListener>} [on] Eventos.
 */

/**
 * Crea un elemento con clase, texto, atributos, eventos e hijos.
 * @param {string} etiqueta
 * @param {OpcionesElemento} [opciones]
 * @param {Array<Node | string | null | undefined | false>} [hijos]
 * @returns {HTMLElement}
 */
export function crear(etiqueta, opciones = {}, hijos = []) {
  const elemento = document.createElement(etiqueta);
  if (opciones.clase) elemento.className = opciones.clase;
  if (opciones.texto !== undefined && opciones.texto !== null) elemento.textContent = String(opciones.texto);
  for (const [nombre, valor] of Object.entries(opciones.attrs ?? {})) {
    if (valor === false || valor === null || valor === undefined) continue;
    elemento.setAttribute(nombre, valor === true ? "" : String(valor));
  }
  for (const [evento, manejador] of Object.entries(opciones.on ?? {})) elemento.addEventListener(evento, manejador);
  if (etiqueta === "textarea") {
    const area = /** @type {HTMLTextAreaElement} */ (elemento);
    // Crece con el texto y vuelve a encogerse al borrar; el ancho lo fija el CSS.
    const ajustarAltura = () => {
      const borde = area.offsetHeight - area.clientHeight;
      const alturaPrevia = area.style.height;
      area.style.height = "auto";
      if (area.scrollHeight > 0) area.style.height = `${area.scrollHeight + borde}px`;
      else area.style.height = alturaPrevia;
    };
    area.addEventListener("input", ajustarAltura);
    area.addEventListener("focus", ajustarAltura);
    ajustarAltura();
    queueMicrotask(ajustarAltura);
  }
  for (const hijo of hijos) {
    if (hijo === null || hijo === undefined || hijo === false) continue;
    elemento.append(hijo);
  }
  return elemento;
}

/**
 * Enlace a una ruta del router por hash (`/pedido/1` → `#/pedido/1`).
 * @param {string} ruta
 * @param {OpcionesElemento} [opciones]
 * @param {Array<Node | string | null | undefined | false>} [hijos]
 * @returns {HTMLAnchorElement}
 */
export function enlace(ruta, opciones = {}, hijos = []) {
  return /** @type {HTMLAnchorElement} */ (crear("a", { ...opciones, attrs: { href: `#${ruta}`, ...opciones.attrs } }, hijos));
}

/**
 * Navega a una ruta del router.
 * @param {string} ruta
 */
export function ir(ruta) {
  window.location.hash = `#${ruta}`;
}
