// 20 · Tablero Kanban (Artesano, CU-05): pedidos en 4 columnas por fase y una de listos para entrega.
import { NOMBRE_SERVICIO } from "../../map/componentes.js";
import { api as apiSolicitudes } from "../../requests/index.js";
import { folio } from "../../chat/pages/chat.js";
import { crear, enlace } from "../../../ui/dom.js";
import { cargarEn, crearVacio } from "../../../ui/estados.js";
import { crearFoto } from "../../../ui/foto.js";
import { icono } from "../../../ui/iconos.js";
import { crearPantalla } from "../../../ui/layout.js";
import { NOMBRE_FASE_CORTO } from "../fases.js";
import { api } from "../index.js";

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
 * @param {any} pedido
 * @param {any | undefined} solicitud
 * @param {string} tono
 */
function crearTarjeta(pedido, solicitud, tono) {
  const ruta = pedido.status === "ready" ? `/artesano/pedido/${pedido.id}/entrega` : `/artesano/pedido/${pedido.id}`;
  const servicio = NOMBRE_SERVICIO[/** @type {"repair" | "cleaning"} */ (solicitud?.service_type)] ?? "Pedido";
  return crear("li", {}, [
    enlace(ruta, { clase: `kanban__tarjeta kanban__tarjeta--${tono}` }, [
      crearFoto(solicitud?.photos?.[0]?.url, "Foto del calzado"),
      crear("span", { clase: "kanban__nombre", texto: `${servicio} ${folio(pedido.id)}` }),
      crear("span", { clase: "kanban__cliente", texto: solicitud?.counterpart?.full_name ?? "" }),
    ]),
  ]);
}

/** @param {{ pedidos: any[], solicitudes: Map<string, any> }} datos */
function pintarTablero({ pedidos, solicitudes }) {
  const columnas = columnasDelTablero(pedidos);
  const total = pedidos.filter((p) => p.status === "in_progress" || p.status === "ready").length;
  /** @type {Array<[keyof typeof columnas, string, string]>} */
  const definicion = [
    [1, NOMBRE_FASE_CORTO[1], "miel"],
    [2, NOMBRE_FASE_CORTO[2], "cenote"],
    [3, NOMBRE_FASE_CORTO[3], "cuero"],
    [4, NOMBRE_FASE_CORTO[4], "exito"],
    ["listo", "Listos", "exito"],
  ];
  if (total === 0) return [crearVacio("No tienes pedidos en el taller. Aparecerán aquí cuando un cliente acepte tu presupuesto.", enlace("/artesano/solicitudes", { clase: "boton-texto", texto: "Ver solicitudes" }))];
  return [
    crear("p", { clase: "insignia insignia--neutra kanban__total", texto: total === 1 ? "1 pedido" : `${total} pedidos` }),
    crear(
      "div",
      { clase: "kanban", attrs: { role: "list", "aria-label": "Tablero de pedidos" } },
      definicion.map(([clave, titulo, tono]) =>
        crear("section", { clase: "kanban__columna", attrs: { role: "listitem", "aria-label": `${titulo}: ${columnas[clave].length}` } }, [
          crear("h2", { clase: `kanban__titulo insignia insignia--${tono}`, texto: titulo }),
          columnas[clave].length === 0
            ? crear("p", { clase: "kanban__vacia texto-secundario", texto: "Sin pedidos" })
            : crear(
                "ul",
                { clase: "kanban__lista" },
                columnas[clave].map((p) => crearTarjeta(p, solicitudes.get(p.request_id), tono)),
              ),
        ]),
      ),
    ),
    crear("div", { clase: "aviso" }, [icono("camara", { tam: 18 }), crear("p", { texto: "Sube una foto al mover un pedido de fase para que el cliente vea el avance." })]),
  ];
}

/** @returns {Promise<Node>} */
export async function renderTablero() {
  const contenido = crear("div", { clase: "tablero__contenido" });
  const pantalla = crearPantalla({ rol: "craftsman", activa: "tablero", clase: "tablero" }, [crear("h1", { clase: "pantalla__titulo", texto: "Tablero" }), contenido]);
  cargarEn(
    contenido,
    async () => {
      const pedidos = await api.listMyOrders();
      const activos = pedidos.filter((p) => p.status === "in_progress" || p.status === "ready");
      const detalles = await Promise.all(activos.map((p) => apiSolicitudes.getRequest(p.request_id).catch(() => null)));
      return { pedidos: activos, solicitudes: new Map(detalles.filter(Boolean).map((s) => [s.id, s])) };
    },
    pintarTablero,
  );
  return pantalla;
}
