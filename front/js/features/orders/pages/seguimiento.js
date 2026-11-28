// 13 · Seguimiento del pedido (CU-05), nuevo front: aviso con la fase actual, línea de tiempo de las 4 fases con su foto
// de avance, total a pagar al recoger y "Escribir al taller" como acción principal. Se actualiza en tiempo real.
import { api as apiMapa } from "../../map/index.js";
import { NOMBRE_SERVICIO } from "../../map/componentes.js";
import { api as apiPresupuestos } from "../../quotes/index.js";
import { api as apiSolicitudes } from "../../requests/index.js";
import { folio } from "../../chat/pages/chat.js";
import { formatearFecha, formatearHora } from "../../../lib/fechas.js";
import { formatearMxn } from "../../../lib/money.js";
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
 * @returns {{ fase: number, nombre: string, estado: "hecha" | "actual" | "pendiente", detalle: string, corregida: boolean, nota: string | null, foto: string | null }[]}
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
    return { fase, nombre: NOMBRE_FASE[fase], estado, detalle, corregida: ultimo?.corrected ?? false, nota: ultimo?.note ?? null, foto: ultimo?.url ?? null };
  });
}

/**
 * Aviso de arriba: en qué va el pedido, en palabras sencillas.
 * @param {any} pedido
 * @returns {HTMLElement}
 */
function crearAvisoDeFase(pedido) {
  if (pedido.status === "ready" || pedido.status === "delivered") {
    const listo = pedido.status === "ready";
    return crear("div", { clase: "seguimiento__aviso seguimiento__aviso--listo" }, [
      icono("check", { tam: 20 }),
      crear("div", {}, [
        crear("p", { clase: "seguimiento__aviso-titulo", texto: listo ? "¡Tu calzado está listo!" : "Pedido entregado" }),
        crear("p", { texto: listo ? "Pasa al taller y muestra tu código de entrega." : "Gracias por restaurar en vez de tirar." }),
      ]),
    ]);
  }
  return crear("div", { clase: "seguimiento__aviso" }, [
    icono("reloj", { tam: 20 }),
    crear("div", {}, [
      crear("p", { clase: "seguimiento__aviso-titulo", texto: `Fase ${pedido.phase} de 4 · ${NOMBRE_FASE[pedido.phase] ?? ""}` }),
      crear("p", { texto: "El taller está trabajando en tu pedido." }),
    ]),
  ]);
}

