import { QuoteRequestScreen } from "./view.js";

/** @type {ReadonlyArray<import("../../router.js").Ruta>} */
export const rutas = [
  { path: "/taller/:tallerId/cotizar", render: QuoteRequestScreen },
];
