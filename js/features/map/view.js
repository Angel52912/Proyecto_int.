// Pantallas del flujo de búsqueda de talleres (CU-02).
// La fase 02 completa Inicio; las fases 03 a 05 completan las demás.

import { AppShell } from "../../components/shell.js";
import {
  Card,
  Chip,
  ImagePlaceholder,
  MapBackdrop,
  MapPin,
  ProgressBar,
  SearchInput,
  SectionHeader,
} from "../../components/ui.js";
import { Icon } from "../../components/icon.js";
import { currentOrder, currentUser } from "../../mocks/orders.js";

/** @param {string} ruta */
function irA(ruta) {
  window.location.hash = `#${ruta}`;
}

/**
 * Convierte un bloque en enlace accesible por clic y teclado.
 * @param {HTMLElement} elemento
 * @param {string} ruta
 * @param {string} etiqueta
 */
function enlazarBloque(elemento, ruta, etiqueta) {
  elemento.setAttribute("role", "link");
  elemento.tabIndex = 0;
  elemento.setAttribute("aria-label", etiqueta);
  elemento.classList.add("inicio__enlace-bloque");
  elemento.addEventListener("click", () => irA(ruta));
  elemento.addEventListener("keydown", (evento) => {
    if (evento.key === "Enter" || evento.key === " ") {
      evento.preventDefault();
      irA(ruta);
    }
  });
}

/**
 * Tarjeta de categoría (Reparación / Limpieza).
 * @param {{ tone: "repair" | "teal-soft", icono: string, titulo: string, subtitulo: string, ruta: string }} props
 */
function crearCategoria({ tone, icono, titulo, subtitulo, ruta }) {
  const tarjeta = Card({ tone, onClick: () => irA(ruta) });
  tarjeta.classList.add("inicio__categoria");

  const cajaIcono = document.createElement("span");
  cajaIcono.className =
    "inicio__categoria-icono" + (tone === "teal-soft" ? " inicio__categoria-icono--teal" : "");
  cajaIcono.appendChild(Icon({ name: icono, size: 18 }));

  const textos = document.createElement("span");
  textos.className = "inicio__categoria-textos";

  const tituloEl = document.createElement("span");
  tituloEl.className = "inicio__categoria-titulo";
  tituloEl.textContent = titulo;

  const subtituloEl = document.createElement("span");
  subtituloEl.className = "inicio__categoria-subtitulo";
  subtituloEl.textContent = subtitulo;

  textos.append(tituloEl, subtituloEl);
  tarjeta.append(cajaIcono, textos);
  return tarjeta;
}

/** @returns {HTMLElement} */
function crearEncabezado() {
  const cabecera = document.createElement("div");
  cabecera.className = "inicio__cabecera";

  const saludo = document.createElement("div");
  saludo.className = "inicio__saludo";

  const hola = document.createElement("p");
  hola.className = "inicio__hola";
  hola.textContent = `Hola, ${currentUser.firstName}`;

  const pregunta = document.createElement("h1");
  pregunta.className = "inicio__pregunta";
  pregunta.textContent = "¿Qué restauramos hoy?";

  saludo.append(hola, pregunta);

  const buscador = SearchInput({
    placeholder: "Buscar taller o servicio",
    onFocus: () => irA("/mapa"),
    onEnter: () => irA("/mapa"),
  });
  buscador.classList.add("inicio__buscador");

  const campana = document.createElement("button");
  campana.type = "button";
  campana.className = "ui-boton ui-boton--icon inicio__campana";
  campana.setAttribute("aria-label", "Notificaciones");
  campana.appendChild(Icon({ name: "bell", size: 20 }));

  cabecera.append(saludo, buscador, campana);
  return cabecera;
}

