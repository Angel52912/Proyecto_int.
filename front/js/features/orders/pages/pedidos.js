// 16 · Mis pedidos (Cliente): pestañas Activos e Historial con solicitudes y pedidos.
import { api as apiMapa } from "../../map/index.js";
import { NOMBRE_SERVICIO } from "../../map/componentes.js";
import { api as apiSolicitudes } from "../../requests/index.js";
import { folio } from "../../chat/pages/chat.js";
import { formatearFecha } from "../../../lib/fechas.js";
import { crear, enlace } from "../../../ui/dom.js";
import { cargarEn, crearVacio } from "../../../ui/estados.js";
import { crearFoto } from "../../../ui/foto.js";
import { crearEstrellas, crearInsignia, crearPantalla, crearProgreso } from "../../../ui/layout.js";
import { ESTADO_ORDEN, ESTADO_SOLICITUD } from "../fases.js";
import { api } from "../index.js";

/**
 * @typedef {{ id: string, ruta: string, titulo: string, taller: string, insignia: { texto: string, tono: any }, progreso: number | null, fecha: string, activo: boolean, foto: string | null, pendienteCalificar: boolean, rating: number | null }} Elemento
 */

/**
 * Une pedidos y solicitudes en una sola lista. Una solicitud aceptada se muestra como su pedido.
 * @param {any[]} pedidos
 * @param {any[]} solicitudes
 * @param {Set<string>} pendientes ids de pedidos entregados sin calificar
 * @param {Map<string, string>} nombres nombre del taller por id
 * @returns {Elemento[]}
 */
export function elementosDePedidos(pedidos, solicitudes, pendientes, nombres) {
  const porSolicitud = new Map(solicitudes.map((s) => [s.id, s]));
  const conPedido = new Set(pedidos.map((p) => p.request_id));
  /** @type {Elemento[]} */
  const elementos = pedidos.map((p) => {
    const s = porSolicitud.get(p.request_id);
    const servicio = NOMBRE_SERVICIO[/** @type {"repair" | "cleaning"} */ (s?.service_type)] ?? "Pedido";
    const activo = p.status === "in_progress" || p.status === "ready";
    return {
      id: p.id,
      ruta: pendientes.has(p.id) ? `/pedido/${p.id}/calificar` : p.status === "ready" ? `/pedido/${p.id}/recoger` : `/pedido/${p.id}`,
      titulo: `${servicio} ${folio(p.id)}`,
      taller: nombres.get(p.workshop_id) ?? "Taller",
      insignia: p.status === "in_progress" ? { texto: servicio, tono: s?.service_type === "cleaning" ? "miel" : "cuero" } : ESTADO_ORDEN[p.status],
      progreso: p.status === "in_progress" ? p.phase / 4 : p.status === "ready" ? 1 : null,
      fecha: p.delivered_at ?? p.updated_at ?? p.created_at,
      activo,
      foto: null,
      pendienteCalificar: pendientes.has(p.id),
      rating: null,
    };
  });
  for (const s of solicitudes) {
    if (conPedido.has(s.id)) continue;
    const activa = ["draft", "open", "quoted"].includes(s.status);
    const insignia = s.status === "quoted" ? { texto: "Cotización", tono: "cenote" } : s.status === "open" ? { texto: "Enviada", tono: "miel" } : ESTADO_SOLICITUD[s.status];
    elementos.push({
      id: s.id,
      ruta: s.status === "draft" ? `/solicitar/${s.workshop_id}` : `/chat/${s.id}`,
      titulo: `${NOMBRE_SERVICIO[/** @type {"repair" | "cleaning"} */ (s.service_type)]} ${folio(s.id)}`,
      taller: nombres.get(s.workshop_id) ?? "Taller",
      insignia,
      progreso: s.status === "quoted" ? 0.1 : null,
      fecha: s.submitted_at ?? s.created_at,
      activo: activa,
      foto: null,
      pendienteCalificar: false,
      rating: null,
    });
  }
  return elementos.sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));
}

/** @param {Elemento} e */
function crearTarjeta(e) {
  return crear("li", {}, [
    enlace(e.ruta, { clase: "tarjeta tarjeta--enlace pedido-tarjeta" }, [
      crearFoto(e.foto, ""),
      crear("div", { clase: "tarjeta__cuerpo" }, [
        crear("div", { clase: "fila-entre" }, [crear("p", { clase: "tarjeta__titulo", texto: e.titulo }), crearInsignia(e.insignia.texto, e.insignia.tono)]),
        crear("p", { clase: "tarjeta__detalle", texto: e.activo ? e.taller : `${e.taller} · ${formatearFecha(e.fecha)}` }),
        e.progreso !== null ? crearProgreso(e.progreso, "Avance") : null,
        e.pendienteCalificar ? crear("p", { clase: "pedido-tarjeta__calificar", texto: "Califica este pedido" }) : null,
        e.rating !== null ? crearEstrellas(e.rating) : null,
      ]),
    ]),
  ]);
}

