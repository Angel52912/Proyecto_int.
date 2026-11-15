import { REQUIERE_SESION } from "../../ui/sesion.js";
import { renderSeguimiento } from "./pages/seguimiento.js";

/** @type {ReadonlyArray<import("../../router.js").Ruta>} */
export const rutas = [{ path: "/pedido/:orderId", requiereSesion: REQUIERE_SESION, render: renderSeguimiento }];
