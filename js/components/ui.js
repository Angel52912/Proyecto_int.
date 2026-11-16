// Componentes base reutilizables de la interfaz del cliente.
// Todos devuelven nodos del DOM: el proyecto no usa framework ni JSX.

import { Icon } from "./icon.js";

/**
 * Agrega texto o nodos a un contenedor sin usar HTML crudo.
 * @param {Node} contenedor
 * @param {string | number | Node | Array<string | number | Node> | null | undefined} contenido
 */
export function agregarContenido(contenedor, contenido) {
  if (contenido === null || contenido === undefined) return;
  if (Array.isArray(contenido)) {
    for (const hijo of contenido) agregarContenido(contenedor, hijo);
    return;
  }
  if (contenido instanceof Node) {
    contenedor.appendChild(contenido);
    return;
  }
  contenedor.appendChild(document.createTextNode(String(contenido)));
}

/**
 * @param {string} href
 * @returns {string}
 */
function normalizarHref(href) {
  return href.startsWith("#") ? href : `#${href}`;
}

/**
 * @param {string | Node | null | undefined} icono
 * @returns {Node | null}
 */
function resolverIcono(icono) {
  if (icono === null || icono === undefined) return null;
  return typeof icono === "string" ? Icon({ name: icono }) : icono;
}

/**
 * Imagen con placeholder.
 * @param {{ src?: string, alt: string, width?: number | string, height?: number | string, rounded?: boolean, iconSize?: number }} props
 */
export function ImagePlaceholder({ src, alt, width, height, rounded = true, iconSize = 24 }) {
  const caja = document.createElement("div");
  caja.className = "ui-imagen" + (rounded ? " ui-imagen--redondeada" : "");
  if (width !== undefined) caja.style.width = typeof width === "number" ? `${width}px` : width;
  if (height !== undefined) {
    caja.style.height = typeof height === "number" ? `${height}px` : height;
    caja.style.minHeight = "0";
  }

  if (src !== undefined && src !== "") {
    const img = document.createElement("img");
    img.src = src;
    img.alt = alt;
    caja.appendChild(img);
  } else {
    caja.appendChild(Icon({ name: "image", size: iconSize }));
    caja.setAttribute("role", "img");
    caja.setAttribute("aria-label", alt);
  }

  return caja;
}

/**
 * Botón o enlace con las variantes de la guía.
 * @param {{ variant?: "primary" | "outline" | "teal" | "icon", fullWidth?: boolean, leftIcon?: string | Node, onClick?: (evento: MouseEvent) => void, href?: string, children?: string | Node | Array<string | Node>, ariaLabel?: string }} props
 */
export function Button({
  variant = "primary",
  fullWidth = false,
  leftIcon,
  onClick,
  href,
  children,
  ariaLabel,
} = {}) {
  const esEnlace = href !== undefined && href !== "";
  const elemento = document.createElement(esEnlace ? "a" : "button");
  elemento.className = `ui-boton ui-boton--${variant}` + (fullWidth ? " ui-boton--ancho" : "");
  if (ariaLabel !== undefined) elemento.setAttribute("aria-label", ariaLabel);

  if (esEnlace) {
    elemento.href = normalizarHref(href);
  } else {
    elemento.type = "button";
    if (onClick !== undefined) elemento.addEventListener("click", onClick);
  }

  agregarContenido(elemento, resolverIcono(leftIcon));
  agregarContenido(elemento, children);
  return elemento;
}

/**
 * Chip de filtro, etiqueta o estado.
 * @param {{ variant?: "filter" | "tag" | "status", tone?: "neutral" | "primary" | "teal" | "amber" | "green", active?: boolean, leftIcon?: string | Node, onClick?: (evento: MouseEvent) => void, children?: string | Node | Array<string | Node> }} props
 */
export function Chip({
  variant = "filter",
  tone = "neutral",
  active = false,
  leftIcon,
  onClick,
  children,
} = {}) {
  const elemento = document.createElement(onClick !== undefined ? "button" : "span");
  elemento.className = `ui-chip ui-chip--${variant} ui-chip--${variant}-${tone}`;
  if (variant === "filter" && active) elemento.classList.add("ui-chip--activo");
  if (elemento instanceof HTMLButtonElement) {
    elemento.type = "button";
    elemento.addEventListener("click", onClick);
  }
  agregarContenido(elemento, resolverIcono(leftIcon));
  agregarContenido(elemento, children);
  return elemento;
}

/**
 * Estrellas de calificación.
 * @param {{ value: number, size?: number, interactive?: boolean, onChange?: (valor: number) => void }} props
 */
