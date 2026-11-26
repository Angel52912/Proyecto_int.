// 06 · Pantalla principal (Cliente): saludo, buscador, categorías, talleres cercanos y pedido en curso (CU-02, CU-05, CU-06 A2).
import { api as apiAuth } from "../../auth/index.js";
import { api as apiPedidos } from "../../orders/index.js";
import { api as apiSolicitudes } from "../../requests/index.js";
import { crearCampana } from "../../requests/avisos.js";
import { alSalir } from "../../../ui/ciclo.js";
import { crear, enlace, ir } from "../../../ui/dom.js";
import { cargarEn, crearVacio } from "../../../ui/estados.js";
import { icono } from "../../../ui/iconos.js";
import { crearInsignia, crearPantalla, iniciales } from "../../../ui/layout.js";
import { NOMBRE_SERVICIO, buscarTalleres, crearMapaLeaflet, obtenerUbicacion, pintarPines } from "../componentes.js";
import { api as apiMapa } from "../index.js";
import { crearPasos, textoDeAvance } from "../../orders/pasos.js";

/** @returns {Promise<string>} */
async function nombreDelCliente() {
  try {
    const perfil = await apiAuth.getMyProfile();
    return perfil.full_name.trim();
  } catch {
    return "";
  }
}

/**
 * Saludo según la hora: mañana (5–11), tarde (12–18) y noche.
 * @param {Date} [ahora]
 * @returns {string}
 */
export function saludoPorHora(ahora = new Date()) {
  const hora = ahora.getHours();
  if (hora >= 5 && hora < 12) return "Buenos días";
  if (hora >= 12 && hora < 19) return "Buenas tardes";
  return "Buenas noches";
}

/** @returns {HTMLElement} */
function crearBuscador() {
  const entrada = crear("input", {
    attrs: { type: "search", name: "q", placeholder: "Buscar taller o colonia", "aria-label": "Buscar taller o colonia", autocomplete: "off" },
  });
  return crear(
    "form",
    {
      clase: "campo campo--icono buscador",
      attrs: { role: "search" },
      on: {
        submit: (evento) => {
          evento.preventDefault();
          const texto = /** @type {HTMLInputElement} */ (entrada).value.trim();
          ir(texto ? `/talleres?q=${encodeURIComponent(texto)}` : "/talleres");
        },
      },
    },
    [icono("buscar", { tam: 18 }), entrada],
  );
}

/**
 * @param {"repair" | "cleaning"} servicio
 * @param {string} detalle
 */
function crearCategoria(servicio, detalle) {
  return enlace(`/talleres?servicio=${servicio}`, { clase: `categoria categoria--${servicio}` }, [
    crear("span", { clase: "categoria__icono" }, [icono(servicio === "repair" ? "reparacion" : "limpieza")]),
    crear("strong", { texto: NOMBRE_SERVICIO[servicio] }),
    crear("span", { clase: "texto-secundario", texto: detalle }),
  ]);
}

/**
 * Tarjeta destacada del pedido activo más reciente: servicio, taller, fase y pasos, y la acción que toca
 * (Ver seguimiento o, si está listo, Recoger pedido).
 * @param {any} pedido
 * @param {any | undefined} solicitud
 * @param {string | null} taller Nombre del taller.
 */
function crearPedidoEnCurso(pedido, solicitud, taller) {
  const listo = pedido.status === "ready";
  const servicio = NOMBRE_SERVICIO[/** @type {"repair" | "cleaning"} */ (solicitud?.service_type)] ?? "Pedido";
  return enlace(listo ? `/pedido/${pedido.id}/recoger` : `/pedido/${pedido.id}`, { clase: `pedido-destacado${listo ? " pedido-destacado--listo" : ""}` }, [
    crear("div", { clase: "pedido-destacado__fila" }, [
      crear("span", { clase: "pedido-destacado__icono", attrs: { "aria-hidden": "true" } }, [icono(listo ? "check" : solicitud?.service_type === "cleaning" ? "limpieza" : "reparacion", { tam: 20 })]),
      crear("div", { clase: "pedido-destacado__texto" }, [
        crear("p", { clase: "pedido-destacado__titulo", texto: servicio }),
        crear("p", { clase: "pedido-destacado__taller", texto: taller ?? "Tu taller" }),
      ]),
      crearInsignia(listo ? "¡Listo!" : `Fase ${pedido.phase}/4`, listo ? "exito" : "miel"),
    ]),
    crear("p", { clase: "pedido-destacado__fase", texto: listo ? "Tu pedido está listo. Pasa a recogerlo con tu código." : textoDeAvance(pedido) }),
    crearPasos(pedido, { claro: true }),
    crear("span", { clase: "pedido-destacado__accion" }, [crear("span", { texto: listo ? "Recoger pedido" : "Ver seguimiento" }), icono("adelante", { tam: 16 })]),
  ]);
}

