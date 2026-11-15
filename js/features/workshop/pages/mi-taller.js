// 23 · Perfil y reputación (Artesano): calificación, distribución de estrellas, pedidos entregados, % a tiempo y reseñas.
import { api as apiPedidos } from "../../orders/index.js";
import { api as apiSolicitudes } from "../../requests/index.js";
import { formatearFecha } from "../../../lib/fechas.js";
import { crear, enlace } from "../../../ui/dom.js";
import { cargarEn, crearVacio } from "../../../ui/estados.js";
import { crearFoto } from "../../../ui/foto.js";
import { icono } from "../../../ui/iconos.js";
import { crearEstrellas, crearInsignia, crearPantalla, iniciales } from "../../../ui/layout.js";
import { api } from "../index.js";

/**
 * Estadísticas a partir de los pedidos y sus reseñas visibles.
 * @param {any[]} pedidos
 * @param {any[]} resenas
 * @returns {{ entregados: number, aTiempo: number | null, distribucion: Record<1|2|3|4|5, number> }}
 */
export function estadisticas(pedidos, resenas) {
  const entregados = pedidos.filter((p) => p.status === "delivered");
  const puntuales = entregados.filter((p) => p.delivered_at && p.due_date && p.delivered_at.slice(0, 10) <= p.due_date).length;
  /** @type {Record<1|2|3|4|5, number>} */
  const distribucion = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const r of resenas) distribucion[/** @type {1|2|3|4|5} */ (r.rating)] += 1;
  return { entregados: entregados.length, aTiempo: entregados.length === 0 ? null : Math.round((puntuales / entregados.length) * 100), distribucion };
}

/** @param {{ taller: any | null, pedidos: any[], resenas: { resena: any, cliente: string }[] }} datos */
function pintar({ taller, pedidos, resenas }) {
  if (taller === null) {
    return crearVacio("Aún no configuras tu taller.", enlace("/artesano/taller", { clase: "boton", texto: "Configurar mi taller" }));
  }
  const { entregados, aTiempo, distribucion } = estadisticas(
    pedidos,
    resenas.map((r) => r.resena),
  );
  const maximo = Math.max(1, ...Object.values(distribucion));
  const estado = taller.suspended
    ? crearInsignia("Suspendido", "error")
    : taller.published
      ? crearInsignia("Visible en el mapa", "exito")
      : crearInsignia("Borrador: no visible", "neutra");

  return [
    crear("div", { clase: "tarjeta tarjeta--enlace" }, [
      crearFoto(taller.photos?.find((/** @type {any} */ f) => f.kind === "profile")?.url, "Foto del taller"),
      crear("div", { clase: "tarjeta__cuerpo" }, [crear("p", { clase: "tarjeta__titulo", texto: taller.name ?? "Mi taller" }), crear("p", { clase: "tarjeta__detalle", texto: taller.colonia ? `${taller.colonia}, Mérida` : "Sin dirección" }), estado]),
    ]),
    crear("div", { clase: "tarjeta reputacion" }, [
      crear("div", { clase: "reputacion__promedio" }, [
        crear("strong", { texto: taller.rating_avg === null ? "–" : taller.rating_avg.toFixed(1) }),
        crearEstrellas(taller.rating_avg),
        crear("span", { clase: "texto-secundario", texto: taller.rating_count === 1 ? "1 reseña" : `${taller.rating_count} reseñas` }),
      ]),
      crear(
        "ul",
        { clase: "reputacion__barras", attrs: { "aria-label": "Reseñas por estrellas" } },
        [5, 4, 3, 2, 1].map((n) => {
          const barra = crear("span", { clase: "reputacion__relleno" });
          barra.style.width = `${(distribucion[/** @type {1|2|3|4|5} */ (n)] / maximo) * 100}%`;
          return crear("li", { attrs: { "aria-label": `${n} estrellas: ${distribucion[/** @type {1|2|3|4|5} */ (n)]}` } }, [crear("span", { texto: String(n), attrs: { "aria-hidden": "true" } }), crear("span", { clase: "reputacion__barra" }, [barra])]);
        }),
      ),
    ]),
    crear("div", { clase: "presupuesto__datos" }, [
      crear("div", { clase: "tarjeta" }, [crear("p", { clase: "tarjeta__detalle", texto: "Pedidos entregados" }), crear("p", { clase: "estadistica", texto: String(entregados) })]),
      crear("div", { clase: "tarjeta" }, [crear("p", { clase: "tarjeta__detalle", texto: "A tiempo" }), crear("p", { clase: "estadistica estadistica--exito", texto: aTiempo === null ? "–" : `${aTiempo}%` })]),
    ]),
    crear("section", { clase: "seccion" }, [
      crear("h2", { clase: "seccion__titulo", texto: "Reseñas recientes" }),
      resenas.length === 0
        ? crear("p", { clase: "texto-secundario", texto: "Aún no tienes reseñas." })
        : crear(
            "ul",
            { clase: "lista" },
            resenas.slice(0, 10).map(({ resena, cliente }) =>
              crear("li", { clase: "tarjeta" }, [
                crear("div", { clase: "fila-entre" }, [
                  crear("div", { clase: "chat-contraparte" }, [crear("span", { clase: "avatar avatar--chico", texto: iniciales(cliente), attrs: { "aria-hidden": "true" } }), crear("strong", { texto: cliente })]),
                  crearEstrellas(resena.rating),
                ]),
                resena.comment ? crear("p", { clase: "tarjeta__detalle", texto: resena.comment }) : null,
                resena.tags.length > 0 ? crear("div", { clase: "chips chips--envolver-izq" }, resena.tags.map((/** @type {string} */ t) => crearInsignia(t, "cuero"))) : null,
                crear("p", { clase: "tarjeta__detalle", texto: formatearFecha(resena.created_at) }),
              ]),
            ),
          ),
    ]),
  ];
}

/** @returns {Promise<Node>} */
export async function renderMiTaller() {
  const contenido = crear("div", { clase: "mi-taller__contenido" });
  const ajustes = enlace("/artesano/taller", { clase: "boton-circular", attrs: { "aria-label": "Editar mi taller" } }, [icono("ajustes")]);
  const pantalla = crearPantalla({ rol: "craftsman", activa: "perfil", clase: "mi-taller" }, [
    crear("div", { clase: "fila-entre" }, [crear("h1", { clase: "pantalla__titulo", texto: "Mi taller" }), ajustes]),
    contenido,
  ]);
  cargarEn(contenido, async () => {
    const [taller, pedidos] = await Promise.all([api.getMyWorkshop(), apiPedidos.listMyOrders()]);
    const entregados = pedidos.filter((p) => p.status === "delivered");
    const resenas = (
      await Promise.all(
        entregados.map(async (p) => {
          const resena = await apiPedidos.getOrderReview(p.id).catch(() => null);
          if (!resena) return null;
          const solicitud = await apiSolicitudes.getRequest(p.request_id).catch(() => null);
          return { resena, cliente: solicitud?.counterpart?.full_name ?? "Cliente" };
        }),
      )
    )
      .filter((r) => r !== null)
      .sort((a, b) => b.resena.created_at.localeCompare(a.resena.created_at));
    return { taller, pedidos, resenas };
  }, pintar);
  return pantalla;
}
