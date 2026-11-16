import { BudgetScreen } from "./view.js";

/** @type {ReadonlyArray<import("../../router.js").Ruta>} */
export const rutas = [
  { path: "/pedido/:pedidoId/presupuesto", render: BudgetScreen },
];
