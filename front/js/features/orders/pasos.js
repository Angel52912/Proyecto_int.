// Barra de 4 pasos del pedido (CU-05): un segmento por fase. Se usa en Inicio y en Mis pedidos.
import { crear } from "../../ui/dom.js";
import { NOMBRE_FASE, NOMBRE_FASE_CORTO } from "./fases.js";

/**
 * Texto del avance: "Fase 2 de 4 · Desinfección / pretratamiento" o "Listo para recoger".
 * @param {{ phase: number, status: string }} pedido
 * @param {{ corto?: boolean }} [opciones] `corto`: nombre corto de la fase ("Desinfección"), para listas.
 * @returns {string}
 */
export function textoDeAvance(pedido, opciones = {}) {
  if (pedido.status === "ready") return "Listo para recoger";
  if (pedido.status === "delivered") return "Entregado";
  const nombres = /** @type {Record<number, string>} */ (opciones.corto ? NOMBRE_FASE_CORTO : NOMBRE_FASE);
  const nombre = nombres[pedido.phase];
  return nombre ? `Fase ${pedido.phase} de 4 · ${nombre}` : `Fase ${pedido.phase} de 4`;
}

/**
 * Estado de cada segmento: "hecho" (fases terminadas), "actual" (la fase en curso) o "pendiente".
 * Listo o entregado = los 4 hechos.
 * @param {{ phase: number, status: string }} pedido
 * @returns {("hecho" | "actual" | "pendiente")[]}
 */
export function estadosDePasos(pedido) {
  const terminado = pedido.status === "ready" || pedido.status === "delivered";
  return [1, 2, 3, 4].map((n) => (terminado || n < pedido.phase ? "hecho" : n === pedido.phase ? "actual" : "pendiente"));
}

/**
 * @param {{ phase: number, status: string }} pedido
 * @param {{ claro?: boolean }} [opciones] `claro`: colores para fondo oscuro (tarjeta destacada de Inicio).
 * @returns {HTMLElement}
 */
export function crearPasos(pedido, opciones = {}) {
  const estados = estadosDePasos(pedido);
  const hechos = estados.filter((e) => e === "hecho").length;
  return crear(
    "div",
    {
      clase: `pasos${opciones.claro ? " pasos--claro" : ""}${pedido.status === "ready" ? " pasos--listo" : ""}`,
      attrs: { role: "progressbar", "aria-valuemin": 0, "aria-valuemax": 4, "aria-valuenow": hechos, "aria-valuetext": textoDeAvance(pedido) },
    },
    estados.map((estado) => crear("span", { clase: `pasos__segmento pasos__segmento--${estado}` })),
  );
}
