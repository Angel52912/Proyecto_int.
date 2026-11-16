import { REQUIERE_SESION } from "../../ui/sesion.js";
import { renderChat } from "./pages/chat.js";
import { renderChats } from "./pages/chats.js";

/** @type {ReadonlyArray<import("../../router.js").Ruta>} */
export const rutas = [
  { path: "/chat/:requestId", requiereSesion: REQUIERE_SESION, render: renderChat("client") },
  { path: "/artesano/chats", requiereSesion: REQUIERE_SESION, render: renderChats },
  { path: "/artesano/chat/:requestId", requiereSesion: REQUIERE_SESION, render: renderChat("craftsman") },
];
