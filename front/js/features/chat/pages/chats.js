// 24 · Chats: lista de conversaciones con búsqueda y último mensaje. La usan el artesano (con cada cliente)
// y el cliente (con cada taller); la pestaña Chats de la barra lleva aquí. En PC la lista queda a la izquierda y la
// conversación abierta a la derecha, como en WhatsApp Web (ver chat.js).
import { crearAvatar } from "../../auth/avatar.js";
import { api as apiSolicitudes } from "../../requests/index.js";
import { formatearHace } from "../../../lib/fechas.js";
import { crear, enlace } from "../../../ui/dom.js";
import { cargarEn, crearVacio } from "../../../ui/estados.js";
import { icono } from "../../../ui/iconos.js";
import { crearPantalla } from "../../../ui/layout.js";
import { api } from "../index.js";

/**
 * @typedef {{ id: string, nombre: string, ultimo: string, fecha: string, avatarPath?: string | null }} Conversacion
 */

/**
 * Filtra por nombre o texto del último mensaje.
 * @param {Conversacion[]} conversaciones
 * @param {string} texto
 * @returns {Conversacion[]}
 */
export function filtrarConversaciones(conversaciones, texto) {
  const buscado = texto.trim().toLowerCase();
  if (!buscado) return conversaciones;
  return conversaciones.filter((c) => c.nombre.toLowerCase().includes(buscado) || c.ultimo.toLowerCase().includes(buscado));
}

/**
 * @param {Conversacion} c
 * @param {string} base ruta del chat según el rol
 * @param {string | null} [activa] id de la conversación abierta (PC), que queda marcada
 */
function crearFila(c, base, activa = null) {
  return crear("li", {}, [
    enlace(`${base}/${c.id}`, { clase: `conversacion${c.id === activa ? " conversacion--activa" : ""}`, attrs: { "aria-current": c.id === activa ? "page" : null } }, [
      crearAvatar({ nombre: c.nombre, avatarPath: c.avatarPath }),
      crear("div", { clase: "tarjeta__cuerpo" }, [
        crear("div", { clase: "fila-entre" }, [crear("p", { clase: "tarjeta__titulo", texto: c.nombre }), crear("span", { clase: "texto-secundario", texto: formatearHace(c.fecha) })]),
        crear("p", { clase: "tarjeta__detalle conversacion__ultimo", texto: c.ultimo }),
      ]),
    ]),
  ]);
}

/** Diferencias por rol: a quién se le escribe y a dónde lleva cada conversación. */
const POR_ROL = Object.freeze({
  craftsman: { base: "/artesano/chat", contraparte: "Cliente", vacio: "Aún no tienes conversaciones.", presupuesto: "Presupuesto enviado" },
  client: { base: "/chat", contraparte: "Taller", vacio: "Aún no tienes conversaciones. Pide una cotización a un taller para empezar a chatear.", presupuesto: "Te enviaron un presupuesto" },
});

/**
 * @param {"craftsman" | "client"} [rol]
 * @returns {() => Promise<Node>}
 */
export function renderChats(rol = "craftsman") {
  return () => pintarChats(rol);
}

/** @returns {boolean} si la app se ve en modo PC (ui/escritorio.js) */
export const enEscritorio = () => document.documentElement.hasAttribute("data-escritorio");

/**
 * Pantalla con la barra de navegación y, en PC, la lista de conversaciones a la izquierda y `derecha` al lado.
 * @param {"craftsman" | "client"} rol
 * @param {string | null} activa id de la conversación abierta
 * @param {Node} derecha conversación abierta o el aviso "Elige una conversación"
 * @returns {HTMLElement}
 */
export function crearChatsEnDosPaneles(rol, activa, derecha) {
  return crearPantalla({ rol, activa: "chats", clase: "chats chats--dos-paneles", titulo: "Chats", perfil: true }, [
    crear("div", { clase: "chats__paneles" }, [crear("aside", { clase: "chats__lista", attrs: { "aria-label": "Conversaciones" } }, crearPanelConversaciones(rol, activa)), derecha]),
  ]);
}

/**
 * @param {"craftsman" | "client"} rol
 * @returns {Promise<Node>}
 */
async function pintarChats(rol) {
  if (enEscritorio()) {
    return crearChatsEnDosPaneles(
      rol,
      null,
      crear("div", { clase: "chats__elige" }, [icono("chat", { tam: 32 }), crear("p", { texto: "Elige una conversación para verla aquí." })]),
    );
  }
  return crearPantalla({ rol, activa: "chats", clase: "chats", titulo: "Chats", perfil: true }, crearPanelConversaciones(rol, null));
}

/**
 * Buscador y lista de conversaciones (se cargan al crearse).
 * @param {"craftsman" | "client"} rol
 * @param {string | null} activa id de la conversación abierta (PC)
 * @returns {Node[]}
 */
function crearPanelConversaciones(rol, activa) {
  const textos = POR_ROL[rol];
  const entrada = /** @type {HTMLInputElement} */ (crear("input", { attrs: { type: "search", placeholder: "Buscar conversación", "aria-label": "Buscar conversación" } }));
  const lista = crear("div");

  /** @type {Conversacion[]} */
  let todas = [];
  const pintarLista = () => {
    const visibles = filtrarConversaciones(todas, entrada.value);
    return visibles.length === 0
      ? crearVacio(todas.length === 0 ? textos.vacio : "Ninguna conversación coincide.", null, { icono: "chat" })
      : crear("ul", { clase: "lista lista--separada" }, visibles.map((c) => crearFila(c, textos.base, activa)));
  };
  entrada.addEventListener("input", () => lista.replaceChildren(pintarLista()));

  cargarEn(
    lista,
    async () => {
      const solicitudes = (await apiSolicitudes.listMyRequests()).filter((s) => s.status !== "draft");
      const conversaciones = await Promise.all(
        solicitudes.map(async (s) => {
          const [detalle, mensajes] = await Promise.all([apiSolicitudes.getRequest(s.id).catch(() => null), api.listMessages(s.id, { limit: 1 }).catch(() => [])]);
          const ultimo = mensajes.at(-1);
          return { id: s.id, nombre: detalle?.counterpart?.full_name ?? textos.contraparte, avatarPath: detalle?.counterpart?.avatar_path ?? null, ultimo: ultimo?.kind === "quote_card" ? textos.presupuesto : ultimo?.body ?? "", fecha: ultimo?.created_at ?? s.created_at };
        }),
      );
      todas = conversaciones.sort((a, b) => b.fecha.localeCompare(a.fecha));
      return todas;
    },
    pintarLista,
  );
  return [crear("div", { clase: "campo campo--icono buscador" }, [icono("buscar", { tam: 18 }), entrada]), lista];
}
