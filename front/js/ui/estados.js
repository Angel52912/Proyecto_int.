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
 * Esqueleto de carga: tarjetas grises con brillo que imitan el contenido mientras llega.
 * El texto queda para lectores de pantalla.
 * @param {number} [filas]
 * @param {string} [texto]
 * @returns {HTMLElement}
 */
export function crearEsqueleto(filas = 3, texto = "Cargando…") {
  const tarjetas = Array.from({ length: filas }, () =>
    crear("div", { clase: "esqueleto__tarjeta", attrs: { "aria-hidden": "true" } }, [
      crear("div", { clase: "esqueleto__bloque esqueleto__foto" }),
      crear("div", { clase: "esqueleto__lineas" }, [
        crear("div", { clase: "esqueleto__bloque esqueleto__linea" }),
        crear("div", { clase: "esqueleto__bloque esqueleto__linea esqueleto__linea--corta" }),
      ]),
    ]),
  );
  return crear("div", { clase: "esqueleto", attrs: { role: "status" } }, [crear("span", { clase: "oculto-visual", texto }), ...tarjetas]);
}

/**
 * @param {string} texto
 * @param {Node | null} [accion] Botón o enlace opcional.
 * @param {{ icono?: string }} [opciones] Ícono del círculo (por defecto, la lupa).
 * @returns {HTMLElement}
 */
export function crearVacio(texto, accion = null, opciones = {}) {
  return crear("div", { clase: "estado-vacio" }, [
    crear("span", { clase: "estado-vacio__icono", attrs: { "aria-hidden": "true" } }, [icono(opciones.icono ?? "buscar", { tam: 28 })]),
    crear("p", { texto }),
    accion,
  ]);
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
 * Muestra un esqueleto de carga en `destino`, ejecuta `cargar` y pinta el resultado. Si falla, muestra el error con Reintentar.
 * @template T
 * @param {HTMLElement} destino
 * @param {() => Promise<T>} cargar
 * @param {(datos: T) => Node | Array<Node | null | undefined | false>} pintar Las entradas vacías se omiten.
 * @param {Record<string, string>} [mensajes] Mensajes específicos por código de error.
 * @returns {Promise<void>}
 */
export async function cargarEn(destino, cargar, pintar, mensajes = {}) {
  destino.replaceChildren(crearEsqueleto());
  try {
    const datos = await cargar();
    // replaceChildren convierte null en el texto "null": se filtran las entradas vacías.
    destino.replaceChildren(.../** @type {Node[]} */ ([pintar(datos)].flat().filter(Boolean)));
  } catch (error) {
    destino.replaceChildren(crearError(mensajeDeError(error, mensajes), () => cargarEn(destino, cargar, pintar, mensajes)));
  }
}
