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
  Rating,
  PageHeader,
  SearchInput,
  SectionHeader,
} from "../../components/ui.js";
import { Icon } from "../../components/icon.js";
import { currentOrder, currentUser } from "../../mocks/orders.js";
import { getWorkshopById, workshops } from "../../mocks/workshops.js";

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

const FILTROS_MAPA = ["Todos", "Reparación", "Limpieza", "Abierto"];

const PINES_MAPA = [
  { tallerId: "los-hermanos", x: 14, y: 24 },
  { tallerId: "la-ermita", x: 72, y: 15 },
  { tallerId: "don-chucho", x: 33, y: 40 },
  { tallerId: "santiago", x: 85, y: 49 },
  { tallerId: "don-chucho", x: 27, y: 60 },
];

/** @returns {HTMLElement} */
export function MapScreen() {
  const estado = { seleccionado: "don-chucho", filtro: "Todos" };
  const contenido = document.createElement("div");
  contenido.className = "mapa";
  const shell = AppShell({ activeNav: "mapa", fullBleed: true, children: contenido });

  /**
   * @param {object} taller
   * @param {{ seleccionada?: boolean, alPulsar: () => void }} opciones
   */
  function crearTarjeta(taller, { seleccionada = false, alPulsar }) {
    const tarjeta = Card({ onClick: alPulsar, padding: 12 });
    tarjeta.classList.add("mapa__tarjeta");
    if (seleccionada) tarjeta.classList.add("mapa__tarjeta--seleccionada");

    const fila = document.createElement("span");
    fila.className = "mapa__tarjeta-fila";

    const info = document.createElement("span");
    info.className = "mapa__tarjeta-info";

    const nombre = document.createElement("span");
    nombre.className = "mapa__tarjeta-nombre";
    nombre.textContent = taller.name;

    const meta = document.createElement("span");
    meta.className = "mapa__tarjeta-meta";
    if (typeof taller.rating_avg === "number") {
      meta.appendChild(Rating({ value: 5, size: 12 }));
    }
    const partes = [];
    if (typeof taller.rating_avg === "number") partes.push(taller.rating_avg.toFixed(1));
    if (typeof taller.distance_km === "number") partes.push(`${taller.distance_km} km`);
    if (partes.length > 0) {
      const texto = document.createElement("span");
      texto.textContent = partes.join(" · ");
      meta.appendChild(texto);
    }
    info.append(nombre, meta);

    if (taller.hours_label !== "") {
      info.appendChild(Chip({ variant: "status", tone: "green", children: taller.hours_label }));
    }

    const chevron = document.createElement("span");
    chevron.className = "mapa__tarjeta-chevron";
    chevron.appendChild(Icon({ name: "chevron-right", size: 18 }));

    fila.append(ImagePlaceholder({ alt: taller.name, width: 56, height: 56 }), info, chevron);
    tarjeta.appendChild(fila);
    return tarjeta;
  }

  function crearLienzo() {
    const lienzo = MapBackdrop();
    lienzo.classList.add("mapa__lienzo");
    for (const pin of PINES_MAPA) {
      const taller = getWorkshopById(pin.tallerId);
      lienzo.appendChild(
        MapPin({
          selected: estado.seleccionado === pin.tallerId,
          x: pin.x,
          y: pin.y,
          ariaLabel: taller?.name ?? "Taller",
          onClick: () => {
            estado.seleccionado = pin.tallerId;
            pintar();
          },
        })
      );
    }
    return lienzo;
  }

  /** @param {string} clase */
  function crearBuscador(clase) {
    const caja = document.createElement("div");
    caja.className = clase;
    const buscador = SearchInput({
      placeholder: "Buscar en Mérida",
      rightSlot: Icon({ name: "filter", size: 18, color: "var(--color-text-muted)" }),
    });
    buscador.classList.add("mapa__buscador");
    caja.appendChild(buscador);
    return caja;
  }

  /** @param {string} clase */
  function crearChips(clase) {
    const fila = document.createElement("div");
    fila.className = clase;
    for (const filtro of FILTROS_MAPA) {
      fila.appendChild(
        Chip({
          variant: "filter",
          active: estado.filtro === filtro,
          onClick: () => {
            estado.filtro = filtro;
            pintar();
          },
          children: filtro,
        })
      );
    }
    return fila;
  }

  function crearPanel() {
    const panel = document.createElement("aside");
    panel.className = "mapa__panel";
    panel.setAttribute("aria-label", "Talleres");

    const lista = document.createElement("div");
    lista.className = "mapa__lista";
    for (const taller of workshops) {
      lista.appendChild(
        crearTarjeta(taller, {
          seleccionada: estado.seleccionado === taller.id,
          alPulsar: () => {
            if (estado.seleccionado === taller.id) irA(`/taller/${taller.id}`);
            else {
              estado.seleccionado = taller.id;
              pintar();
            }
          },
        })
      );
    }

    panel.append(crearBuscador("mapa__buscador-caja"), crearChips("mapa__chips-panel"), lista);
    return panel;
  }

  function pintar() {
    const seleccionado = getWorkshopById(estado.seleccionado) ?? workshops[0];
    const tarjetaMovil = document.createElement("div");
    tarjetaMovil.className = "mapa__tarjeta-movil";
    tarjetaMovil.appendChild(
      crearTarjeta(seleccionado, {
        alPulsar: () => irA(`/taller/${seleccionado.id}`),
      })
    );

    contenido.replaceChildren(
      crearLienzo(),
      crearBuscador("mapa__buscador-movil"),
      crearChips("mapa__chips-movil"),
      tarjetaMovil,
      crearPanel()
    );
  }

  pintar();
  return shell;
}

