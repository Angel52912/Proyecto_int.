// Pantallas de pedidos: seguimiento, entrega y calificación (CU-05 y CU-06).
// En la fase 01 solo montan el shell y el título.

import { Pantalla } from "../../components/pantalla.js";

/** @returns {HTMLElement} */
export function OrderTrackingScreen() {
  return Pantalla({
    activeNav: "pedidos",
    titulo: "Seguimiento de pedido",
  });
}

/** @returns {HTMLElement} */
export function PickupScreen() {
  return Pantalla({
    activeNav: "pedidos",
    hideNavOnMobile: true,
    titulo: "Recoger pedido",
  });
}

/** @returns {HTMLElement} */
export function RatingScreen() {
  return Pantalla({
    activeNav: "pedidos",
    hideNavOnMobile: true,
    titulo: "Calificación",
  });
}

/** @returns {HTMLElement} */
export function MyOrdersScreen() {
  return Pantalla({
    activeNav: "pedidos",
    titulo: "Mis pedidos",
  });
}
