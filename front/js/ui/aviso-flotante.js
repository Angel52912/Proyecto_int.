// Avisos flotantes ("Cambios guardados", "Sin conexión"): aparecen abajo unos segundos y se van solos.
// Viven fuera de #app, así que siguen visibles aunque la acción lleve a otra pantalla.
import { crear, enlace } from "./dom.js";
import { icono } from "./iconos.js";

/** Tiempo visible por defecto, en milisegundos. */
export const DURACION_AVISO = 3500;

const ICONOS = Object.freeze({ exito: "check", error: "cerrar", info: "campana" });

/** @returns {HTMLElement} región única (aria-live) donde se apilan los avisos. */
function region() {
  let contenedor = /** @type {HTMLElement | null} */ (document.querySelector(".avisos-flotantes"));
  if (contenedor === null) {
    contenedor = crear("div", { clase: "avisos-flotantes", attrs: { role: "status", "aria-live": "polite" } });
    document.body.append(contenedor);
  }
  return contenedor;
}

/**
 * Muestra un aviso flotante. El texto siempre va con `textContent`.
 * @param {string} texto
 * @param {{ tono?: "exito" | "error" | "info", duracion?: number, ruta?: string | null, detalle?: string }} [opciones]
 *   `ruta`: el aviso se vuelve un enlace (por ejemplo, al pedido que cambió). `detalle`: segundo renglón.
 * @returns {HTMLElement} el aviso (por si se quiere quitar antes).
 */
export function mostrarAvisoFlotante(texto, opciones = {}) {
  const tono = opciones.tono ?? "exito";
  const contenido = [
    icono(ICONOS[tono], { tam: 18 }),
    crear("span", { clase: "aviso-flotante__texto" }, [crear("strong", { texto }), opciones.detalle ? crear("span", { texto: opciones.detalle }) : null]),
  ];
  const clase = `aviso-flotante aviso-flotante--${tono}${opciones.ruta ? " aviso-flotante--enlace" : ""}`;
  const aviso = opciones.ruta ? enlace(opciones.ruta, { clase }, contenido) : crear("div", { clase }, contenido);
  region().append(aviso);
  const quitar = () => {
    aviso.classList.add("aviso-flotante--saliendo");
    setTimeout(() => aviso.remove(), 200);
  };
  setTimeout(quitar, opciones.duracion ?? DURACION_AVISO);
  return aviso;
}
