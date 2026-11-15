import { REQUIERE_SESION } from "../../ui/sesion.js";
import { renderInicio } from "./pages/inicio.js";
import { renderMapa } from "./pages/mapa.js";

/** @type {ReadonlyArray<import("../../router.js").Ruta>} */
export const rutas = [
  { path: "/inicio", requiereSesion: REQUIERE_SESION, render: renderInicio },
  { path: "/mapa", requiereSesion: REQUIERE_SESION, render: renderMapa },
];
