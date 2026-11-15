import { REQUIERE_SESION } from "../../ui/sesion.js";
import { renderChat } from "./pages/chat.js";

/** @type {ReadonlyArray<import("../../router.js").Ruta>} */
export const rutas = [
  { path: "/chat/:requestId", requiereSesion: REQUIERE_SESION, render: renderChat("client") },
  { path: "/artesano/chat/:requestId", requiereSesion: REQUIERE_SESION, render: renderChat("craftsman") },
];
