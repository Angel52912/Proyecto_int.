// 06 · Pantalla principal (Cliente): saludo, buscador, categorías, talleres cercanos y pedido en curso (CU-02, CU-05, CU-06 A2).
import { api as apiAuth } from "../../auth/index.js";
import { api as apiPedidos } from "../../orders/index.js";
import { api as apiSolicitudes } from "../../requests/index.js";
import { crearCampana } from "../../requests/avisos.js";
import { alSalir } from "../../../ui/ciclo.js";
import { crear, enlace, ir } from "../../../ui/dom.js";
import { cargarEn, crearVacio } from "../../../ui/estados.js";
import { crearFoto } from "../../../ui/foto.js";
import { icono } from "../../../ui/iconos.js";
import { crearInsignia, crearPantalla, crearProgreso } from "../../../ui/layout.js";
import { NOMBRE_SERVICIO, buscarTalleres, crearMapaLeaflet, obtenerUbicacion, pintarPines } from "../componentes.js";
import { NOMBRE_FASE } from "../../orders/fases.js";

/** @returns {Promise<string>} */
async function nombreDelCliente() {
  try {
    const perfil = await apiAuth.getMyProfile();
    return perfil.full_name.split(/\s+/)[0] ?? "";
  } catch {
    return "";
  }
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
 * Tarjeta del pedido activo más reciente.
 * @param {any} pedido
 * @param {any | undefined} solicitud
 */
function crearPedidoEnCurso(pedido, solicitud) {
  const listo = pedido.status === "ready";
  return enlace(`/pedido/${pedido.id}`, { clase: "tarjeta tarjeta--enlace" }, [
    crearFoto(null, "Pedido"),
    crear("div", { clase: "tarjeta__cuerpo" }, [
      crear("div", { clase: "fila-entre" }, [
        crear("p", { clase: "tarjeta__titulo", texto: `Pedido de ${NOMBRE_SERVICIO[solicitud?.service_type] ?? "servicio"}` }),
        crearInsignia(listo ? "Listo" : NOMBRE_SERVICIO[solicitud?.service_type] ?? "En proceso", listo ? "exito" : "miel"),
      ]),
      crear("p", { clase: "tarjeta__detalle", texto: listo ? "Listo para recoger" : `Fase ${pedido.phase} de 4 · ${NOMBRE_FASE[pedido.phase]}` }),
      crearProgreso(pedido.phase / 4, "Avance del pedido"),
    ]),
  ]);
}

/** @returns {Promise<Node>} */
export async function renderPrincipal() {
  const saludo = crear("p", { clase: "inicio__saludo texto-secundario", texto: "Hola" });
  nombreDelCliente().then((nombre) => {
    if (nombre) saludo.textContent = `Hola, ${nombre}`;
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

  const pantalla = crearPantalla({ rol: "client", activa: "inicio", clase: "inicio" }, [
    crear("header", { clase: "inicio__encabezado" }, [
      crear("div", {}, [saludo, crear("h1", { clase: "inicio__titulo", texto: "¿Qué restauramos hoy?" })]),
      campana,
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
      const activo = pedidos.find((p) => p.status === "in_progress" || p.status === "ready");
      const solicitud = activo ? await apiSolicitudes.getRequest(activo.request_id).catch(() => undefined) : undefined;
      return { activo, solicitud };
    },
    ({ activo, solicitud }) =>
      activo ? crearPedidoEnCurso(activo, solicitud) : crearVacio("No tienes pedidos en curso.", enlace("/talleres", { clase: "boton-texto", texto: "Buscar un taller" })),
  );

  return pantalla;
}
