// 23 · Perfil y reputación (Artesano): calificación, distribución de estrellas, pedidos entregados, % a tiempo y reseñas.
// Las cifras y las reseñas vienen del servidor (`getMyWorkshopStats` y `listMyWorkshopReviews`); las reseñas son anónimas.
import { cerrarSesion } from "../../auth/flujo.js";
import { formatearFecha } from "../../../lib/fechas.js";
import { crear, enlace } from "../../../ui/dom.js";
import { cargarEn, crearVacio } from "../../../ui/estados.js";
import { crearFoto } from "../../../ui/foto.js";
import { icono } from "../../../ui/iconos.js";
import { crearBoton, crearEstrellas, crearInsignia, crearPantalla } from "../../../ui/layout.js";
import { api } from "../index.js";

/** Reseñas que se piden al servidor para la distribución de estrellas y la lista. */
const RESENAS_POR_PAGINA = 100;
/** Reseñas visibles al abrir la pantalla; "Ver más" muestra las siguientes. */
const RESENAS_VISIBLES = 10;

/**
 * Cuántas reseñas hay de cada número de estrellas.
 * @param {{ rating: number }[]} resenas
 * @returns {Record<1|2|3|4|5, number>}
 */
export function distribucionDeResenas(resenas) {
  /** @type {Record<1|2|3|4|5, number>} */
  const distribucion = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const r of resenas) {
    if (r.rating >= 1 && r.rating <= 5) distribucion[/** @type {1|2|3|4|5} */ (r.rating)] += 1;
  }
  return distribucion;
}

/**
 * Porcentaje a tiempo para mostrar ("92.5%", "100%" o "–" si aún no hay entregados).
 * @param {number | null} porcentaje
 * @returns {string}
 */
export function textoATiempo(porcentaje) {
  if (porcentaje === null || !Number.isFinite(porcentaje)) return "–";
  return `${Number.isInteger(porcentaje) ? porcentaje : porcentaje.toFixed(1)}%`;
}

/**
 * @param {string} etiqueta
 * @param {string} valor
 * @param {string} [clase]
 */
const crearCifra = (etiqueta, valor, clase = "") =>
  crear("div", { clase: "tarjeta" }, [crear("p", { clase: "tarjeta__detalle", texto: etiqueta }), crear("p", { clase: `estadistica ${clase}`.trim(), texto: valor })]);

/** @param {{ id: string, rating: number, tags: string[], comment: string | null, created_at: string }} resena */
const crearResena = (resena) =>
  crear("li", { clase: "tarjeta" }, [
    crear("div", { clase: "fila-entre" }, [crearEstrellas(resena.rating), crear("span", { clase: "texto-secundario", texto: formatearFecha(resena.created_at) })]),
    resena.comment ? crear("p", { clase: "tarjeta__detalle", texto: resena.comment }) : null,
    resena.tags.length > 0 ? crear("div", { clase: "chips chips--envolver-izq" }, resena.tags.map((t) => crearInsignia(t, "cuero"))) : null,
  ]);

/**
 * Lista de reseñas con "Ver más" para mostrar las siguientes.
 * @param {any[]} items
 */
function crearListaResenas(items) {
  if (items.length === 0) return crear("p", { clase: "texto-secundario", texto: "Aún no tienes reseñas." });
  const lista = crear("ul", { clase: "lista" }, items.slice(0, RESENAS_VISIBLES).map(crearResena));
  if (items.length <= RESENAS_VISIBLES) return lista;
  const verMas = crear("button", {
    clase: "boton-texto",
    texto: "Ver más reseñas",
    attrs: { type: "button" },
    on: {
      click: () => {
        lista.append(...items.slice(RESENAS_VISIBLES).map(crearResena));
        verMas.remove();
      },
    },
  });
  return crear("div", {}, [lista, verMas]);
}

/** @param {{ taller: any | null, stats: any | null, resenas: { total: number, items: any[] } }} datos */
function pintar({ taller, stats, resenas }) {
  if (taller === null || stats === null) {
    return crearVacio("Aún no configuras tu taller.", enlace("/artesano/taller", { clase: "boton", texto: "Configurar mi taller" }));
  }
  const distribucion = distribucionDeResenas(resenas.items);
  const promedio = stats.rating_avg;
  const total = stats.rating_count;
  const maximo = Math.max(1, ...Object.values(distribucion));
  const estado = stats.suspended
    ? crearInsignia("Suspendido", "error")
    : stats.published
      ? crearInsignia("Visible en el mapa", "exito")
      : crearInsignia("Borrador: no visible", "neutra");

  return [
    crear("div", { clase: "tarjeta tarjeta--enlace" }, [
      crearFoto(taller.photos?.find((/** @type {any} */ f) => f.kind === "profile")?.url, "Foto del taller"),
      crear("div", { clase: "tarjeta__cuerpo" }, [crear("p", { clase: "tarjeta__titulo", texto: taller.name ?? "Mi taller" }), crear("p", { clase: "tarjeta__detalle", texto: taller.colonia ? `${taller.colonia}, Mérida` : "Sin dirección" }), estado]),
    ]),
    crear("div", { clase: "tarjeta reputacion" }, [
      crear("div", { clase: "reputacion__promedio" }, [
        crear("strong", { texto: promedio === null ? "–" : promedio.toFixed(1) }),
        crearEstrellas(promedio),
        crear("span", { clase: "texto-secundario", texto: total === 1 ? "1 reseña" : `${total} reseñas` }),
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
      crearCifra("Pedidos entregados", String(stats.orders.delivered)),
      crearCifra("A tiempo", textoATiempo(stats.orders.on_time_pct), "estadistica--exito"),
      crearCifra("En proceso", String(stats.orders.in_progress)),
      crearCifra("Listos para entregar", String(stats.orders.ready)),
    ]),
    crear("section", { clase: "seccion" }, [
      crear("h2", { clase: "seccion__titulo", texto: "Reseñas recientes" }),
      crearListaResenas(resenas.items),
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
    enlace("/acceso/perfil?desde=taller", { clase: "boton boton--bloque boton--secundario", texto: "Editar mi perfil" }),
    crearBoton("Cerrar sesión", { variante: "secundario", alHacerClic: () => cerrarSesion() }),
  ]);
  cargarEn(contenido, async () => {
    const taller = await api.getMyWorkshop();
    if (taller === null) return { taller, stats: null, resenas: { total: 0, items: [] } };
    const [stats, resenas] = await Promise.all([api.getMyWorkshopStats(), api.listMyWorkshopReviews({ limit: RESENAS_POR_PAGINA })]);
    return { taller, stats, resenas };
  }, pintar);
  return pantalla;
}
