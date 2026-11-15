import { REQUIERE_SESION } from "../../ui/sesion.js";
import { renderRecoger } from "./pages/recoger.js";
import { renderSeguimiento } from "./pages/seguimiento.js";

/** @type {ReadonlyArray<import("../../router.js").Ruta>} */
export const rutas = [
  { path: "/pedido/:orderId/recoger", requiereSesion: REQUIERE_SESION, render: renderRecoger },
  { path: "/pedido/:orderId", requiereSesion: REQUIERE_SESION, render: renderSeguimiento },
];
