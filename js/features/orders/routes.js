import { REQUIERE_SESION } from "../../ui/sesion.js";
import { renderCalificar } from "./pages/calificar.js";
import { renderPedidos } from "./pages/pedidos.js";
import { renderRecoger } from "./pages/recoger.js";
import { renderSeguimiento } from "./pages/seguimiento.js";
import { renderTablero } from "./pages/tablero.js";

/** @type {ReadonlyArray<import("../../router.js").Ruta>} */
export const rutas = [
  { path: "/pedidos", requiereSesion: REQUIERE_SESION, render: renderPedidos },
  { path: "/pedido/:orderId", requiereSesion: REQUIERE_SESION, render: renderSeguimiento },
  { path: "/pedido/:orderId/recoger", requiereSesion: REQUIERE_SESION, render: renderRecoger },
  { path: "/pedido/:orderId/calificar", requiereSesion: REQUIERE_SESION, render: renderCalificar },
  { path: "/artesano/tablero", requiereSesion: REQUIERE_SESION, render: renderTablero },
];
