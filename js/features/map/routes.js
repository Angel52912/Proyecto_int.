import { REQUIERE_SESION } from "../../ui/sesion.js";
import { renderInicio } from "./pages/inicio.js";

/** @type {ReadonlyArray<import("../../router.js").Ruta>} */
export const rutas = [
  { path: "/inicio", requiereSesion: REQUIERE_SESION, render: renderInicio },
];
