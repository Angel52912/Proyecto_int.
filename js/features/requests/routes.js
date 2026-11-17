import { soloPara } from "../auth/guardia.js";
import { REQUIERE_SESION } from "../../ui/sesion.js";
import { renderAvisos } from "./pages/avisos.js";
import { renderSimulacion } from "./pages/simulacion.js";
import { renderSolicitar } from "./pages/solicitar.js";
import { renderSolicitudesArtesano } from "./pages/solicitudes-artesano.js";

/** @type {ReadonlyArray<import("../../router.js").Ruta>} */
export const rutas = [
  { path: "/solicitar/:tallerId", requiereSesion: REQUIERE_SESION, render: soloPara(["client"], renderSolicitar) },
  { path: "/artesano/solicitudes", requiereSesion: REQUIERE_SESION, render: soloPara(["craftsman"], renderSolicitudesArtesano) },
  { path: "/avisos", requiereSesion: REQUIERE_SESION, render: soloPara(["client"], renderAvisos("client")) },
  { path: "/artesano/avisos", requiereSesion: REQUIERE_SESION, render: soloPara(["craftsman"], renderAvisos("craftsman")) },
  // Solo con la API simulada: cambia entre cliente y artesano.
  { path: "/simulacion", render: renderSimulacion },
];
