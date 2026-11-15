// Pantalla provisional de la fase 01: shell + título. Las fases siguientes la sustituyen.

import { AppShell } from "./shell.js";

/**
 * @param {{ activeNav?: "inicio" | "mapa" | "pedidos" | "perfil", hideNavOnMobile?: boolean, titulo: string }} props
 * @returns {HTMLElement}
 */
export function Pantalla({ activeNav, hideNavOnMobile = false, titulo }) {
  const encabezado = document.createElement("h1");
  encabezado.textContent = titulo;

  return AppShell({
    activeNav,
    hideNavOnMobile,
    children: encabezado,
  });
}