const ORDENES_TALLERES = ["Más cercanos", "Mejor valorados", "Precio"];

/**
 * Lista de talleres filtrada por categoría (solo cambia el título).
 * @param {{ params?: Record<string, string> }} [contexto]
 * @returns {HTMLElement}
 */
export function WorkshopListScreen({ params } = {}) {
  const titulo = params?.categoria === "limpieza" ? "Limpieza" : "Reparación";
  const estado = { orden: "Más cercanos" };
  const contenido = document.createElement("div");
  const shell = AppShell({ activeNav: "mapa", children: contenido });

  function crearCabecera() {
    const boton = document.createElement("button");
    boton.type = "button";
    boton.className = "ui-boton ui-boton--icon talleres__filtros";
    boton.setAttribute("aria-label", "Filtros");
    boton.appendChild(Icon({ name: "filter", size: 18 }));
    return PageHeader({ title: titulo, rightSlot: boton });
  }

  function crearChips() {
    const fila = document.createElement("div");
    fila.className = "talleres__chips";
    for (const orden of ORDENES_TALLERES) {
      fila.appendChild(
        Chip({
          variant: "filter",
          active: estado.orden === orden,
          onClick: () => {
            estado.orden = orden;
            pintar();
          },
          children: orden,
        })
      );
    }
    return fila;
  }

  /** @param {object} taller */
  function crearTarjeta(taller) {
    const tarjeta = Card({ onClick: () => irA(`/taller/${taller.id}`) });
    tarjeta.classList.add("talleres__tarjeta");

    const fila = document.createElement("span");
    fila.className = "talleres__tarjeta-fila";

    const foto = ImagePlaceholder({ alt: taller.name });
    foto.classList.add("talleres__foto");

    const info = document.createElement("span");
    info.className = "talleres__info";

    const nombre = document.createElement("span");
    nombre.className = "talleres__nombre";
    nombre.textContent = taller.name;

    const tags = document.createElement("span");
    tags.className = "talleres__tags";
    tags.textContent = taller.tags.join(" · ");

    const meta = document.createElement("span");
    meta.className = "talleres__meta";
    meta.appendChild(Rating({ value: Math.round(taller.rating_avg ?? 0), size: 12 }));
    const distancia = document.createElement("span");
    distancia.className = "talleres__distancia";
    distancia.textContent = `${taller.distance_km} km`;
    meta.appendChild(distancia);

    info.append(nombre, tags, meta);

    const chevron = document.createElement("span");
    chevron.className = "talleres__chevron";
    chevron.appendChild(Icon({ name: "chevron-right", size: 18 }));

    fila.append(foto, info, chevron);
    tarjeta.appendChild(fila);
    return tarjeta;
  }

  function pintar() {
    const lista = [...workshops];
    if (estado.orden === "Más cercanos") {
      lista.sort((a, b) => a.distance_km - b.distance_km);
    } else if (estado.orden === "Mejor valorados") {
      lista.sort((a, b) => (b.rating_avg ?? 0) - (a.rating_avg ?? 0));
    }

    const contenedor = document.createElement("div");
    contenedor.className = "talleres__lista";
    for (const taller of lista) contenedor.appendChild(crearTarjeta(taller));

    contenido.replaceChildren(crearCabecera(), crearChips(), contenedor);
  }

  pintar();
  return shell;
}

/** @returns {HTMLElement} */
export function WorkshopDetailScreen() {
  return crearPantalla("mapa", "Perfil del taller", true);
}

/**
 * Pantalla provisional de la fase 05.
 * @param {"inicio" | "mapa" | "pedidos" | "perfil"} activeNav
 * @param {string} titulo
 * @param {boolean} [hideNavOnMobile]
 */
function crearPantalla(activeNav, titulo, hideNavOnMobile = false) {
  const encabezado = document.createElement("h1");
  encabezado.textContent = titulo;
  return AppShell({ activeNav, hideNavOnMobile, children: encabezado });
}
