// Historial (Artesano), nuevo front: pedidos entregados del más reciente al más viejo, filtros por mes y por servicio, y
// un resumen arriba (entregados, a tiempo y calificación). Pestaña propia en la barra del artesano. En PC la lista
// es una tabla (fecha, servicio, cliente, folio, monto y si fue a tiempo).
import { NOMBRE_SERVICIO } from "../../map/componentes.js";
import { folio } from "../../chat/pages/chat.js";
import { api as apiPresupuestos } from "../../quotes/index.js";
import { api as apiSolicitudes } from "../../requests/index.js";
import { api as apiTaller } from "../../workshop/index.js";
import { aFecha, formatearFecha } from "../../../lib/fechas.js";
import { formatearMxn } from "../../../lib/money.js";
import { crear, enlace } from "../../../ui/dom.js";
import { cargarEn, crearVacio } from "../../../ui/estados.js";
import { crearFoto } from "../../../ui/foto.js";
import { crearInsignia, crearPantalla } from "../../../ui/layout.js";
import { api } from "../index.js";

const MESES_LARGOS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

/**
 * Clave de mes "2026-11" de una fecha ISO (hora local).
 * @param {string} valor
 * @returns {string}
 */
export function claveDeMes(valor) {
  const fecha = aFecha(valor);
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * "Noviembre 2026" para una clave "2026-11".
 * @param {string} clave
 * @returns {string}
 */
export function nombreDeMes(clave) {
  const [anio, mes] = clave.split("-").map(Number);
  const nombre = MESES_LARGOS[mes - 1] ?? "";
  return `${nombre.charAt(0).toUpperCase()}${nombre.slice(1)} ${anio}`;
}

/**
 * ¿Se entregó en o antes de la fecha prometida? null si falta alguna fecha.
 * @param {{ due_date?: string | null, delivered_at?: string | null }} pedido
 * @returns {boolean | null}
 */
export function entregadoATiempo(pedido) {
  if (!pedido.due_date || !pedido.delivered_at) return null;
  const entregado = aFecha(pedido.delivered_at);
  const prometido = aFecha(pedido.due_date);
  prometido.setHours(23, 59, 59, 999);
  return entregado.getTime() <= prometido.getTime();
}

/**
 * Entregados, del más reciente al más viejo, con los filtros de mes y servicio.
 * @param {any[]} pedidos
 * @param {Map<string, any>} solicitudes por id de solicitud (para el servicio)
 * @param {{ mes?: string, servicio?: "all" | "repair" | "cleaning" }} filtros
 * @returns {any[]}
 */
export function filtrarHistorial(pedidos, solicitudes, filtros = {}) {
  return pedidos
    .filter((p) => p.status === "delivered" && p.delivered_at)
    .filter((p) => !filtros.mes || filtros.mes === "all" || claveDeMes(p.delivered_at) === filtros.mes)
    .filter((p) => !filtros.servicio || filtros.servicio === "all" || solicitudes.get(p.request_id)?.service_type === filtros.servicio)
    .sort((a, b) => aFecha(b.delivered_at).getTime() - aFecha(a.delivered_at).getTime());
}

/**
 * Meses con entregas, del más reciente al más viejo.
 * @param {any[]} pedidos
 * @returns {string[]}
 */
export function mesesConEntregas(pedidos) {
  const meses = new Set(pedidos.filter((p) => p.status === "delivered" && p.delivered_at).map((p) => claveDeMes(p.delivered_at)));
  return [...meses].sort().reverse();
}

/**
 * Resumen de lo que se ve con los filtros: entregados y porcentaje a tiempo.
 * @param {any[]} entregados
 * @returns {{ total: number, aTiempo: number | null }}
 */
export function resumenHistorial(entregados) {
  const medibles = entregados.map(entregadoATiempo).filter((v) => v !== null);
  const aTiempo = medibles.length === 0 ? null : Math.round((medibles.filter(Boolean).length / medibles.length) * 100);
  return { total: entregados.length, aTiempo };
}

/**
 * @param {string} etiqueta
 * @param {string} valor
 */
const crearDato = (etiqueta, valor) => crear("div", { clase: "historial__dato" }, [crear("strong", { texto: valor }), crear("span", { texto: etiqueta })]);

/**
 * @param {any} pedido
 * @param {any | undefined} solicitud
 * @param {number | undefined} monto
 */
function crearFila(pedido, solicitud, monto) {
  const servicio = NOMBRE_SERVICIO[/** @type {"repair" | "cleaning"} */ (solicitud?.service_type)] ?? "Pedido";
  const aTiempo = entregadoATiempo(pedido);
  return crear("li", {}, [
    enlace(`/artesano/chat/${pedido.request_id}`, { clase: "tarjeta tarjeta--enlace historial__fila" }, [
      crearFoto(solicitud?.photos?.[0]?.url, "Foto del calzado", "foto--chica"),
      crear("div", { clase: "tarjeta__cuerpo" }, [
        crear("div", { clase: "fila-entre" }, [crear("p", { clase: "tarjeta__titulo", texto: servicio }), monto === undefined ? null : crear("strong", { clase: "historial__monto", texto: formatearMxn(monto) })]),
        crear("p", { clase: "tarjeta__detalle", texto: `${folio(pedido.id)} · ${solicitud?.counterpart?.full_name ?? "Cliente"}` }),
        crear("div", { clase: "fila-entre" }, [
          crear("span", { clase: "tarjeta__detalle", texto: `Entregado el ${formatearFecha(pedido.delivered_at)}` }),
          aTiempo === null ? null : crearInsignia(aTiempo ? "A tiempo" : "Con retraso", aTiempo ? "exito" : "miel"),
        ]),
      ]),
    ]),
  ]);
}

/**
 * Tabla de PC: una fila por entrega; el servicio lleva a la conversación con el cliente.
 * @param {any[]} visibles
 * @param {Map<string, any>} solicitudes
 * @param {Map<string, number>} montos
 * @returns {HTMLElement}
 */
function crearTabla(visibles, solicitudes, montos) {
  const encabezados = ["Entregado", "Servicio", "Cliente", "Folio", "Monto", "Entrega"];
  return crear("div", { clase: "historial__tabla-contenedor" }, [
    crear("table", { clase: "historial__tabla" }, [
      crear("caption", { clase: "oculto-visual", texto: "Pedidos entregados" }),
      crear("thead", {}, [crear("tr", {}, encabezados.map((t) => crear("th", { texto: t, attrs: { scope: "col" } })))]),
      crear(
        "tbody",
        {},
        visibles.map((p) => {
          const solicitud = solicitudes.get(p.request_id);
          const aTiempo = entregadoATiempo(p);
          const monto = montos.get(p.id);
          return crear("tr", {}, [
            crear("td", { texto: formatearFecha(p.delivered_at) }),
            crear("td", {}, [
              enlace(`/artesano/chat/${p.request_id}`, { clase: "historial__servicio", texto: NOMBRE_SERVICIO[/** @type {"repair" | "cleaning"} */ (solicitud?.service_type)] ?? "Pedido" }),
            ]),
            crear("td", { texto: solicitud?.counterpart?.full_name ?? "Cliente" }),
            crear("td", { clase: "historial__folio", texto: folio(p.id) }),
            crear("td", { clase: "historial__monto", texto: monto === undefined ? "—" : formatearMxn(monto) }),
            crear("td", {}, [aTiempo === null ? crear("span", { texto: "—" }) : crearInsignia(aTiempo ? "A tiempo" : "Con retraso", aTiempo ? "exito" : "miel")]),
          ]);
        }),
      ),
    ]),
  ]);
}

/**
 * @param {{ pedidos: any[], solicitudes: Map<string, any>, montos: Map<string, number>, calificacion: number | null }} datos
 */
function pintarHistorial({ pedidos, solicitudes, montos, calificacion }) {
  /** @type {{ mes: string, servicio: "all" | "repair" | "cleaning" }} */
  const filtros = { mes: "all", servicio: "all" };
  const resumen = crear("div", { clase: "historial__resumen" });
  const lista = crear("div");

  const selectorMes = /** @type {HTMLSelectElement} */ (
    crear(
      "select",
      { clase: "historial__mes", attrs: { "aria-label": "Mes" }, on: { change: () => ((filtros.mes = selectorMes.value), pintar()) } },
      [crear("option", { texto: "Todos los meses", attrs: { value: "all" } }), ...mesesConEntregas(pedidos).map((m) => crear("option", { texto: nombreDeMes(m), attrs: { value: m } }))],
    )
  );

  /** @type {HTMLButtonElement[]} */
  const chips = [];
  /**
   * @param {string} texto
   * @param {"all" | "repair" | "cleaning"} valor
   */
  const chip = (texto, valor) => {
    const boton = /** @type {HTMLButtonElement} */ (
      crear("button", {
        clase: "chip",
        texto,
        attrs: { type: "button", "aria-pressed": String(filtros.servicio === valor) },
        on: {
          click: () => {
            filtros.servicio = valor;
            chips.forEach((c) => c.setAttribute("aria-pressed", String(c === boton)));
            pintar();
          },
        },
      })
    );
    chips.push(boton);
    return boton;
  };

  function pintar() {
    const visibles = filtrarHistorial(pedidos, solicitudes, filtros);
    const { total, aTiempo } = resumenHistorial(visibles);
    resumen.replaceChildren(
      crearDato(total === 1 ? "Entregado" : "Entregados", String(total)),
      crearDato("A tiempo", aTiempo === null ? "—" : `${aTiempo}%`),
      crearDato("Calificación", calificacion === null ? "Nuevo" : `★ ${calificacion.toFixed(1)}`),
    );
    lista.replaceChildren(
      visibles.length === 0
        ? crearVacio(pedidos.some((p) => p.status === "delivered") ? "No hay entregas con esos filtros." : "Aún no has entregado pedidos. Aquí verás cada entrega.", null, { icono: "reloj" })
        : document.documentElement.hasAttribute("data-escritorio")
          ? crearTabla(visibles, solicitudes, montos)
          : crear("ul", { clase: "lista" }, visibles.map((p) => crearFila(p, solicitudes.get(p.request_id), montos.get(p.id)))),
    );
  }
  pintar();

  return [
    resumen,
    crear("div", { clase: "historial__filtros" }, [
      selectorMes,
      crear("div", { clase: "chips", attrs: { role: "group", "aria-label": "Servicio" } }, [chip("Todos", "all"), chip(NOMBRE_SERVICIO.repair, "repair"), chip(NOMBRE_SERVICIO.cleaning, "cleaning")]),
    ]),
    lista,
  ];
}

/** @returns {Promise<Node>} */
export async function renderHistorial() {
  const contenido = crear("div", { clase: "historial__contenido" });
  const pantalla = crearPantalla({ rol: "craftsman", activa: "historial", clase: "historial", titulo: "Historial", perfil: true }, [contenido]);
  cargarEn(contenido, async () => {
    const [pedidos, stats] = await Promise.all([api.listMyOrders(), apiTaller.getMyWorkshopStats().catch(() => null)]);
    const entregados = pedidos.filter((p) => p.status === "delivered");
    const [detalles, presupuestos] = await Promise.all([
      Promise.all(entregados.map((p) => apiSolicitudes.getRequest(p.request_id).catch(() => null))),
      Promise.all(entregados.map((p) => (p.quote_id ? apiPresupuestos.getQuote(p.quote_id).catch(() => null) : Promise.resolve(null)))),
    ]);
    /** @type {Map<string, number>} */
    const montos = new Map();
    entregados.forEach((p, i) => {
      if (presupuestos[i]) montos.set(p.id, presupuestos[i].amount_mxn);
    });
    return {
      pedidos: entregados,
      solicitudes: new Map(detalles.filter(Boolean).map((s) => [s.id, s])),
      montos,
      calificacion: stats?.rating_avg ?? null,
    };
  }, pintarHistorial);
  return pantalla;
}
