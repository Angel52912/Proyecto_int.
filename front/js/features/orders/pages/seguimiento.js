// 13 · Seguimiento del pedido (CU-05): fase N de 4, barra de progreso, línea de tiempo y fotos de avance en tiempo real.
import { api as apiMapa } from "../../map/index.js";
import { NOMBRE_SERVICIO } from "../../map/componentes.js";
import { api as apiSolicitudes } from "../../requests/index.js";
import { folio } from "../../chat/pages/chat.js";
import { formatearFecha, formatearHora } from "../../../lib/fechas.js";
import { alSalir } from "../../../ui/ciclo.js";
import { crear, enlace } from "../../../ui/dom.js";
import { cargarEn } from "../../../ui/estados.js";
import { crearFoto } from "../../../ui/foto.js";
import { icono } from "../../../ui/iconos.js";
import { agregarChatEnBarra, crearInsignia, crearPantalla } from "../../../ui/layout.js";
import { ESTADO_ORDEN, NOMBRE_FASE } from "../fases.js";
import { crearPasos } from "../pasos.js";
import { api } from "../index.js";

/**
 * Estado de cada fase para la línea de tiempo.
 * @param {any} pedido Orden
 * @param {any[]} avances AvanceConFoto[] (del más antiguo al más reciente)
 * @returns {{ fase: number, nombre: string, estado: "hecha" | "actual" | "pendiente", detalle: string, corregida: boolean, nota: string | null }[]}
 */
export function lineaDeTiempo(pedido, avances) {
  const terminado = pedido.status === "ready" || pedido.status === "delivered";
  return [1, 2, 3, 4].map((fase) => {
    const ultimo = [...avances].reverse().find((a) => a.phase === fase);
    const estado = fase < pedido.phase || (terminado && fase === pedido.phase) ? "hecha" : fase === pedido.phase ? "actual" : "pendiente";
    let detalle = "";
    if (estado === "actual") detalle = ultimo ? `En curso · ${formatearFecha(ultimo.created_at)}` : "En curso";
    else if (ultimo) detalle = `${formatearFecha(ultimo.created_at)} · ${formatearHora(ultimo.created_at)}`;
    else if (estado === "pendiente" && fase === 4 && pedido.due_date) detalle = `Estimado ${formatearFecha(pedido.due_date)}`;
    return { fase, nombre: NOMBRE_FASE[fase], estado, detalle, corregida: ultimo?.corrected ?? false, nota: ultimo?.note ?? null };
  });
}

