// Imagen con respaldo: si no hay URL o la foto no carga (URL vencida, sin red), muestra un marco con ícono.
import { crear } from "./dom.js";
import { icono } from "./iconos.js";

/**
 * @param {string} [clase]
 * @returns {HTMLElement}
 */
function respaldo(clase) {
  return crear("div", { clase: `foto foto--vacia${clase ? ` ${clase}` : ""}`, attrs: { role: "img", "aria-label": "Sin foto" } }, [icono("imagen")]);
}

/**
 * @param {string | null | undefined} url
 * @param {string} alt Texto alternativo (accesibilidad).
 * @param {string} [clase]
 * @returns {HTMLElement}
 */
export function crearFoto(url, alt, clase) {
  if (!url) return respaldo(clase);
  const imagen = crear("img", { clase: `foto${clase ? ` ${clase}` : ""}`, attrs: { src: url, alt, loading: "lazy", decoding: "async" } });
  imagen.addEventListener("error", () => imagen.replaceWith(respaldo(clase)), { once: true });
  return imagen;
}
