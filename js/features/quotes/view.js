// Pantalla de presupuesto (CU-04). La fase 01 solo deja el armazón.

import { Pantalla } from "../../components/pantalla.js";

/** @returns {HTMLElement} */
export function BudgetScreen() {
  return Pantalla({
    activeNav: "pedidos",
    hideNavOnMobile: true,
    titulo: "Presupuesto",
  });
}