/** @param {{ pedido: any, avances: any[], solicitud: any | null, taller: any | null, presupuesto: any | null }} datos */
function pintarSeguimiento({ pedido, avances, solicitud, taller, presupuesto }) {
  const estado = ESTADO_ORDEN[pedido.status] ?? ESTADO_ORDEN.in_progress;
  const servicio = solicitud ? NOMBRE_SERVICIO[/** @type {"repair" | "cleaning"} */ (solicitud.service_type)] : "Pedido";
  /** @param {boolean} principal */
  const escribir = (principal) =>
    enlace(`/chat/${pedido.request_id}`, { clase: `boton boton--bloque${principal ? "" : " boton--secundario"}` }, [icono("chat", { tam: 18 }), crear("span", { texto: "Escribir al taller" })]);

  // Una sola acción principal: recoger (listo), calificar (entregado) o escribir al taller (en proceso).
  /** @type {Node[]} */
  let acciones = [escribir(true)];
  if (pedido.status === "ready") {
    acciones = [enlace(`/pedido/${pedido.id}/recoger`, { clase: "boton boton--bloque" }, [icono("qr", { tam: 18 }), crear("span", { texto: "Recoger pedido" })]), escribir(false)];
  } else if (pedido.status === "delivered") {
    acciones = [enlace(`/pedido/${pedido.id}/calificar`, { clase: "boton boton--bloque" }, [icono("estrella", { tam: 18 }), crear("span", { texto: "Calificar al taller" })]), escribir(false)];
  }

  const resumen = crear("article", { clase: "tarjeta seguimiento__resumen" }, [
      crearFoto(solicitud?.photos?.[0]?.url, "Foto del calzado"),
      crear("div", { clase: "tarjeta__cuerpo" }, [
        crear("p", { clase: "tarjeta__titulo", texto: servicio }),
        crear("p", { clase: "tarjeta__detalle", texto: taller?.name ?? solicitud?.counterpart?.full_name ?? "Taller" }),
        pedido.due_date && pedido.status === "in_progress"
          ? crear("p", { clase: "tarjeta__detalle seguimiento__entrega" }, [crear("span", { texto: "Entrega estimada " }), crear("strong", { texto: formatearFecha(pedido.due_date) })])
          : null,
      ]),
      crearInsignia(estado.texto, pedido.status === "in_progress" ? "cenote" : estado.tono),
  ]);

  // Dos grupos: en PC son dos columnas (avance a la izquierda; taller, total y botones a la derecha). En el celular
  // se ven en una sola columna con el resumen hasta arriba (nuevo-front.css y escritorio.css).
  return [
    crear("div", { clase: "seguimiento__principal" }, [
      crearAvisoDeFase(pedido),
      // Misma barra de 4 pasos que en Inicio y Mis pedidos.
      crearPasos(pedido),
      crear(
        "ol",
        { clase: "linea-tiempo", attrs: { "aria-label": "Fases del pedido" } },
        lineaDeTiempo(pedido, avances).map((paso) =>
          crear("li", { clase: `linea-tiempo__paso linea-tiempo__paso--${paso.estado}`, attrs: { "aria-current": paso.estado === "actual" ? "step" : null } }, [
            crear("span", { clase: "linea-tiempo__marca", attrs: { "aria-hidden": "true" } }, [paso.estado === "hecha" ? icono("check", { tam: 14 }) : crear("span", { texto: String(paso.fase) })]),
            crear("div", { clase: "linea-tiempo__texto" }, [
              crear("p", { clase: "linea-tiempo__nombre", texto: paso.estado === "actual" ? `${paso.nombre} · en curso` : paso.nombre }),
              paso.detalle
                ? crear("p", { clase: "tarjeta__detalle", texto: paso.detalle })
                : paso.estado === "pendiente"
                  ? crear("p", { clase: "tarjeta__detalle", texto: "Pendiente" })
                  : null,
              paso.nota ? crear("p", { clase: "tarjeta__detalle linea-tiempo__nota", texto: `${paso.corregida ? "Corrección: " : ""}${paso.nota}` }) : null,
              paso.foto ? crearFoto(paso.foto, `Avance de la fase ${paso.fase}: ${paso.nombre}`, "linea-tiempo__foto") : null,
            ]),
            crear("span", { clase: "oculto-visual", texto: paso.estado === "hecha" ? "Completada" : paso.estado === "actual" ? "En curso" : "Pendiente" }),
          ]),
        ),
      ),
      avances.length === 0 ? crear("p", { clase: "texto-secundario", texto: "El taller subirá una foto en cada cambio de fase." }) : null,
    ]),
    crear("aside", { clase: "seguimiento__lateral" }, [
      resumen,
      presupuesto
        ? crear("div", { clase: "fila-entre seguimiento__total" }, [crear("span", { texto: "Total a pagar al recoger" }), crear("strong", { texto: formatearMxn(presupuesto.amount_mxn) })])
        : null,
      crear("div", { clase: "acciones acciones--columna" }, acciones),
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
        const [taller, presupuesto] = await Promise.all([
          apiMapa.getWorkshopProfile(pedido.workshop_id).catch(() => null),
          pedido.quote_id ? apiPresupuestos.getQuote(pedido.quote_id).catch(() => null) : Promise.resolve(null),
        ]);
        return { pedido, avances, solicitud, taller, presupuesto };
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
