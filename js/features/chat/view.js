// Pantalla de chat (CU-03). La fase 01 solo deja el armazón.

import { Pantalla } from "../../components/pantalla.js";

/** @returns {HTMLElement} */
export function ChatScreen() {
  return Pantalla({
    activeNav: "pedidos",
    hideNavOnMobile: true,
    titulo: "Chat",
  });
}