export function Rating({ value, size = 14, interactive = false, onChange }) {
  const contenedor = document.createElement("span");
  contenedor.className = "ui-rating";
  contenedor.setAttribute("aria-label", `${value} de 5 estrellas`);

  for (let numero = 1; numero <= 5; numero += 1) {
    const llena = numero <= value;
    const estrella = document.createElement(interactive ? "button" : "span");
    estrella.className =
      "ui-rating__estrella " +
      (llena ? "ui-rating__estrella--llena" : "ui-rating__estrella--vacia") +
      (interactive ? " ui-rating__estrella--interactiva" : "");

    if (estrella instanceof HTMLButtonElement) {
      estrella.type = "button";
      estrella.setAttribute("aria-label", `${numero} estrellas`);
      if (onChange !== undefined) {
        estrella.addEventListener("click", () => onChange(numero));
      }
    }

    estrella.appendChild(Icon({ name: llena ? "star" : "star-outline", size }));
    contenedor.appendChild(estrella);
  }

  return contenedor;
}

/**
 * Barra de progreso.
 * @param {{ value: number, tone?: "teal" | "amber" }} props
 */
export function ProgressBar({ value, tone = "teal" }) {
  const porcentaje = Math.min(100, Math.max(0, value));
  const pista = document.createElement("div");
  pista.className = "ui-progreso";
  pista.setAttribute("role", "progressbar");
  pista.setAttribute("aria-valuemin", "0");
  pista.setAttribute("aria-valuemax", "100");
  pista.setAttribute("aria-valuenow", String(porcentaje));

  const relleno = document.createElement("div");
  relleno.className = "ui-progreso__relleno" + (tone === "amber" ? " ui-progreso__relleno--amber" : "");
  relleno.style.width = `${porcentaje}%`;
  pista.appendChild(relleno);
  return pista;
}

/**
 * Tarjeta de contenido.
 * @param {{ onClick?: (evento: MouseEvent) => void, padding?: number, tone?: "default" | "amber-soft" | "teal-soft" | "repair", children?: string | Node | Array<string | Node> }} props
 */
export function Card({ onClick, padding, tone = "default", children } = {}) {
  const elemento = document.createElement(onClick !== undefined ? "button" : "div");
  elemento.className = "ui-card" + (tone === "default" ? "" : ` ui-card--${tone}`);
  if (padding !== undefined) elemento.style.padding = `${padding}px`;
  if (elemento instanceof HTMLButtonElement) {
    elemento.type = "button";
    elemento.addEventListener("click", onClick);
  }
  agregarContenido(elemento, children);
  return elemento;
}

/**
 * Campo de búsqueda con icono.
 * @param {{ placeholder: string, value?: string, onChange?: (valor: string) => void, onFocus?: () => void, onEnter?: () => void, rightSlot?: Node }} props
 */
export function SearchInput({ placeholder, value, onChange, onFocus, onEnter, rightSlot }) {
  const caja = document.createElement("div");
  caja.className = "ui-buscador";
  caja.appendChild(Icon({ name: "search", size: 18 }));

  const input = document.createElement("input");
  input.type = "search";
  input.placeholder = placeholder;
  input.setAttribute("aria-label", placeholder);
  if (value !== undefined) input.value = value;
  if (onChange !== undefined) {
    input.addEventListener("input", () => onChange(input.value));
  }
  if (onFocus !== undefined) input.addEventListener("focus", onFocus);
  if (onEnter !== undefined) {
    input.addEventListener("keydown", (evento) => {
      if (evento.key === "Enter") onEnter();
    });
  }
  caja.appendChild(input);

  if (rightSlot !== undefined) {
    const extra = document.createElement("span");
    extra.className = "ui-buscador__extra";
    extra.appendChild(rightSlot);
    caja.appendChild(extra);
  }

  return caja;
}

/**
 * Área de texto con etiqueta opcional.
 * @param {{ label?: string, placeholder: string, value: string, onChange: (valor: string) => void, rows?: number }} props
 */
export function TextArea({ label, placeholder, value, onChange, rows = 4 }) {
  const campo = document.createElement("label");
  campo.className = "ui-campo";

  if (label !== undefined && label !== "") {
    const etiqueta = document.createElement("span");
    etiqueta.className = "ui-campo__etiqueta";
    etiqueta.textContent = label;
    campo.appendChild(etiqueta);
  }

  const area = document.createElement("textarea");
  area.placeholder = placeholder;
  area.value = value;
  area.rows = rows;
  area.addEventListener("input", () => onChange(area.value));
  campo.appendChild(area);
  return campo;
}

