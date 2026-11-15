import { REQUIERE_SESION } from "../../ui/sesion.js";
import { renderSolicitar } from "./pages/solicitar.js";
import { renderSolicitudesArtesano } from "./pages/solicitudes-artesano.js";

/** @type {ReadonlyArray<import("../../router.js").Ruta>} */
export const rutas = [
  { path: "/solicitar/:tallerId", requiereSesion: REQUIERE_SESION, render: renderSolicitar },
  { path: "/artesano/solicitudes", requiereSesion: REQUIERE_SESION, render: renderSolicitudesArtesano },
];
