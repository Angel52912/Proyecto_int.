import { REQUIERE_SESION } from "../../ui/sesion.js";
import { renderSimulacion } from "./pages/simulacion.js";
import { renderSolicitar } from "./pages/solicitar.js";
import { renderSolicitudesArtesano } from "./pages/solicitudes-artesano.js";

/** @type {ReadonlyArray<import("../../router.js").Ruta>} */
export const rutas = [
  { path: "/solicitar/:tallerId", requiereSesion: REQUIERE_SESION, render: renderSolicitar },
  { path: "/artesano/solicitudes", requiereSesion: REQUIERE_SESION, render: renderSolicitudesArtesano },
  // Solo con la API simulada: cambia entre cliente y artesano.
  { path: "/simulacion", render: renderSimulacion },
];