/** @param {{ pedido: any, avances: any[], solicitud: any | null, taller: any | null }} datos */
function pintarSeguimiento({ pedido, avances, solicitud, taller }) {
  const estado = ESTADO_ORDEN[pedido.status] ?? ESTADO_ORDEN.in_progress;
  const progreso = pedido.status === "in_progress" ? pedido.phase / 4 : 1;
  const servicio = solicitud ? NOMBRE_SERVICIO[/** @type {"repair" | "cleaning"} */ (solicitud.service_type)] : "Pedido";

  /** @type {Node | null} */
  let accionPrincipal = null;
  if (pedido.status === "ready") {
    accionPrincipal = enlace(`/pedido/${pedido.id}/recoger`, { clase: "boton boton--cenote boton--bloque" }, [icono("qr", { tam: 18 }), crear("span", { texto: "Recoger pedido" })]);
  } else if (pedido.status === "delivered") {
    accionPrincipal = enlace(`/pedido/${pedido.id}/calificar`, { clase: "boton boton--bloque" }, [icono("estrella", { tam: 18 }), crear("span", { texto: "Calificar al taller" })]);
  }

  return [
    pedido.status === "ready"
      ? crear("div", { clase: "aviso" }, [icono("check", { tam: 18 }), crear("p", { texto: "¡Tu calzado está listo! Pasa al taller y muestra tu código de entrega." })])
      : null,
    crear("article", { clase: "tarjeta" }, [
      crear("div", { clase: "tarjeta--enlace" }, [
        crearFoto(solicitud?.photos?.[0]?.url, "Foto del calzado"),
        crear("div", { clase: "tarjeta__cuerpo" }, [
          crear("p", { clase: "tarjeta__titulo", texto: servicio }),
          crear("p", { clase: "tarjeta__detalle", texto: taller?.name ?? solicitud?.counterpart?.full_name ?? "Taller" }),
        ]),
        crearInsignia(estado.texto, estado.tono),
      ]),
      crear("div", { clase: "fila-entre seguimiento__fase" }, [
        crear("span", { clase: "texto-secundario", texto: pedido.status === "in_progress" ? `Fase ${pedido.phase} de 4` : estado.texto }),
        crear("strong", { clase: "seguimiento__porcentaje", texto: `${Math.round(progreso * 100)}%` }),
      ]),
      // Misma barra de 4 pasos que en Inicio y Mis pedidos.
      crearPasos(pedido),
    ]),
    crear(
      "ol",
      { clase: "tarjeta linea-tiempo", attrs: { "aria-label": "Fases del pedido" } },
      lineaDeTiempo(pedido, avances).map((paso) =>
        crear("li", { clase: `linea-tiempo__paso linea-tiempo__paso--${paso.estado}`, attrs: { "aria-current": paso.estado === "actual" ? "step" : null } }, [
          crear("span", { clase: "linea-tiempo__marca", attrs: { "aria-hidden": "true" } }, [paso.estado === "hecha" ? icono("check", { tam: 14 }) : null]),
          crear("div", {}, [
            crear("p", { clase: "linea-tiempo__nombre", texto: paso.nombre }),
            paso.detalle ? crear("p", { clase: "tarjeta__detalle", texto: paso.detalle }) : null,
            paso.nota ? crear("p", { clase: "tarjeta__detalle linea-tiempo__nota", texto: `${paso.corregida ? "Corrección: " : ""}${paso.nota}` }) : null,
          ]),
          crear("span", { clase: "oculto-visual", texto: paso.estado === "hecha" ? "Completada" : paso.estado === "actual" ? "En curso" : "Pendiente" }),
        ]),
      ),
    ),
    crear("section", { clase: "seccion" }, [
      crear("div", { clase: "seccion__encabezado" }, [
        crear("h2", { clase: "seccion__titulo", texto: "Fotos de avance" }),
        crear("span", { clase: "texto-secundario", texto: avances.length === 1 ? "1 foto" : `${avances.length} fotos` }),
      ]),
      avances.length === 0
        ? crear("p", { clase: "texto-secundario", texto: "El taller subirá una foto en cada cambio de fase." })
        : crear(
            "div",
            { clase: "galeria" },
            [...avances].reverse().map((a) => crearFoto(a.url, `Avance de la fase ${a.phase}: ${NOMBRE_FASE[a.phase]}`)),
          ),
    ]),
    crear("div", { clase: "acciones acciones--columna" }, [
      accionPrincipal,
      enlace(`/chat/${pedido.request_id}`, { clase: "boton boton--secundario boton--bloque" }, [icono("chat", { tam: 18 }), crear("span", { texto: "Escribir al taller" })]),
    ]),
  ];
}

/** @param {import("../../../router.js").Contexto} contexto */
export async function renderSeguimiento({ params }) {
  const contenido = crear("div", { clase: "seguimiento__contenido" });
  const pantalla = crearPantalla({ rol: "client", activa: "pedidos", titulo: `Pedido ${folio(params.orderId)}`, volver: "/pedidos", clase: "seguimiento" }, [contenido]);

  const cargar = () =>
    cargarEn(
      contenido,
      async () => {
        const pedido = await api.getOrder(params.orderId);
        agregarChatEnBarra(pantalla, `/chat/${pedido.request_id}`, "Escribir al taller");
        const [avances, solicitud] = await Promise.all([api.listOrderUpdates(pedido.id), apiSolicitudes.getRequest(pedido.request_id).catch(() => null)]);
        const taller = await apiMapa.getWorkshopProfile(pedido.workshop_id).catch(() => null);
        return { pedido, avances, solicitud, taller };
      },
      pintarSeguimiento,
      { not_found: "No encontramos este pedido.", invalid_input: "No encontramos este pedido." },
    );
  cargar();

  // Tiempo real: avances de fase y avisos de "listo" o "entregado".
  /** @type {Array<() => void>} */
  const cancelaciones = [];
  let salio = false;
  alSalir(() => {
    salio = true;
    cancelaciones.forEach((c) => c());
  });
  api
    .subscribeToOrderUpdates(params.orderId, () => cargar())
    .then((c) => (salio ? c() : cancelaciones.push(c)))
    .catch(() => {});
  apiSolicitudes
    .subscribeToNotifications((aviso) => {
      if (aviso.payload?.order_id === params.orderId && ["order_ready", "order_delivered"].includes(aviso.type)) cargar();
    })
    .then((c) => (salio ? c() : cancelaciones.push(c)))
    .catch(() => {});

  return pantalla;
}
