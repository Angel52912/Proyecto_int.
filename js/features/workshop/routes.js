import { REQUIERE_SESION } from "../../ui/sesion.js";
import { renderMiTaller } from "./pages/mi-taller.js";
import { renderTaller } from "./pages/taller.js";

/** @type {ReadonlyArray<import("../../router.js").Ruta>} */
export const rutas = [
  { path: "/artesano/taller", requiereSesion: REQUIERE_SESION, render: renderTaller },
  { path: "/artesano/perfil", requiereSesion: REQUIERE_SESION, render: renderMiTaller },
];