/** @returns {HTMLElement} */
function crearMapa() {
  const mapa = MapBackdrop();
  mapa.classList.add("inicio__mapa");
  mapa.append(
    MapPin({ x: 22, y: 55, ariaLabel: "Taller en el mapa 1" }),
    MapPin({ x: 62, y: 35, ariaLabel: "Taller en el mapa 2" }),
    MapPin({ x: 82, y: 95, ariaLabel: "Taller en el mapa 3" })
  );
  enlazarBloque(mapa, "/mapa", "Ver mapa de talleres");
  return mapa;
}

/** @returns {HTMLElement} */
function crearPedidoEnCurso() {
  const tarjeta = Card({ onClick: () => irA(`/pedido/${currentOrder.id}`), padding: 12 });
  tarjeta.classList.add("inicio__pedido");

  const fila = document.createElement("span");
  fila.className = "inicio__pedido-fila";

  const detalle = document.createElement("span");
  detalle.className = "inicio__pedido-detalle";

  const filaTitulo = document.createElement("span");
  filaTitulo.className = "inicio__pedido-titulo-fila";

  const titulo = document.createElement("span");
  titulo.className = "inicio__pedido-titulo";
  titulo.textContent = currentOrder.item;

  const estado = Chip({
    variant: "status",
    tone: "amber",
    children: currentOrder.serviceLabel,
  });

  const taller = document.createElement("span");
  taller.className = "inicio__pedido-taller";
  taller.textContent = currentOrder.workshopName;

  filaTitulo.append(titulo, estado);
  detalle.append(
    filaTitulo,
    taller,
    ProgressBar({ value: currentOrder.progress })
  );

  fila.append(
    ImagePlaceholder({ alt: currentOrder.item, width: 56, height: 56 }),
    detalle
  );
  tarjeta.appendChild(fila);
  return tarjeta;
}

/** @returns {HTMLElement} */
export function HomeScreen() {
  const categorias = document.createElement("div");
  categorias.className = "inicio__categorias";
  categorias.append(
    crearCategoria({
      tone: "repair",
      icono: "wrench",
      titulo: "Reparación",
      subtitulo: "Suelas, costuras, tacones",
      ruta: "/talleres/reparacion",
    }),
    crearCategoria({
      tone: "teal-soft",
      icono: "sparkle",
      titulo: "Limpieza",
      subtitulo: "Lavado, desinfección, tinte",
      ruta: "/talleres/limpieza",
    })
  );

  const seccionTalleres = document.createElement("section");
  seccionTalleres.className = "inicio__seccion";
  seccionTalleres.append(
    SectionHeader({ title: "Talleres cerca de ti", actionLabel: "Ver mapa", href: "/mapa" }),
    crearMapa()
  );

  const seccionPedido = document.createElement("section");
  seccionPedido.className = "inicio__seccion";
  seccionPedido.append(
    SectionHeader({ title: "Mi pedido en curso" }),
    crearPedidoEnCurso()
  );

  const grid = document.createElement("div");
  grid.className = "inicio__grid";
  grid.append(seccionTalleres, seccionPedido);

  return AppShell({
    activeNav: "inicio",
    children: [crearEncabezado(), categorias, grid],
  });
}

/** @returns {HTMLElement} */
export function MapScreen() {
  return crearPantalla("mapa", "Mapa");
}

/** @returns {HTMLElement} */
export function WorkshopListScreen() {
  return crearPantalla("mapa", "Lista de talleres");
}

/** @returns {HTMLElement} */
export function WorkshopDetailScreen() {
  return crearPantalla("mapa", "Perfil del taller", true);
}

/**
 * Pantalla provisional de las fases 03 a 05.
 * @param {"inicio" | "mapa" | "pedidos" | "perfil"} activeNav
 * @param {string} titulo
 * @param {boolean} [hideNavOnMobile]
 */
function crearPantalla(activeNav, titulo, hideNavOnMobile = false) {
  const encabezado = document.createElement("h1");
  encabezado.textContent = titulo;
  return AppShell({ activeNav, hideNavOnMobile, children: encabezado });
}
