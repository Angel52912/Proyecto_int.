import {
  OrderTrackingScreen,
  PickupScreen,
  RatingScreen,
  MyOrdersScreen,
} from "./view.js";

/** @type {ReadonlyArray<import("../../router.js").Ruta>} */
export const rutas = [
  { path: "/pedidos", render: MyOrdersScreen },
  { path: "/pedido/:pedidoId/recoger", render: PickupScreen },
  { path: "/pedido/:pedidoId/calificar", render: RatingScreen },
  { path: "/pedido/:pedidoId", render: OrderTrackingScreen },
];