/**
 * Avatar con iniciales.
 * @param {{ initials: string, size?: number }} props
 */
export function Avatar({ initials, size = 36 }) {
  const avatar = document.createElement("span");
  avatar.className = "ui-avatar";
  avatar.style.width = `${size}px`;
  avatar.style.height = `${size}px`;
  avatar.textContent = initials;
  avatar.setAttribute("aria-hidden", "true");
  return avatar;
}

/**
 * Encabezado de sección con acción opcional.
 * @param {{ title: string, actionLabel?: string, onAction?: (evento: MouseEvent) => void, href?: string }} props
 */
export function SectionHeader({ title, actionLabel, onAction, href }) {
  const fila = document.createElement("div");
  fila.className = "ui-seccion";

  const titulo = document.createElement("h2");
  titulo.className = "ui-seccion__titulo";
  titulo.textContent = title;
  fila.appendChild(titulo);

  if (actionLabel !== undefined && actionLabel !== "") {
    if (href !== undefined && href !== "") {
      const enlace = document.createElement("a");
      enlace.className = "ui-seccion__accion";
      enlace.href = normalizarHref(href);
      enlace.textContent = actionLabel;
      fila.appendChild(enlace);
    } else if (onAction !== undefined) {
      const boton = document.createElement("button");
      boton.type = "button";
      boton.className = "ui-seccion__accion";
      boton.textContent = actionLabel;
      boton.addEventListener("click", onAction);
      fila.appendChild(boton);
    }
  }

  return fila;
}

/**
 * Fondo de mapa estilizado. No hay proveedor real (Nivel 3).
 * @param {{ height?: number | string, children?: Node | Node[] }} props
 */
export function MapBackdrop({ height, children } = {}) {
  const mapa = document.createElement("div");
  mapa.className = "ui-mapa";
  if (height !== undefined) {
    mapa.style.height = typeof height === "number" ? `${height}px` : height;
  }

  for (const calle of ["h1", "h2", "h3", "v1", "v2", "v3"]) {
    const linea = document.createElement("div");
    linea.className = `ui-mapa__calle ui-mapa__calle--${calle}`;
    mapa.appendChild(linea);
  }

  for (const parque of ["uno", "dos"]) {
    const zona = document.createElement("div");
    zona.className = `ui-mapa__parque ui-mapa__parque--${parque}`;
    mapa.appendChild(zona);
  }

  agregarContenido(mapa, children);
  return mapa;
}

/**
 * Pin del mapa estilizado.
 * @param {{ selected?: boolean, x: number | string, y: number | string, onClick?: (evento: MouseEvent) => void, ariaLabel: string }} props
 */
export function MapPin({ selected = false, x, y, onClick, ariaLabel }) {
  const pin = document.createElement("button");
  pin.type = "button";
  pin.className = "ui-map-pin" + (selected ? " ui-map-pin--seleccionado" : "");
  pin.style.left = typeof x === "number" ? `${x}%` : x;
  pin.style.top = typeof y === "number" ? `${y}%` : y;
  pin.setAttribute("aria-label", ariaLabel);
  if (onClick !== undefined) pin.addEventListener("click", onClick);
  pin.appendChild(Icon({ name: "wrench", size: 16 }));
  return pin;
}

/**
 * Encabezado de página con botón de regreso.
 * @param {{ title: string, onBack?: () => void, showBack?: boolean, rightSlot?: Node }} props
 */
export function PageHeader({ title, onBack, showBack = true, rightSlot }) {
  const fila = document.createElement("div");
  fila.className = "ui-page-header";

  if (showBack) {
    const atras = document.createElement("button");
    atras.type = "button";
    atras.className = "ui-page-header__atras";
    atras.setAttribute("aria-label", "Volver");
    atras.appendChild(Icon({ name: "chevron-left", size: 20 }));
    atras.addEventListener("click", () => {
      if (onBack !== undefined) onBack();
      else window.history.back();
    });
    fila.appendChild(atras);
  }

  const titulo = document.createElement("h1");
  titulo.className = "ui-page-header__titulo";
  titulo.textContent = title;
  fila.appendChild(titulo);

  if (rightSlot !== undefined) {
    const extra = document.createElement("span");
    extra.className = "ui-page-header__extra";
    extra.appendChild(rightSlot);
    fila.appendChild(extra);
  }

  return fila;
}

/**
 * Barra de acciones fija en móvil y estática en escritorio.
 * @param {{ children?: Node | Node[] }} props
 */
export function StickyActionBar({ children } = {}) {
  const barra = document.createElement("div");
  barra.className = "ui-barra-acciones";
  agregarContenido(barra, children);
  return barra;
}
