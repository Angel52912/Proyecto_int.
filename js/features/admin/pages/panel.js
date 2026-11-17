// Admin · Panel (CU-08): totales de usuarios, talleres, solicitudes, pedidos y calificación promedio.
import { cerrarSesion } from "../../auth/flujo.js";
import { crear, enlace } from "../../../ui/dom.js";
import { cargarEn } from "../../../ui/estados.js";
import { icono } from "../../../ui/iconos.js";
import { crearBoton, crearEstrellas, crearPantalla } from "../../../ui/layout.js";
import { api } from "../index.js";

/**
 * Bloque de una sección del panel con sus cifras.
 * @param {string} titulo
 * @param {[string, number | string][]} cifras
 * @param {string} [ruta] lista completa de esa sección
 */
function crearSeccion(titulo, cifras, ruta) {
  return crear("section", { clase: "tarjeta admin-panel__seccion" }, [
    crear("div", { clase: "fila-entre" }, [
      crear("h2", { clase: "seccion__titulo", texto: titulo }),
      ruta ? enlace(ruta, { clase: "boton-texto", texto: "Ver todo" }) : null,
    ]),
    crear(
      "dl",
      { clase: "admin-cifras" },
      cifras.flatMap(([etiqueta, valor]) => [crear("dt", { texto: etiqueta }), crear("dd", { texto: String(valor) })]),
    ),
  ]);
}

/** @param {any} panel Panel de `getDashboard` */
function pintar(panel) {
  const { users: u, workshops: t, requests: s, orders: p, reviews: r } = panel;
  return [
    crear("div", { clase: "tarjeta admin-panel__calificacion" }, [
      crear("p", { clase: "tarjeta__detalle", texto: "Calificación promedio de la plataforma" }),
      crear("div", { clase: "linea-calificacion" }, [
        crear("strong", { clase: "estadistica", texto: r.rating_avg === null ? "–" : Number(r.rating_avg).toFixed(1) }),
        crearEstrellas(r.rating_avg),
        crear("span", { clase: "texto-secundario", texto: r.count === 1 ? "1 reseña" : `${r.count} reseñas` }),
      ]),
    ]),
    crearSeccion(
      "Usuarios",
      [
        ["Total", u.total],
        ["Activos", u.active],
        ["Clientes", u.clients],
        ["Artesanos", u.craftsmen],
        ["Admins", u.admins],
        ["Sin rol", u.without_role],
      ],
      "/admin/usuarios",
    ),
    crearSeccion(
      "Talleres",
      [
        ["Total", t.total],
        ["Visibles en el mapa", t.published],
        ["Suspendidos", t.suspended],
      ],
      "/admin/talleres",
    ),
    crearSeccion(
      "Solicitudes",
      [
        ["Total", s.total],
        ["Abiertas", s.open],
        ["Cotizadas", s.quoted],
        ["Aceptadas", s.accepted],
        ["Canceladas", s.cancelled],
      ],
      "/admin/solicitudes",
    ),
    crearSeccion(
      "Pedidos",
      [
        ["Total", p.total],
        ["En proceso", p.in_progress],
        ["Listos", p.ready],
        ["Entregados", p.delivered],
        ["Cancelados", p.cancelled],
      ],
      "/admin/pedidos",
    ),
  ];
}

/** @returns {Node} */
export function renderPanel() {
  const contenido = crear("div", { clase: "admin-panel" });
  cargarEn(contenido, () => api.getDashboard(), pintar);
  return crearPantalla({ rol: "admin", activa: "panel", clase: "admin" }, [
    crear("h1", { clase: "pantalla__titulo", texto: "Panel de administración" }),
    contenido,
    enlace("/admin/bitacora", { clase: "tarjeta tarjeta--enlace" }, [
      crear("span", { clase: "aviso-fila__icono", attrs: { "aria-hidden": "true" } }, [icono("escudo", { tam: 20 })]),
      crear("div", { clase: "tarjeta__cuerpo" }, [crear("p", { clase: "tarjeta__titulo", texto: "Bitácora" }), crear("p", { clase: "tarjeta__detalle", texto: "Quién hizo qué y cuándo" })]),
      icono("adelante", { tam: 18 }),
    ]),
    crearBoton("Cerrar sesión", { variante: "secundario", alHacerClic: () => cerrarSesion() }),
  ]);
}
