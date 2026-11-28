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

const CLAVE_NAVEGACIONES = "mixanab:navegaciones-internas";
let contadorInstalado = false;

/** Cuenta los cambios de hash para distinguir "llegué desde otra pantalla" de "abrí en directo". */
function instalarContadorNavegaciones() {
  if (contadorInstalado || typeof window === "undefined") return;
  contadorInstalado = true;
  window.addEventListener("hashchange", () => {
    try {
      const actual = Number(window.sessionStorage.getItem(CLAVE_NAVEGACIONES) ?? "0");
      window.sessionStorage.setItem(CLAVE_NAVEGACIONES, String(actual + 1));
    } catch {
      // Sin sessionStorage (modo privado) seguimos con la heurística de history.length.
    }
  });
}

// Se instala al cargar el módulo, antes de que el usuario navegue por primera vez.
if (typeof window !== "undefined") instalarContadorNavegaciones();

/**
 * Manejador común de los botones «Volver»: prefiere el historial del navegador para regresar
 * exactamente a la pantalla anterior. Si no hubo navegación interna, deja que el enlace siga su
 * `href` de respaldo (por ejemplo `#/principal` cuando se abrió la pantalla en directo).
 * @param {MouseEvent} evento
 */
export function volverConHistorial(evento) {
  // Clic con modificador o rueda: se respeta para abrir el destino de respaldo en otra pestaña.
  if (evento.button !== 0 || evento.metaKey || evento.ctrlKey || evento.shiftKey || evento.altKey) return;
  if (typeof window === "undefined" || !window.history || window.history.length <= 1) return;
  instalarContadorNavegaciones();

  let huboOrigen = false;
  try {
    huboOrigen = Number(window.sessionStorage.getItem(CLAVE_NAVEGACIONES) ?? "0") > 0;
  } catch {
    // Sin sessionStorage: una pestaña nueva arranca con about:blank + la URL (length 2).
    huboOrigen = window.history.length > 2;
  }
  if (!huboOrigen) return;

  evento.preventDefault();
  window.history.back();
}
