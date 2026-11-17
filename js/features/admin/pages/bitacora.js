// Admin · Bitácora (CU-08): quién hizo qué y cuándo. Es de solo lectura (append-only) y consultarla no agrega entradas.
// El motivo es texto libre: siempre con textContent.
import { folio } from "../../chat/pages/chat.js";
import { formatearFecha, formatearHora } from "../../../lib/fechas.js";
import { crear } from "../../../ui/dom.js";
import { crearPantalla } from "../../../ui/layout.js";
import { NOMBRE_ACCION, POR_PAGINA, crearChipsFiltro, crearListaPaginada } from "../componentes.js";
import { api } from "../index.js";

/** Tabla afectada → texto. */
const NOMBRE_TABLA = Object.freeze({ profiles: "Usuario", workshops: "Taller", reviews: "Reseña" });

/**
 * Texto de una entrada de la bitácora.
 * @param {{ admin_name: string | null, action: string, target_table: string, target_id: string, details: Record<string, any> | null }} accion
 * @returns {{ quien: string, que: string, objetivo: string, motivo: string | null }}
 */
export function textoDeAccion(accion) {
  const motivo = typeof accion.details?.reason === "string" && accion.details.reason.trim() !== "" ? accion.details.reason : null;
  return {
    quien: accion.admin_name || "Admin",
    que: NOMBRE_ACCION[/** @type {keyof typeof NOMBRE_ACCION} */ (accion.action)] ?? accion.action,
    objetivo: `${NOMBRE_TABLA[/** @type {keyof typeof NOMBRE_TABLA} */ (accion.target_table)] ?? accion.target_table} ${folio(accion.target_id)}`,
    motivo,
  };
}

/** @param {any} accion AccionAdmin */
function crearFila(accion) {
  const { quien, que, objetivo, motivo } = textoDeAccion(accion);
  const fecha = new Date(accion.created_at);
  return crear("div", { clase: "tarjeta admin-fila" }, [
    crear("div", { clase: "fila-entre" }, [crear("p", { clase: "tarjeta__titulo", texto: que }), crear("span", { clase: "texto-secundario", texto: `${formatearFecha(accion.created_at.slice(0, 10))} · ${formatearHora(fecha)}` })]),
    crear("p", { clase: "tarjeta__detalle", texto: `${quien} · ${objetivo}` }),
    motivo ? crear("p", { clase: "admin-fila__comentario", texto: `Motivo: ${motivo}` }) : null,
  ]);
}

/** @returns {Node} */
export function renderBitacora() {
  /** @type {{ action: string }} */
  const filtros = { action: "" };
  const lista = crearListaPaginada({
    cargar: (offset) => api.listActions({ ...(filtros.action ? { action: filtros.action } : {}), limit: POR_PAGINA, offset }),
    crearFila,
    vacio: "Aún no hay acciones registradas.",
  });
  return crearPantalla({ titulo: "Bitácora", volver: "/admin", clase: "admin" }, [
    crearChipsFiltro(
      "Acción",
      [{ texto: "Todas", valor: "" }, ...Object.entries(NOMBRE_ACCION).map(([valor, texto]) => ({ texto, valor }))],
      "",
      (valor) => {
        filtros.action = valor;
        lista.recargar();
      },
    ),
    lista.elemento,
  ]);
}
