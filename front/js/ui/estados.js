// Estados de carga, vacío y error que usan todas las pantallas.
import { crear } from "./dom.js";
import { icono } from "./iconos.js";
import { mensajeDeError } from "./mensajes.js";

/**
 * @param {string} [texto]
 * @returns {HTMLElement}
 */
export function crearCargando(texto = "Cargando…") {
  return crear("p", { clase: "estado-cargando", texto, attrs: { role: "status" } });
}

/**
 * @param {string} texto
 * @param {Node | null} [accion] Botón o enlace opcional.
 * @returns {HTMLElement}
 */
export function crearVacio(texto, accion = null) {
  return crear("div", { clase: "estado-vacio" }, [icono("buscar", { tam: 28 }), crear("p", { texto }), accion]);
}

/**
 * @param {string} texto
 * @param {(() => void) | null} [reintentar]
 * @returns {HTMLElement}
 */
export function crearError(texto, reintentar = null) {
  const boton = reintentar
    ? crear("button", { clase: "boton boton--secundario", texto: "Reintentar", attrs: { type: "button" }, on: { click: reintentar } })
    : null;
  return crear("div", { clase: "estado-error", attrs: { role: "alert" } }, [crear("p", { texto }), boton]);
}

/**
 * Muestra "Cargando…" en `destino`, ejecuta `cargar` y pinta el resultado. Si falla, muestra el error con Reintentar.
 * @template T
 * @param {HTMLElement} destino
 * @param {() => Promise<T>} cargar
 * @param {(datos: T) => Node | Array<Node | null | undefined | false>} pintar Las entradas vacías se omiten.
 * @param {Record<string, string>} [mensajes] Mensajes específicos por código de error.
 * @returns {Promise<void>}
 */
export async function cargarEn(destino, cargar, pintar, mensajes = {}) {
  destino.replaceChildren(crearCargando());
  try {
    const datos = await cargar();
    // replaceChildren convierte null en el texto "null": se filtran las entradas vacías.
    destino.replaceChildren(.../** @type {Node[]} */ ([pintar(datos)].flat().filter(Boolean)));
  } catch (error) {
    destino.replaceChildren(crearError(mensajeDeError(error, mensajes), () => cargarEn(destino, cargar, pintar, mensajes)));
  }
}
