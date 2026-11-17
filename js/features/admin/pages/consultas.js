// Admin · Solicitudes y Pedidos (CU-08): consulta de solo lectura (estatus y fechas). El admin no ve el chat, las fotos,
// la descripción ni los montos; el contrato no los devuelve.
import { folio } from "../../chat/pages/chat.js";
import { NOMBRE_SERVICIO } from "../../map/componentes.js";
import { ESTADO_ORDEN, ESTADO_SOLICITUD, NOMBRE_FASE_CORTO } from "../../orders/fases.js";
import { formatearFecha } from "../../../lib/fechas.js";
import { crear } from "../../../ui/dom.js";
import { crearInsignia, crearPantalla } from "../../../ui/layout.js";
import { POR_PAGINA, crearChipsFiltro, crearListaPaginada } from "../componentes.js";
import { api } from "../index.js";

/**
 * @param {string} etiqueta
 * @param {string | null} fecha
 */
const fila = (etiqueta, fecha) => (fecha ? [crear("dt", { texto: etiqueta }), crear("dd", { texto: formatearFecha(fecha.slice(0, 10)) })] : []);

/** @param {any} s SolicitudAdmin */
function crearFilaSolicitud(s) {
  const estado = ESTADO_SOLICITUD[s.status] ?? { texto: s.status, tono: "neutra" };
  return crear("div", { clase: "tarjeta admin-fila" }, [
    crear("div", { clase: "fila-entre" }, [crear("p", { clase: "tarjeta__titulo", texto: `Solicitud ${folio(s.id)}` }), crearInsignia(estado.texto, estado.tono)]),
    crear("p", { clase: "tarjeta__detalle", texto: `${s.workshop_name ?? "Taller sin nombre"} · ${NOMBRE_SERVICIO[/** @type {"repair" | "cleaning"} */ (s.service_type)] ?? s.service_type}` }),
    crear("dl", { clase: "admin-fechas" }, [...fila("Enviada", s.submitted_at), ...fila("Actualizada", s.updated_at)]),
  ]);
}

/** @param {any} p PedidoAdmin */
function crearFilaPedido(p) {
  const estado = ESTADO_ORDEN[p.status] ?? { texto: p.status, tono: "neutra" };
  return crear("div", { clase: "tarjeta admin-fila" }, [
    crear("div", { clase: "fila-entre" }, [crear("p", { clase: "tarjeta__titulo", texto: `Pedido ${folio(p.id)}` }), crearInsignia(estado.texto, estado.tono)]),
    crear("p", { clase: "tarjeta__detalle", texto: `${p.workshop_name ?? "Taller sin nombre"} · Fase ${p.phase} de 4: ${NOMBRE_FASE_CORTO[/** @type {1|2|3|4} */ (p.phase)] ?? ""}` }),
    crear("dl", { clase: "admin-fechas" }, [...fila("Creado", p.created_at), ...fila("Entrega prometida", p.due_date), ...fila("Listo", p.ready_at), ...fila("Entregado", p.delivered_at)]),
  ]);
}

/** @returns {Node} */
export function renderSolicitudesAdmin() {
  /** @type {{ status: string }} */
  const filtros = { status: "" };
  const lista = crearListaPaginada({
    cargar: (offset) => api.listRequests({ ...(filtros.status ? { status: filtros.status } : {}), limit: POR_PAGINA, offset }),
    crearFila: crearFilaSolicitud,
    vacio: "No hay solicitudes con ese estado.",
  });
  return crearPantalla({ titulo: "Solicitudes", volver: "/admin", clase: "admin" }, [
    crear("p", { clase: "tarjeta__detalle", texto: "Solo lectura: estatus y fechas. No incluye el chat ni las fotos." }),
    crearChipsFiltro(
      "Estado",
      [
        { texto: "Todas", valor: "" },
        { texto: "Abiertas", valor: "open" },
        { texto: "Cotizadas", valor: "quoted" },
        { texto: "Aceptadas", valor: "accepted" },
        { texto: "Rechazadas", valor: "declined" },
        { texto: "Canceladas", valor: "cancelled" },
      ],
      "",
      (valor) => {
        filtros.status = valor;
        lista.recargar();
      },
    ),
    lista.elemento,
  ]);
}

/** @returns {Node} */
export function renderPedidosAdmin() {
  /** @type {{ status: string }} */
  const filtros = { status: "" };
  const lista = crearListaPaginada({
    cargar: (offset) => api.listOrders({ ...(filtros.status ? { status: filtros.status } : {}), limit: POR_PAGINA, offset }),
    crearFila: crearFilaPedido,
    vacio: "No hay pedidos con ese estado.",
  });
  return crearPantalla({ titulo: "Pedidos", volver: "/admin", clase: "admin" }, [
    crear("p", { clase: "tarjeta__detalle", texto: "Solo lectura: fase, estatus y fechas. No incluye montos ni el PIN." }),
    crearChipsFiltro(
      "Estado",
      [
        { texto: "Todos", valor: "" },
        { texto: "En proceso", valor: "in_progress" },
        { texto: "Listos", valor: "ready" },
        { texto: "Entregados", valor: "delivered" },
        { texto: "Cancelados", valor: "cancelled" },
      ],
      "",
      (valor) => {
        filtros.status = valor;
        lista.recargar();
      },
    ),
    lista.elemento,
  ]);
}
