// Pantalla de solicitud de cotización (CU-03). La fase 01 solo deja el armazón.

import { Pantalla } from "../../components/pantalla.js";

/** @returns {HTMLElement} */
export function QuoteRequestScreen() {
  return Pantalla({
    activeNav: "mapa",
    hideNavOnMobile: true,
    titulo: "Solicitar cotización",
  });
}
