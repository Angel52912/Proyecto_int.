// Shell adaptativo: barra inferior en móvil/tablet y barra lateral en escritorio.

import { Icon } from "./icon.js";
import { agregarContenido } from "./ui.js";

const DESTINOS = [
  { id: "inicio", etiqueta: "Inicio", icono: "home", ruta: "/" },
  { id: "mapa", etiqueta: "Mapa", icono: "map-pin", ruta: "/mapa" },
  { id: "pedidos", etiqueta: "Pedidos", icono: "clipboard", ruta: "/pedidos" },
  { id: "perfil", etiqueta: "Perfil", icono: "user", ruta: "/perfil" },
];

/**
 * @param {{ activeItem?: string }} props
 * @returns {HTMLAnchorElement[]}
 */
function crearItems(activeItem) {
  return DESTINOS.map((destino) => {
    const activo = destino.id === activeItem;
    const enlace = document.createElement("a");
    enlace.className = "ui-nav__item" + (activo ? " ui-nav__item--activo" : "");
    enlace.href = `#${destino.ruta}`;
    if (activo) enlace.setAttribute("aria-current", "page");
    enlace.append(Icon({ name: destino.icono, size: 22 }));

    const etiqueta = document.createElement("span");
    etiqueta.textContent = destino.etiqueta;
    enlace.appendChild(etiqueta);
    return enlace;
  });
}

/**
 * Barra de navegación inferior (solo <1024px).
 * @param {{ activeItem?: string }} props
 */
export function BottomNav({ activeItem } = {}) {
  const nav = document.createElement("nav");
  nav.className = "ui-bottom-nav";
  nav.setAttribute("aria-label", "Navegación principal");
  agregarContenido(nav, crearItems(activeItem));
  return nav;
}

/**
 * Barra de navegación lateral (solo ≥1024px).
 * @param {{ activeItem?: string }} props
 */
export function SideNav({ activeItem } = {}) {
  const aside = document.createElement("aside");
  aside.className = "ui-side-nav";
  aside.setAttribute("aria-label", "Navegación principal");

  const nav = document.createElement("nav");
  const lista = document.createElement("ul");
  lista.className = "ui-side-nav__lista";

  for (const enlace of crearItems(activeItem)) {
    const elemento = document.createElement("li");
    elemento.appendChild(enlace);
    lista.appendChild(elemento);
  }

  nav.appendChild(lista);
  aside.appendChild(nav);
  return aside;
}

/**
 * Contenedor principal de cada pantalla.
 * @param {{ activeNav?: "inicio" | "mapa" | "pedidos" | "perfil", hideNavOnMobile?: boolean, fullBleed?: boolean, flush?: boolean, maxWidth?: number, children?: Node | Node[] }} props
 */
export function AppShell({
  activeNav,
  hideNavOnMobile = false,
  fullBleed = false,
  flush = false,
  maxWidth = 1120,
  children,
} = {}) {
  const shell = document.createElement("div");
  shell.className =
    "ui-shell" +
    (hideNavOnMobile ? " ui-shell--sin-nav-movil" : "") +
    (fullBleed ? " ui-shell--completo" : "") +
    (flush ? " ui-shell--flush" : "");
  shell.style.setProperty("--shell-max-width", `${maxWidth}px`);

  const main = document.createElement("main");
  main.className = "ui-shell__main";
  agregarContenido(main, children);

  shell.append(SideNav({ activeItem: activeNav }), main, BottomNav({ activeItem: activeNav }));
  return shell;
}
