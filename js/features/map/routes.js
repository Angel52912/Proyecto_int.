import {
  HomeScreen,
  MapScreen,
  WorkshopListScreen,
  WorkshopDetailScreen,
} from "./view.js";

/** @type {ReadonlyArray<import("../../router.js").Ruta>} */
export const rutas = [
  { path: "/", render: HomeScreen },
  { path: "/mapa", render: MapScreen },
  { path: "/talleres/:categoria", render: WorkshopListScreen },
  { path: "/taller/:tallerId", render: WorkshopDetailScreen },
];
