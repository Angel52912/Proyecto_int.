// Pantallas del flujo de búsqueda de talleres (CU-02).
// En la fase 01 solo montan el shell y el título; las fases 02 a 05 las completan.

import { Pantalla } from "../../components/pantalla.js";

/** @returns {HTMLElement} */
export function HomeScreen() {
  return Pantalla({ activeNav: "inicio", titulo: "Inicio" });
}

/** @returns {HTMLElement} */
export function MapScreen() {
  return Pantalla({ activeNav: "mapa", titulo: "Mapa" });
}

/** @returns {HTMLElement} */
export function WorkshopListScreen() {
  return Pantalla({ activeNav: "mapa", titulo: "Lista de talleres" });
}

/** @returns {HTMLElement} */
export function WorkshopDetailScreen() {
  return Pantalla({
    activeNav: "mapa",
    hideNavOnMobile: true,
    titulo: "Perfil del taller",
  });
}
