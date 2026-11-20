// Admin · Reseñas (CU-08): moderar reseñas y calificaciones; ocultar y restaurar recalculan el promedio del taller.
// El comentario es texto libre del cliente: siempre con textContent.
import { formatearFecha } from "../../../lib/fechas.js";
import { crear } from "../../../ui/dom.js";
import { crearEstrellas, crearInsignia, crearPantalla } from "../../../ui/layout.js";
import { POR_PAGINA, crearAccionConMotivo, crearChipsFiltro, crearListaPaginada } from "../componentes.js";
import { api } from "../index.js";

/** @typedef {{ id: string, workshop_name: string | null, rating: number, tags: string[], comment: string | null, hidden: boolean, created_at: string }} ResenaAdmin */

/**
 * Texto con el promedio que quedó tras ocultar o restaurar.
 * @param {{ rating_avg: number | null, rating_count: number }} resultado
 * @returns {string}
 */
export function textoPromedioNuevo({ rating_avg, rating_count }) {
  if (rating_avg === null) return "El taller ya no tiene reseñas visibles.";
  return `Nuevo promedio del taller: ${Number(rating_avg).toFixed(1)} (${rating_count} ${rating_count === 1 ? "reseña" : "reseñas"}).`;
}

/**
 * @param {ResenaAdmin} resena
 * @param {(mensaje: string) => void} alCambiar
 */
function crearFila(resena, alCambiar) {
  return crear("div", { clase: `tarjeta admin-fila${resena.hidden ? " admin-fila--oculta" : ""}` }, [
    crear("div", { clase: "fila-entre" }, [crear("p", { clase: "tarjeta__titulo", texto: resena.workshop_name ?? "Taller sin nombre" }), crearInsignia(resena.hidden ? "Oculta" : "Visible", resena.hidden ? "error" : "exito")]),
    crear("div", { clase: "fila-entre" }, [crearEstrellas(resena.rating), crear("span", { clase: "texto-secundario", texto: formatearFecha(resena.created_at) })]),
    resena.comment ? crear("p", { clase: "admin-fila__comentario", texto: resena.comment }) : crear("p", { clase: "tarjeta__detalle", texto: "Sin comentario" }),
    resena.tags.length > 0 ? crear("div", { clase: "chips chips--envolver-izq" }, resena.tags.map((t) => crearInsignia(t, "cuero"))) : null,
    crearAccionConMotivo({
      texto: resena.hidden ? "Restaurar" : "Ocultar",
      variante: resena.hidden ? "secundario" : "peligro",
      pregunta: resena.hidden ? "¿Restaurar esta reseña? Volverá a contar en el promedio del taller." : "¿Ocultar esta reseña? Dejará de verse y de contar en el promedio del taller.",
      ejecutar: async (motivo) => {
        const resultado = await api.setReviewHidden(resena.id, !resena.hidden, motivo);
        alCambiar(textoPromedioNuevo(resultado));
      },
    }),
  ]);
}

/** @returns {Node} */
export function renderResenas() {
  /** @type {{ hidden: string }} */
  const filtros = { hidden: "" };
  const aviso = crear("p", { clase: "aviso", attrs: { role: "status", hidden: true } });
  const lista = crearListaPaginada({
    cargar: (offset) => api.listReviews({ ...(filtros.hidden ? { hidden: filtros.hidden === "si" } : {}), limit: POR_PAGINA, offset }),
    crearFila: (r) =>
      crearFila(/** @type {ResenaAdmin} */ (r), (mensaje) => {
        aviso.textContent = mensaje;
        aviso.hidden = false;
        lista.recargar();
      }),
    vacio: "No hay reseñas con ese filtro.",
  });

  return crearPantalla({ rol: "admin", activa: "resenas", clase: "admin" }, [
    crear("h1", { clase: "pantalla__titulo", texto: "Reseñas" }),
    crearChipsFiltro(
      "Visibilidad",
      [
        { texto: "Todas", valor: "" },
        { texto: "Visibles", valor: "no" },
        { texto: "Ocultas", valor: "si" },
      ],
      "",
      (valor) => {
        filtros.hidden = valor;
        aviso.hidden = true;
        lista.recargar();
      },
    ),
    aviso,
    lista.elemento,
  ]);
}
