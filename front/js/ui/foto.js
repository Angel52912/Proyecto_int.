// Imagen con respaldo: si no hay URL o la foto no carga (URL vencida, sin red), muestra un marco con ícono.
// Si se pasa `nombre` (por ejemplo, el del taller), el respaldo muestra sus iniciales sobre un degradado de marca.
import { crear } from "./dom.js";
import { icono } from "./iconos.js";
import { iniciales } from "./layout.js";

/**
 * @param {string} [clase]
 * @param {string} [nombre]
 * @returns {HTMLElement}
 */
function respaldo(clase, nombre) {
  const extra = clase ? ` ${clase}` : "";
  if (nombre) {
    return crear("div", { clase: `foto foto--vacia foto--inicial${extra}`, attrs: { role: "img", "aria-label": `Sin foto de ${nombre}` } }, [
      crear("span", { clase: "foto__inicial", texto: iniciales(nombre), attrs: { "aria-hidden": "true" } }),
    ]);
  }
  return crear("div", { clase: `foto foto--vacia${extra}`, attrs: { role: "img", "aria-label": "Sin foto" } }, [icono("imagen")]);
}

/**
 * @param {string | null | undefined} url
 * @param {string} alt Texto alternativo (accesibilidad).
 * @param {string} [clase]
 * @param {string} [nombre] Nombre para el respaldo con iniciales (talleres, personas).
 * @returns {HTMLElement}
 */
export function crearFoto(url, alt, clase, nombre) {
  if (!url) return respaldo(clase, nombre);
  const imagen = crear("img", { clase: `foto${clase ? ` ${clase}` : ""}`, attrs: { src: url, alt, loading: "lazy", decoding: "async" } });
  imagen.addEventListener("error", () => imagen.replaceWith(respaldo(clase, nombre)), { once: true });
  return imagen;
}
