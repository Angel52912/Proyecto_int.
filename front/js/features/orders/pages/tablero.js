// 20 · Tablero (Artesano, CU-05), nuevo front: qué hacer hoy. Tres números del día (Nuevas, En proceso, Listos) y tres
// bloques con su acción directa: solicitudes nuevas (Hacer presupuesto), pedidos en proceso por fase (Avanzar fase) y
// listos para entregar (Entregar).
import { NOMBRE_SERVICIO } from "../../map/componentes.js";
import { api as apiSolicitudes } from "../../requests/index.js";
import { crearCampana } from "../../requests/avisos.js";
import { folio } from "../../chat/pages/chat.js";
import { diasHasta, formatearFecha, formatearHace } from "../../../lib/fechas.js";
import { alSalir } from "../../../ui/ciclo.js";
import { crear, enlace } from "../../../ui/dom.js";
import { cargarEn, crearVacio } from "../../../ui/estados.js";
import { crearFoto } from "../../../ui/foto.js";
import { icono } from "../../../ui/iconos.js";
import { crearPantalla } from "../../../ui/layout.js";
import { NOMBRE_FASE_CORTO } from "../fases.js";
import { crearPasos } from "../pasos.js";
import { api } from "../index.js";

/** Cuántas solicitudes nuevas se muestran en el Tablero (el resto, en la pestaña Solicitudes). */
const MAX_NUEVAS = 3;

/**
 * Agrupa los pedidos activos por columna: fases 1 a 4 (en proceso) y "listo" (esperan entrega).
 * @param {any[]} pedidos
 * @returns {{ 1: any[], 2: any[], 3: any[], 4: any[], listo: any[] }}
 */
export function columnasDelTablero(pedidos) {
  /** @type {{ 1: any[], 2: any[], 3: any[], 4: any[], listo: any[] }} */
  const columnas = { 1: [], 2: [], 3: [], 4: [], listo: [] };
  for (const p of pedidos) {
    if (p.status === "ready") columnas.listo.push(p);
    else if (p.status === "in_progress") columnas[/** @type {1|2|3|4} */ (p.phase)].push(p);
  }
  return columnas;
}

/**
 * Texto y tono de la fecha de entrega: "Entrega 26 nov", "Entrega hoy" o "Atrasado · 20 nov".
 * @param {string | null | undefined} fecha "AAAA-MM-DD"
 * @param {Date} [ahora]
 * @returns {{ texto: string, atrasado: boolean } | null}
 */
export function textoEntrega(fecha, ahora = new Date()) {
  if (!fecha) return null;
  const dias = diasHasta(fecha, ahora);
  if (dias < 0) return { texto: `Atrasado · ${formatearFecha(fecha, ahora)}`, atrasado: true };
  if (dias === 0) return { texto: "Entrega hoy", atrasado: false };
  return { texto: `Entrega ${formatearFecha(fecha, ahora)}`, atrasado: false };
}

/**
 * "Viernes 27 nov": fecha de hoy para el encabezado del Tablero.
 * @param {Date} [ahora]
 * @returns {string}
 */
