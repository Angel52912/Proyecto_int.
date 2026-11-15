import { REQUIERE_SESION } from "../../ui/sesion.js";
import { renderEnviarPresupuesto } from "./pages/enviar-presupuesto.js";
import { renderPresupuesto } from "./pages/presupuesto.js";

/** @type {ReadonlyArray<import("../../router.js").Ruta>} */
export const rutas = [
  { path: "/presupuesto/:quoteId", requiereSesion: REQUIERE_SESION, render: renderPresupuesto },
  { path: "/artesano/solicitud/:requestId", requiereSesion: REQUIERE_SESION, render: renderEnviarPresupuesto },
];
