// Fotos que se pueden ampliar (reporte de Milton): al tocar una foto que no está dentro de un enlace o botón (chat,
// seguimiento, solicitud, trabajos del taller…) se abre en grande. Si en la pantalla hay varias, se pasa de una a
// otra con las flechas. Se cierra con la X, tocando fuera de la foto o con Esc.
import { crear } from "./dom.js";
import { icono } from "./iconos.js";

const SELECTOR_FOTO = "img.foto";

/**
 * ¿Esta foto se puede ampliar? No las que ya llevan a otra pantalla (tarjetas, enlaces) ni los avatares.
 * @param {Element} imagen
 * @returns {boolean}
 */
export function esAmpliable(imagen) {
  return imagen.matches(SELECTOR_FOTO) && imagen.closest("a, button, .avatar, .visor-foto") === null;
}

/**
 * Marca las fotos ampliables dentro de `raiz`: se pueden enfocar con el teclado y el lector dice "Ampliar foto".
 * @param {ParentNode} raiz
 */
export function marcarFotos(raiz) {
  raiz.querySelectorAll(SELECTOR_FOTO).forEach((imagen) => {
    if (!esAmpliable(imagen) || imagen.classList.contains("foto--ampliable")) return;
    imagen.classList.add("foto--ampliable");
    imagen.setAttribute("tabindex", "0");
    imagen.setAttribute("role", "button");
    imagen.setAttribute("aria-label", `Ampliar foto${imagen.getAttribute("alt") ? `: ${imagen.getAttribute("alt")}` : ""}`);
  });
}

/**
 * Abre el visor con la foto elegida; `fotos` son las de la misma pantalla, para pasar de una a otra.
 * @param {HTMLImageElement[]} fotos
 * @param {number} indice
 * @returns {HTMLDialogElement}
 */
export function abrirVisor(fotos, indice) {
  let actual = indice;
  const imagen = /** @type {HTMLImageElement} */ (crear("img", { clase: "visor-foto__imagen" }));
  const contador = crear("p", { clase: "visor-foto__contador", attrs: { "aria-live": "polite" } });
  const varias = fotos.length > 1;

  const pintar = () => {
    const foto = fotos[actual];
    imagen.src = foto.currentSrc || foto.src;
    imagen.alt = foto.alt;
    contador.textContent = varias ? `${actual + 1} de ${fotos.length}` : "";
  };
  /** @param {number} paso */
  const mover = (paso) => {
    actual = (actual + paso + fotos.length) % fotos.length;
    pintar();
  };

  /** @param {string} clase @param {string} etiqueta @param {string} nombreIcono @param {() => void} accion */
  const boton = (clase, etiqueta, nombreIcono, accion) =>
    crear("button", { clase: `visor-foto__boton ${clase}`, attrs: { type: "button", "aria-label": etiqueta, title: etiqueta }, on: { click: accion } }, [icono(nombreIcono, { tam: 22 })]);

  const visor = /** @type {HTMLDialogElement} */ (
    crear("dialog", { clase: "visor-foto", attrs: { "aria-label": "Foto ampliada" } }, [
      imagen,
      boton("visor-foto__cerrar", "Cerrar", "cerrar", () => cerrar()),
      varias ? boton("visor-foto__anterior", "Foto anterior", "atras", () => mover(-1)) : null,
      varias ? boton("visor-foto__siguiente", "Foto siguiente", "adelante", () => mover(1)) : null,
      contador,
    ])
  );

  const cerrar = () => {
    if (typeof visor.close === "function" && visor.open) visor.close();
    visor.remove();
    fotos[actual]?.focus?.({ preventScroll: true });
  };
  // Tocar fuera de la foto (el fondo oscuro) cierra; las flechas del teclado pasan de foto.
  visor.addEventListener("click", (evento) => {
    if (evento.target === visor) cerrar();
  });
  visor.addEventListener("keydown", (evento) => {
    if (varias && evento.key === "ArrowLeft") mover(-1);
    if (varias && evento.key === "ArrowRight") mover(1);
  });
  // Esc cierra el <dialog> solo: aquí se quita del documento.
  visor.addEventListener("close", () => visor.remove());

  pintar();
  document.body.append(visor);
  if (typeof visor.showModal === "function") visor.showModal();
  else visor.setAttribute("open", "");
  return visor;
}

/** @param {Element} imagen */
function abrirDesde(imagen) {
  const pantalla = imagen.closest(".pantalla") ?? document;
  const fotos = /** @type {HTMLImageElement[]} */ ([...pantalla.querySelectorAll(SELECTOR_FOTO)].filter(esAmpliable));
  abrirVisor(fotos, Math.max(0, fotos.indexOf(/** @type {HTMLImageElement} */ (imagen))));
}

/** Se instala una vez: marca las fotos que van apareciendo y abre el visor al tocarlas (o con Enter). */
export function instalarAmpliarFotos() {
  const app = document.getElementById("app") ?? document.body;
  marcarFotos(app);
  new MutationObserver(() => marcarFotos(app)).observe(app, { childList: true, subtree: true });
  app.addEventListener("click", (evento) => {
    const imagen = /** @type {Element} */ (evento.target).closest?.(SELECTOR_FOTO);
    if (imagen && esAmpliable(imagen)) abrirDesde(imagen);
  });
  app.addEventListener("keydown", (evento) => {
    const imagen = /** @type {Element} */ (evento.target);
    if ((evento.key === "Enter" || evento.key === " ") && imagen.matches?.(".foto--ampliable")) {
      evento.preventDefault();
      abrirDesde(imagen);
    }
  });
}
