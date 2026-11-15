// Perfil del cliente. La fase 01 solo deja un stub mínimo.

import { AppShell } from "../../components/shell.js";

/** @returns {HTMLElement} */
export function ProfileScreen() {
  const titulo = document.createElement("h1");
  titulo.textContent = "Perfil";

  const aviso = document.createElement("p");
  aviso.className = "ui-texto-muted";
  aviso.textContent = "Próximamente";

  return AppShell({
    activeNav: "perfil",
    children: [titulo, aviso],
  });
}
