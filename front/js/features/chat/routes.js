import { soloPara } from "../auth/guardia.js";
import { REQUIERE_SESION } from "../../ui/sesion.js";
import { renderChat } from "./pages/chat.js";
import { renderChats } from "./pages/chats.js";

/** @type {ReadonlyArray<import("../../router.js").Ruta>} */
export const rutas = [
  { path: "/chats", requiereSesion: REQUIERE_SESION, render: soloPara(["client"], renderChats("client")) },
  { path: "/chat/:requestId", requiereSesion: REQUIERE_SESION, render: soloPara(["client"], renderChat("client")) },
  { path: "/artesano/chats", requiereSesion: REQUIERE_SESION, render: soloPara(["craftsman"], renderChats("craftsman")) },
  { path: "/artesano/chat/:requestId", requiereSesion: REQUIERE_SESION, render: soloPara(["craftsman"], renderChat("craftsman")) },
];
