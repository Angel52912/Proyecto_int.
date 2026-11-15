import { REQUIERE_SESION } from "../../ui/sesion.js";
import { renderSolicitar } from "./pages/solicitar.js";

/** @type {ReadonlyArray<import("../../router.js").Ruta>} */
export const rutas = [{ path: "/solicitar/:tallerId", requiereSesion: REQUIERE_SESION, render: renderSolicitar }];
