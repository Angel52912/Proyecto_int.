// Admin · Talleres (CU-08): listar, buscar, suspender (sale del mapa) y reactivar. Suspender avisa al dueño.
import { textoServicios } from "../../map/componentes.js";
import { crear } from "../../../ui/dom.js";
import { crearEstrellas, crearInsignia, crearPantalla } from "../../../ui/layout.js";
import { POR_PAGINA, crearAccionConMotivo, crearBuscadorAdmin, crearChipsFiltro, crearListaPaginada } from "../componentes.js";
import { api } from "../index.js";

/** @typedef {{ id: string, owner_name: string | null, name: string | null, colonia: string | null, services: string[], published: boolean, suspended: boolean, rating_avg: number | null, rating_count: number }} TallerAdmin */

/**
 * Estado visible del taller.
 * @param {{ published: boolean, suspended: boolean }} taller
 * @returns {{ texto: string, tono: "exito" | "error" | "neutra" }}
 */
export function estadoDelTaller({ published, suspended }) {
  if (suspended) return { texto: "Suspendido", tono: "error" };
  if (published) return { texto: "Visible en el mapa", tono: "exito" };
  return { texto: "Borrador", tono: "neutra" };
}

/**
 * @param {TallerAdmin} taller
 * @param {() => void} alCambiar
 */
function crearFila(taller, alCambiar) {
  const nombre = taller.name ?? "Taller sin nombre";
  const estado = estadoDelTaller(taller);
  return crear("div", { clase: "tarjeta admin-fila" }, [
    crear("div", { clase: "fila-entre" }, [crear("p", { clase: "tarjeta__titulo", texto: nombre }), crearInsignia(estado.texto, estado.tono)]),
    crear("p", { clase: "tarjeta__detalle", texto: `Dueño: ${taller.owner_name || "Sin nombre"}${taller.colonia ? ` · ${taller.colonia}` : ""}` }),
    crear("div", { clase: "linea-calificacion" }, [
      crearEstrellas(taller.rating_avg),
      crear("span", { clase: "texto-secundario", texto: `${taller.rating_avg === null ? "Sin calificaciones" : Number(taller.rating_avg).toFixed(1)} · ${taller.services.length > 0 ? textoServicios(taller.services) : "Sin servicios"}` }),
    ]),
    crearAccionConMotivo({
      texto: taller.suspended ? "Reactivar" : "Suspender",
      variante: taller.suspended ? "secundario" : "peligro",
      pregunta: taller.suspended ? `¿Reactivar ${nombre}? Volverá a aparecer en el mapa si está publicado.` : `¿Suspender ${nombre}? Saldrá del mapa y no recibirá solicitudes. Se avisará al dueño.`,
      ejecutar: async (motivo) => {
        await api.setWorkshopSuspended(taller.id, !taller.suspended, motivo);
        alCambiar();
      },
    }),
  ]);
}

/** @returns {Node} */
export function renderTalleresAdmin() {
  /** @type {{ search: string, estado: string }} */
  const filtros = { search: "", estado: "" };
  const lista = crearListaPaginada({
    cargar: (offset) =>
      api.listWorkshops({
        ...(filtros.search ? { search: filtros.search } : {}),
        ...(filtros.estado === "visibles" ? { published: true, suspended: false } : {}),
        ...(filtros.estado === "suspendidos" ? { suspended: true } : {}),
        ...(filtros.estado === "borradores" ? { published: false } : {}),
        limit: POR_PAGINA,
        offset,
      }),
    crearFila: (t) => crearFila(/** @type {TallerAdmin} */ (t), () => lista.recargar()),
    vacio: "No hay talleres con esos filtros.",
  });

  return crearPantalla({ rol: "admin", activa: "talleres", clase: "admin" }, [
    crear("h1", { clase: "pantalla__titulo", texto: "Talleres" }),
    crearBuscadorAdmin("Buscar taller, colonia o dueño", (texto) => {
      filtros.search = texto;
      lista.recargar();
    }),
    crearChipsFiltro(
      "Estado del taller",
      [
        { texto: "Todos", valor: "" },
        { texto: "Visibles", valor: "visibles" },
        { texto: "Suspendidos", valor: "suspendidos" },
        { texto: "Borradores", valor: "borradores" },
      ],
      "",
      (valor) => {
        filtros.estado = valor;
        lista.recargar();
      },
    ),
    lista.elemento,
  ]);
}