export function fechaDelTablero(ahora = new Date()) {
  const texto = new Intl.DateTimeFormat("es-MX", { weekday: "long", day: "numeric", month: "short", timeZone: "America/Merida" }).format(ahora).replace(/[.,]/g, "").replace(/ de /g, " ");
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/**
 * @param {string} etiqueta
 * @param {number} valor
 * @param {"cuero" | "neutra" | "exito"} tono
 * @param {string} ruta
 */
const crearNumero = (etiqueta, valor, tono, ruta) =>
  enlace(ruta, { clase: `tablero__numero tablero__numero--${tono}` }, [crear("strong", { texto: String(valor) }), crear("span", { texto: etiqueta })]);

/** @param {any} detalle SolicitudDetalle */
function crearNueva(detalle) {
  const servicio = NOMBRE_SERVICIO[/** @type {"repair" | "cleaning"} */ (detalle.service_type)] ?? "Solicitud";
  return crear("li", { clase: "tarjeta tablero__tarjeta" }, [
    crear("div", { clase: "fila-entre" }, [
      crear("p", { clase: "tarjeta__titulo", texto: `${servicio} · ${detalle.counterpart?.full_name ?? "Cliente"}` }),
      crear("span", { clase: "texto-secundario", texto: formatearHace(detalle.submitted_at ?? detalle.created_at) }),
    ]),
    crear("p", { clase: "tarjeta__detalle tablero__descripcion", texto: detalle.description }),
    enlace(`/artesano/solicitud/${detalle.id}`, { clase: "boton boton--bloque tablero__accion", texto: "Hacer presupuesto" }),
  ]);
}

/**
 * @param {any} pedido
 * @param {any | undefined} solicitud
 */
function crearEnProceso(pedido, solicitud) {
  const servicio = NOMBRE_SERVICIO[/** @type {"repair" | "cleaning"} */ (solicitud?.service_type)] ?? "Pedido";
  const entrega = textoEntrega(pedido.due_date);
  return crear("li", {}, [
    enlace(`/artesano/pedido/${pedido.id}`, { clase: "tarjeta tarjeta--enlace tablero__tarjeta tablero__pedido" }, [
      crearFoto(solicitud?.photos?.[0]?.url, "Foto del calzado", "foto--chica"),
      crear("div", { clase: "tarjeta__cuerpo" }, [
        crear("div", { clase: "fila-entre" }, [
          crear("p", { clase: "tarjeta__titulo", texto: servicio }),
          crear("span", { clase: "tablero__fase", texto: `Fase ${pedido.phase} · ${NOMBRE_FASE_CORTO[/** @type {1|2|3|4} */ (pedido.phase)] ?? ""}` }),
        ]),
        crear("p", { clase: "tarjeta__detalle", texto: `${folio(pedido.id)} · ${solicitud?.counterpart?.full_name ?? "Cliente"}` }),
        crearPasos(pedido),
        entrega ? crear("p", { clase: `tablero__entrega${entrega.atrasado ? " tablero__entrega--atrasado" : ""}`, texto: entrega.texto }) : null,
      ]),
    ]),
  ]);
}

/**
 * @param {any} pedido
 * @param {any | undefined} solicitud
 */
function crearListo(pedido, solicitud) {
  const servicio = NOMBRE_SERVICIO[/** @type {"repair" | "cleaning"} */ (solicitud?.service_type)] ?? "Pedido";
  return crear("li", { clase: "tarjeta tablero__tarjeta tablero__listo" }, [
    crear("div", { clase: "tarjeta__cuerpo" }, [
      crear("p", { clase: "tarjeta__titulo", texto: `${servicio} · ${solicitud?.counterpart?.full_name ?? "Cliente"}` }),
      crear("span", { clase: "insignia insignia--exito", texto: "Listo para entregar" }),
    ]),
    enlace(`/artesano/pedido/${pedido.id}/entrega`, { clase: "boton boton--secundario tablero__entregar" }, [icono("qr", { tam: 16 }), crear("span", { texto: "Entregar" })]),
  ]);
}

/**
 * @param {string} titulo
 * @param {Node} contenido
 * @param {Node | null} [extra]
 */
const crearBloque = (titulo, contenido, extra = null) =>
  crear("section", { clase: "seccion" }, [crear("div", { clase: "seccion__encabezado" }, [crear("h2", { clase: "seccion__titulo", texto: titulo }), extra]), contenido]);

/** @param {{ pedidos: any[], solicitudes: Map<string, any>, nuevas: any[] }} datos */
function pintarTablero({ pedidos, solicitudes, nuevas }) {
  const columnas = columnasDelTablero(pedidos);
  const enProceso = [...columnas[1], ...columnas[2], ...columnas[3], ...columnas[4]];
  const bloques = [
    crear("div", { clase: "tablero__numeros" }, [
      crearNumero("Nuevas", nuevas.length, "cuero", "/artesano/solicitudes"),
      crearNumero("En proceso", enProceso.length, "neutra", "/artesano/tablero"),
      crearNumero("Listos", columnas.listo.length, "exito", "/artesano/tablero"),
    ]),
  ];
  if (nuevas.length > 0) {
    bloques.push(
      crearBloque(
        "Solicitudes nuevas",
        crear("ul", { clase: "lista" }, nuevas.slice(0, MAX_NUEVAS).map(crearNueva)),
        nuevas.length > MAX_NUEVAS ? enlace("/artesano/solicitudes", { clase: "boton-texto", texto: "Ver todas" }) : null,
      ),
    );
  }
  bloques.push(
    crearBloque(
      "En proceso",
      enProceso.length === 0
        ? crear("p", { clase: "texto-secundario", texto: "Sin pedidos en proceso. Aparecen aquí cuando un cliente acepta tu presupuesto." })
        : crear("ul", { clase: "lista" }, enProceso.map((p) => crearEnProceso(p, solicitudes.get(p.request_id)))),
    ),
  );
  if (columnas.listo.length > 0) {
    bloques.push(crearBloque("Listos para entregar", crear("ul", { clase: "lista" }, columnas.listo.map((p) => crearListo(p, solicitudes.get(p.request_id))))));
  }
  if (nuevas.length === 0 && pedidos.length === 0) {
    bloques.push(crearVacio("Todo al día. Te avisamos cuando llegue una solicitud.", enlace("/artesano/solicitudes", { clase: "boton boton--secundario", texto: "Ver solicitudes" }), { icono: "tablero" }));
  }
  return bloques;
}

/** @returns {Promise<Node>} */
export async function renderTablero() {
  const contenido = crear("div", { clase: "tablero__contenido" });
  const pantalla = crearPantalla({ rol: "craftsman", activa: "tablero", clase: "tablero", titulo: "Tablero", accion: crearCampana("craftsman"), perfil: true }, [
    crear("p", { clase: "tablero__fecha", texto: fechaDelTablero() }),
    contenido,
  ]);
  const cargar = () =>
    cargarEn(
      contenido,
      async () => {
        const [pedidos, propias] = await Promise.all([api.listMyOrders(), apiSolicitudes.listMyRequests().catch(() => [])]);
        const activos = pedidos.filter((p) => p.status === "in_progress" || p.status === "ready");
        const abiertas = propias.filter((s) => s.status === "open");
        const [detallesPedidos, nuevas] = await Promise.all([
          Promise.all(activos.map((p) => apiSolicitudes.getRequest(p.request_id).catch(() => null))),
          Promise.all(abiertas.map((s) => apiSolicitudes.getRequest(s.id).catch(() => ({ ...s, photos: [], counterpart: null })))),
        ]);
        return { pedidos: activos, solicitudes: new Map(detallesPedidos.filter(Boolean).map((s) => [s.id, s])), nuevas };
      },
      pintarTablero,
    );
  cargar();

  // Se actualiza solo cuando llega una solicitud nueva, se cancela una o aceptan un presupuesto.
  let salio = false;
  /** @type {(() => void) | null} */
  let cancelar = null;
  alSalir(() => {
    salio = true;
    cancelar?.();
  });
  apiSolicitudes
    .subscribeToNotifications((aviso) => {
      if (["request_received", "request_cancelled", "quote_accepted"].includes(aviso.type)) cargar();
    })
    .then((c) => {
      if (salio) c();
      else cancelar = c;
    })
    .catch(() => {});
  return pantalla;
}