/**
 * @param {Elemento[]} lista
 * @param {string} vacio
 */
const crearLista = (lista, vacio) => (lista.length === 0 ? crearVacio(vacio, enlace("/talleres", { clase: "boton", texto: "Buscar un taller" }), { icono: "pedidos" }) : crear("ul", { clase: "lista" }, lista.map(crearTarjeta)));

/** @param {Elemento[]} elementos */
function pintarPedidos(elementos) {
  const activos = elementos.filter((e) => e.activo);
  const historial = elementos.filter((e) => !e.activo);
  const panelActivos = crear("div", { clase: "pedidos__panel", attrs: { role: "tabpanel", id: "panel-activos", "aria-labelledby": "pestana-activos" } }, [
    crearLista(activos, "No tienes pedidos activos."),
    historial.length > 0
      ? crear("section", { clase: "seccion" }, [crear("h2", { clase: "texto-secundario pedidos__subtitulo", texto: "Terminados" }), crear("ul", { clase: "lista" }, historial.slice(0, 3).map(crearTarjeta))])
      : null,
  ]);
  const panelHistorial = crear("div", { clase: "pedidos__panel", attrs: { role: "tabpanel", id: "panel-historial", "aria-labelledby": "pestana-historial", hidden: true } }, [
    crearLista(historial, "Aún no tienes pedidos terminados."),
  ]);

  /** @param {"activos" | "historial"} cual */
  function elegir(cual) {
    pestanaActivos.setAttribute("aria-selected", String(cual === "activos"));
    pestanaHistorial.setAttribute("aria-selected", String(cual === "historial"));
    pestanaActivos.tabIndex = cual === "activos" ? 0 : -1;
    pestanaHistorial.tabIndex = cual === "historial" ? 0 : -1;
    panelActivos.hidden = cual !== "activos";
    panelHistorial.hidden = cual !== "historial";
  }
  /** @param {KeyboardEvent} evento */
  const teclas = (evento) => {
    if (evento.key === "ArrowRight" || evento.key === "ArrowLeft") {
      const siguiente = pestanaActivos.getAttribute("aria-selected") === "true" ? "historial" : "activos";
      elegir(siguiente);
      (siguiente === "activos" ? pestanaActivos : pestanaHistorial).focus();
    }
  };
  const pestanaActivos = crear("button", {
    clase: "pestanas__boton",
    texto: `Activos (${activos.length})`,
    attrs: { type: "button", role: "tab", id: "pestana-activos", "aria-controls": "panel-activos", "aria-selected": "true" },
    on: { click: () => elegir("activos"), keydown: /** @type {EventListener} */ (teclas) },
  });
  const pestanaHistorial = crear("button", {
    clase: "pestanas__boton",
    texto: "Historial",
    attrs: { type: "button", role: "tab", id: "pestana-historial", "aria-controls": "panel-historial", "aria-selected": "false", tabindex: -1 },
    on: { click: () => elegir("historial"), keydown: /** @type {EventListener} */ (teclas) },
  });
  return [crear("div", { clase: "pestanas", attrs: { role: "tablist", "aria-label": "Mis pedidos" } }, [pestanaActivos, pestanaHistorial]), panelActivos, panelHistorial];
}

/** @returns {Promise<Node>} */
export async function renderPedidos() {
  const contenido = crear("div", { clase: "pedidos__contenido" });
  const pantalla = crearPantalla({ rol: "client", activa: "pedidos", clase: "pedidos" }, [crear("h1", { clase: "pedidos__titulo", texto: "Mis pedidos" }), contenido]);
  cargarEn(contenido, async () => {
    const [pedidos, solicitudes, pendientes] = await Promise.all([api.listMyOrders(), apiSolicitudes.listMyRequests(), api.listPendingReviews()]);
    const idsTaller = [...new Set([...pedidos.map((p) => p.workshop_id), ...solicitudes.map((s) => s.workshop_id)])];
    const nombres = new Map(
      await Promise.all(idsTaller.map(async (id) => /** @type {[string, string]} */ ([id, (await apiMapa.getWorkshopProfile(id).catch(() => null))?.name ?? "Taller"]))),
    );
    // Marca las reseñas ya hechas en el historial (solo los pedidos entregados).
    const elementos = elementosDePedidos(pedidos, solicitudes, new Set(pendientes.map((p) => p.id)), nombres);
    await Promise.all(
      elementos
        .filter((e) => e.insignia === ESTADO_ORDEN.delivered && !e.pendienteCalificar)
        .map(async (e) => {
          e.rating = (await api.getOrderReview(e.id).catch(() => null))?.rating ?? null;
        }),
    );
    return elementos;
  }, pintarPedidos);
  return pantalla;
}