/** @returns {Promise<Node>} */
export async function renderPrincipal() {
  const saludo = crear("p", { clase: "inicio__saludo texto-secundario", texto: saludoPorHora() });
  const avatar = enlace("/perfil", { clase: "avatar inicio__avatar", attrs: { "aria-label": "Mi perfil" } }, [icono("perfil", { tam: 20 })]);
  nombreDelCliente().then((nombre) => {
    if (!nombre) return;
    saludo.textContent = `${saludoPorHora()}, ${nombre.split(/\s+/)[0]}`;
    avatar.replaceChildren(crear("span", { texto: iniciales(nombre), attrs: { "aria-hidden": "true" } }));
  });

  const campana = crearCampana("client");

  const recordatorio = crear("div");
  apiPedidos
    .listPendingReviews()
    .then((pendientes) => {
      if (pendientes.length === 0) return;
      recordatorio.replaceChildren(
        enlace(`/pedido/${pendientes[0].id}/calificar`, { clase: "aviso aviso--miel" }, [
          icono("estrella", { tam: 18 }),
          crear("p", { texto: "Tienes una calificación pendiente. Cuéntanos cómo te fue." }),
        ]),
      );
    })
    .catch(() => {});

  const mapaContenedor = crear("div", { clase: "mini-mapa", attrs: { role: "img", "aria-label": "Mapa de talleres cercanos" } });
  const estadoMapa = crear("div");
  const pedidoEnCurso = crear("div");

  const pantalla = crearPantalla({ rol: "client", activa: "principal", clase: "inicio" }, [
    crear("header", { clase: "inicio__encabezado" }, [
      crear("div", {}, [saludo, crear("h1", { clase: "inicio__titulo", texto: "¿Qué restauramos hoy?" })]),
      crear("div", { clase: "inicio__acciones" }, [campana, avatar]),
    ]),
    crearBuscador(),
    recordatorio,
    crear("div", { clase: "categorias" }, [crearCategoria("repair", "Suelas, costuras, tacones"), crearCategoria("cleaning", "Lavado, desinfección, tinte")]),
    crear("section", { clase: "seccion" }, [
      crear("div", { clase: "seccion__encabezado" }, [crear("h2", { clase: "seccion__titulo", texto: "Talleres cerca de ti" }), enlace("/mapa", { clase: "boton-texto", texto: "Ver mapa" })]),
      enlace("/mapa", { clase: "mini-mapa__enlace", attrs: { "aria-label": "Abrir el mapa de talleres" } }, [mapaContenedor]),
      estadoMapa,
    ]),
    crear("section", { clase: "seccion" }, [crear("h2", { clase: "seccion__titulo", texto: "Mi pedido en curso" }), pedidoEnCurso]),
  ]);

  // Mapa pequeño: se crea cuando la vista ya está en el documento.
  setTimeout(async () => {
    const mapa = crearMapaLeaflet(mapaContenedor, { interactivo: false, zoom: 12 });
    if (mapa) alSalir(() => mapa.remove());
    try {
      const ubicacion = await obtenerUbicacion();
      const talleres = await buscarTalleres({ service: "all", orden: "cercanos", ...(ubicacion ?? {}), limit: 10 });
      if (talleres.length === 0) estadoMapa.replaceChildren(crearVacio("Aún no hay talleres publicados cerca."));
      if (mapa) pintarPines(mapa, talleres, { ubicacion });
    } catch {
      estadoMapa.replaceChildren(crear("p", { clase: "texto-secundario", texto: "No pudimos cargar los talleres." }));
    }
  }, 0);

  cargarEn(
    pedidoEnCurso,
    async () => {
      const pedidos = await apiPedidos.listMyOrders();
      // Primero el que ya está listo (hay que ir por él); si no, el más reciente en proceso.
      const activo = pedidos.find((p) => p.status === "ready") ?? pedidos.find((p) => p.status === "in_progress");
      if (!activo) return { activo, solicitud: undefined, taller: null };
      const [solicitud, perfil] = await Promise.all([
        apiSolicitudes.getRequest(activo.request_id).catch(() => undefined),
        apiMapa.getWorkshopProfile(activo.workshop_id).catch(() => null),
      ]);
      return { activo, solicitud, taller: perfil?.name ?? null };
    },
    ({ activo, solicitud, taller }) =>
      activo ? crearPedidoEnCurso(activo, solicitud, taller) : crearVacio("No tienes pedidos en curso.", enlace("/talleres", { clase: "boton boton--secundario", texto: "Buscar un taller" }), { icono: "pedidos" }),
  );

  return pantalla;
}
