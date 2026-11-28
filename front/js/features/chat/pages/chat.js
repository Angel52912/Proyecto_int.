// 11 · Chat (CU-03) y 24 · Chat del artesano: conversación de una solicitud con la tarjeta de presupuesto.
import { crearAvatar } from "../../auth/avatar.js";
import { api as apiPedidos } from "../../orders/index.js";
import { ESTADO_SOLICITUD } from "../../orders/fases.js";
import { NOMBRE_SERVICIO } from "../../map/componentes.js";
import { crearTarjetaPresupuesto } from "../../quotes/tarjeta.js";
import { api as apiSolicitudes } from "../../requests/index.js";
import { alSalir } from "../../../ui/ciclo.js";
import { crear, enlace } from "../../../ui/dom.js";
import { cargarEn } from "../../../ui/estados.js";
import { crearFoto } from "../../../ui/foto.js";
import { crearInsignia, crearPantalla } from "../../../ui/layout.js";
import { mensajeDeError } from "../../../ui/mensajes.js";
import { crearChat } from "../componente.js";

const ADMITE_MENSAJES = ["open", "quoted", "accepted"];

/**
 * Folio corto de una solicitud o pedido ("#1A2B").
 * @param {string} id
 * @returns {string}
 */
export function folio(id) {
  return `#${id.replace(/-/g, "").slice(-4).toUpperCase()}`;
}

/**
 * @param {"client" | "craftsman"} rol
 * @param {any} solicitud SolicitudDetalle
 * @param {HTMLElement} pantalla para poner el nombre de la contraparte en la barra superior
 */
function pintarConversacion(rol, solicitud, pantalla) {
  const esCliente = rol === "client";
  const nombre = solicitud.counterpart?.full_name ?? (esCliente ? "Taller no disponible" : "Cliente");
  // Para el cliente una solicitud abierta está "Enviada"; para el artesano es "Nueva".
  const estado = esCliente && solicitud.status === "open" ? { texto: "Enviada", tono: "miel" } : ESTADO_SOLICITUD[solicitud.status] ?? ESTADO_SOLICITUD.open;

  const chat = crearChat({
    requestId: solicitud.id,
    // El cliente es el dueño de la solicitud; los demás mensajes con remitente son del artesano.
    esPropio: (m) => (esCliente ? m.sender_id === solicitud.client_id : m.sender_id !== null && m.sender_id !== solicitud.client_id),
    puedeEscribir: ADMITE_MENSAJES.includes(solicitud.status),
    crearTarjeta: (m) =>
      crearTarjetaPresupuesto(/** @type {string} */ (m.quote_id), {
        ruta: (p) => (esCliente ? `/presupuesto/${p.id}` : p.status === "sent" ? `/artesano/solicitud/${solicitud.id}` : null),
        textoBoton: esCliente ? "Ver presupuesto" : "Rectificar presupuesto",
      }),
  });
  alSalir(chat.destruir);

  const acciones = crear("div", { clase: "chat-solicitud__acciones" });
  const avisoAccion = crear("p", { clase: "campo__error", attrs: { "aria-live": "polite" } });
  if (esCliente && (solicitud.status === "open" || solicitud.status === "quoted")) {
    // A2: cancelar solicitud (solo abierta o cotizada).
    acciones.append(
      crear("button", {
        clase: "boton-texto",
        texto: "Cancelar solicitud",
        attrs: { type: "button" },
        on: {
          click: async (evento) => {
            if (!window.confirm("¿Cancelar esta solicitud? El taller ya no podrá enviarte presupuesto.")) return;
            const boton = /** @type {HTMLButtonElement} */ (evento.currentTarget);
            boton.disabled = true;
            try {
              await apiSolicitudes.cancelRequest(solicitud.id);
              chat.permitirEscritura(false, "Cancelaste esta solicitud.");
              boton.remove();
            } catch (error) {
              avisoAccion.textContent = mensajeDeError(error, { invalid_state: "Esta solicitud ya no se puede cancelar." });
              boton.disabled = false;
            }
          },
        },
      }),
    );
  }
  if (!esCliente && (solicitud.status === "open" || solicitud.status === "quoted")) {
    acciones.append(enlace(`/artesano/solicitud/${solicitud.id}`, { clase: "boton-texto", texto: solicitud.status === "quoted" ? "Rectificar presupuesto" : "Enviar presupuesto" }));
  }
  if (solicitud.status === "accepted") {
    apiPedidos
      .listMyOrders()
      .then((pedidos) => {
        const pedido = pedidos.find((p) => p.request_id === solicitud.id);
        if (pedido) acciones.append(enlace(esCliente ? `/pedido/${pedido.id}` : `/artesano/pedido/${pedido.id}`, { clase: "boton-texto", texto: "Ver seguimiento" }));
      })
      .catch(() => {});
  }
  if (!ADMITE_MENSAJES.includes(solicitud.status)) chat.permitirEscritura(false, solicitud.status === "draft" ? "Esta solicitud aún no se envía." : "Esta solicitud está cerrada.");

  // La barra superior muestra con quién se habla (como en las apps de mensajería): avatar, nombre y estado.
  const titulo = pantalla.querySelector(".barra__titulo");
  if (titulo) {
    titulo.textContent = nombre;
    titulo.before(crearAvatar({ nombre, avatarPath: solicitud.counterpart?.avatar_path, clase: "avatar--chico" }));
    titulo.after(crearInsignia(estado.texto, estado.tono));
  }

  return [
    // Resumen compacto de la solicitud en un renglón, con sus acciones a la derecha.
    crear("div", { clase: "chat-solicitud" }, [
      crearFoto(solicitud.photos[0]?.url, "Foto del calzado", "foto--chica"),
      crear("div", { clase: "chat-solicitud__texto" }, [
        crear("p", { clase: "chat-solicitud__titulo", texto: `${NOMBRE_SERVICIO[/** @type {"repair" | "cleaning"} */ (solicitud.service_type)]} · ${folio(solicitud.id)}` }),
        crear("p", { clase: "tarjeta__detalle chat-solicitud__descripcion", texto: solicitud.description }),
      ]),
      acciones,
    ]),
    avisoAccion,
    chat.elemento,
  ];
}

/**
 * @param {"client" | "craftsman"} rol
 * @returns {(contexto: import("../../../router.js").Contexto) => Promise<Node>}
 */
export function renderChat(rol) {
  return async ({ params }) => {
    const contenido = crear("div", { clase: "chat-pantalla__contenido" });
    const pantalla = crearPantalla(
      { titulo: "Chat", volver: rol === "client" ? "/chats" : "/artesano/chats", clase: "chat-pantalla" },
      [contenido],
    );
    ajustarAlTecladoVisible(pantalla);
    cargarEn(contenido, () => apiSolicitudes.getRequest(params.requestId), (s) => pintarConversacion(rol, s, pantalla), {
      not_found: "No encontramos esta conversación.",
      invalid_input: "No encontramos esta conversación.",
    });
    return pantalla;
  };
}

/**
 * El chat ocupa justo el alto visible. En celulares, al abrir el teclado el área visible se achica
 * (visualViewport): se ajusta el alto para que el campo de escribir quede arriba del teclado.
 * @param {HTMLElement} pantalla
 */
function ajustarAlTecladoVisible(pantalla) {
  const vista = window.visualViewport;
  if (!vista) return;
  const ajustar = () => pantalla.style.setProperty("--alto-visible", `${Math.round(vista.height)}px`);
  vista.addEventListener("resize", ajustar);
  alSalir(() => vista.removeEventListener("resize", ajustar));
  ajustar();
}

