// 24 · Chats (Artesano): lista de conversaciones con búsqueda y último mensaje.
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

/** @param {Conversacion} c */
function crearFila(c) {
  return crear("li", {}, [
    enlace(`/artesano/chat/${c.id}`, { clase: "conversacion" }, [
      crearAvatar({ nombre: c.nombre, avatarPath: c.avatarPath }),
      crear("div", { clase: "tarjeta__cuerpo" }, [
        crear("div", { clase: "fila-entre" }, [crear("p", { clase: "tarjeta__titulo", texto: c.nombre }), crear("span", { clase: "texto-secundario", texto: formatearHace(c.fecha) })]),
        crear("p", { clase: "tarjeta__detalle conversacion__ultimo", texto: c.ultimo }),
      ]),
    ]),
  ]);
}

/** @returns {Promise<Node>} */
export async function renderChats() {
  const entrada = /** @type {HTMLInputElement} */ (crear("input", { attrs: { type: "search", placeholder: "Buscar conversación", "aria-label": "Buscar conversación" } }));
  const lista = crear("div");
  const pantalla = crearPantalla({ rol: "craftsman", activa: "chats", clase: "chats" }, [
    crear("h1", { clase: "pantalla__titulo", texto: "Chats" }),
    crear("div", { clase: "campo campo--icono buscador" }, [icono("buscar", { tam: 18 }), entrada]),
    lista,
  ]);

  /** @type {Conversacion[]} */
  let todas = [];
  const pintarLista = () => {
    const visibles = filtrarConversaciones(todas, entrada.value);
    return visibles.length === 0
      ? crearVacio(todas.length === 0 ? "Aún no tienes conversaciones." : "Ninguna conversación coincide.")
      : crear("ul", { clase: "lista lista--separada" }, visibles.map(crearFila));
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
          return { id: s.id, nombre: detalle?.counterpart?.full_name ?? "Cliente", avatarPath: detalle?.counterpart?.avatar_path ?? null, ultimo: ultimo?.kind === "quote_card" ? "Presupuesto enviado" : ultimo?.body ?? "", fecha: ultimo?.created_at ?? s.created_at };
        }),
      );
      todas = conversaciones.sort((a, b) => b.fecha.localeCompare(a.fecha));
      return todas;
    },
    pintarLista,
  );
  return pantalla;
}
