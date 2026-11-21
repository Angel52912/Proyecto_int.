import { soloPara } from "../auth/guardia.js";
import { REQUIERE_SESION } from "../../ui/sesion.js";
import { renderActualizarFase } from "./pages/actualizar-fase.js";
import { renderCalificar } from "./pages/calificar.js";
import { renderPedidos } from "./pages/pedidos.js";
import { renderRecoger } from "./pages/recoger.js";
import { renderSeguimiento } from "./pages/seguimiento.js";
import { renderTablero } from "./pages/tablero.js";
import { renderVerificarEntrega } from "./pages/verificar-entrega.js";

/** @type {ReadonlyArray<import("../../router.js").Ruta>} */
export const rutas = [
  { path: "/pedidos", requiereSesion: REQUIERE_SESION, render: soloPara(["client"], renderPedidos) },
  { path: "/pedido/:orderId", requiereSesion: REQUIERE_SESION, render: soloPara(["client"], renderSeguimiento) },
  { path: "/pedido/:orderId/recoger", requiereSesion: REQUIERE_SESION, render: soloPara(["client"], renderRecoger) },
  { path: "/pedido/:orderId/calificar", requiereSesion: REQUIERE_SESION, render: soloPara(["client"], renderCalificar) },
  { path: "/artesano/tablero", requiereSesion: REQUIERE_SESION, render: soloPara(["craftsman"], renderTablero) },
  { path: "/artesano/pedido/:orderId", requiereSesion: REQUIERE_SESION, render: soloPara(["craftsman"], renderActualizarFase) },
  { path: "/artesano/pedido/:orderId/entrega", requiereSesion: REQUIERE_SESION, render: soloPara(["craftsman"], renderVerificarEntrega) },
];
