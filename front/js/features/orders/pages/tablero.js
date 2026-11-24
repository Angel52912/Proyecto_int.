// 20 · Tablero Kanban (Artesano, CU-05): pedidos en 4 columnas por fase y una de listos para entrega.
import { NOMBRE_SERVICIO } from "../../map/componentes.js";
import { api as apiSolicitudes } from "../../requests/index.js";
import { crearCampana } from "../../requests/avisos.js";
import { folio } from "../../chat/pages/chat.js";
import { diasHasta, formatearFecha } from "../../../lib/fechas.js";
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
 * @param {any} pedido
 * @param {any | undefined} solicitud
 * @param {string} tono
 */
function crearTarjeta(pedido, solicitud, tono) {
  const listo = pedido.status === "ready";
  const ruta = listo ? `/artesano/pedido/${pedido.id}/entrega` : `/artesano/pedido/${pedido.id}`;
  const servicio = NOMBRE_SERVICIO[/** @type {"repair" | "cleaning"} */ (solicitud?.service_type)] ?? "Pedido";
  const entrega = listo ? null : textoEntrega(pedido.due_date);
  return crear("li", {}, [
    enlace(ruta, { clase: `kanban__tarjeta kanban__tarjeta--${tono}` }, [
      crear("div", { clase: "kanban__fila" }, [
        crearFoto(solicitud?.photos?.[0]?.url, "Foto del calzado", "kanban__foto"),
        crear("div", { clase: "kanban__texto" }, [
          crear("span", { clase: "kanban__nombre", texto: servicio }),
          crear("span", { clase: "kanban__cliente", texto: `${folio(pedido.id)} · ${solicitud?.counterpart?.full_name ?? "Cliente"}` }),
        ]),
      ]),
      entrega
        ? crear("span", { clase: `kanban__entrega${entrega.atrasado ? " kanban__entrega--atrasado" : ""}` }, [icono("calendario", { tam: 12 }), crear("span", { texto: entrega.texto })])
        : null,
      listo ? crear("span", { clase: "kanban__accion" }, [icono("qr", { tam: 14 }), crear("span", { texto: "Verificar entrega" })]) : null,
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
  if (total === 0) return [crearVacio("No tienes pedidos en el taller. Aparecerán aquí cuando un cliente acepte tu presupuesto.", enlace("/artesano/solicitudes", { clase: "boton", texto: "Ver solicitudes" }), { icono: "tablero" })];

  const secciones = definicion.map(([clave, titulo, tono]) =>
    crear("section", { clase: `kanban__columna kanban__columna--${tono}`, attrs: { role: "listitem", "aria-label": `${titulo}: ${columnas[clave].length}` } }, [
      crear("div", { clase: "kanban__encabezado" }, [
        crear("h2", { clase: "kanban__titulo", texto: titulo }),
        crear("span", { clase: `insignia insignia--${tono}`, texto: String(columnas[clave].length), attrs: { "aria-hidden": "true" } }),
      ]),
      columnas[clave].length === 0
        ? crear("p", { clase: "kanban__vacia", texto: "Sin pedidos" })
        : crear(
            "ul",
            { clase: "kanban__lista" },
            columnas[clave].map((p) => crearTarjeta(p, solicitudes.get(p.request_id), tono)),
          ),
    ]),
  );

  // Resumen: una pastilla por columna con su número; al tocarla, el tablero se desliza a esa columna.
  const resumen = crear(
    "div",
    { clase: "chips kanban__resumen", attrs: { role: "group", "aria-label": "Ir a una columna" } },
    definicion.map(([clave, titulo], i) =>
      crear(
        "button",
        {
          clase: `chip${columnas[clave].length > 0 ? " kanban__chip--con" : ""}`,
          attrs: { type: "button" },
          on: { click: () => secciones[i].scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", inline: "start", block: "nearest" }) },
        },
        [crear("span", { texto: titulo }), crear("strong", { texto: String(columnas[clave].length) })],
      ),
    ),
  );

  const kanban = crear("div", { clase: "kanban", attrs: { role: "list", "aria-label": "Tablero de pedidos" } }, secciones);
  // Al abrir, el tablero arranca en la primera columna con pedidos (no en una vacía).
  const primera = secciones[definicion.findIndex(([clave]) => columnas[clave].length > 0)];
  requestAnimationFrame(() => {
    if (!primera?.isConnected) return;
    kanban.scrollLeft += primera.getBoundingClientRect().left - kanban.getBoundingClientRect().left - parseFloat(getComputedStyle(kanban).paddingLeft);
  });

  return [
    crear("p", { clase: "kanban__total", texto: total === 1 ? "1 pedido activo" : `${total} pedidos activos` }),
    resumen,
    kanban,
    crear("div", { clase: "aviso" }, [icono("camara", { tam: 18 }), crear("p", { texto: "Sube una foto al mover un pedido de fase para que el cliente vea el avance." })]),
  ];
}

/** @returns {Promise<Node>} */
export async function renderTablero() {
  const contenido = crear("div", { clase: "tablero__contenido" });
  const pantalla = crearPantalla({ rol: "craftsman", activa: "tablero", clase: "tablero" }, [
    crear("div", { clase: "fila-entre" }, [crear("h1", { clase: "pantalla__titulo", texto: "Tablero" }), crearCampana("craftsman")]),
    contenido,
  ]);
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
