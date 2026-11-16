// Pantallas de pedidos: seguimiento, entrega y calificación (CU-05 y CU-06).

import { AppShell } from "../../components/shell.js";
import {
  Button,
  Card,
  Chip,
  ImagePlaceholder,
  PageHeader,
  ProgressBar,
  Rating,
  StickyActionBar,
  TextArea,
} from "../../components/ui.js";
import { Icon } from "../../components/icon.js";
import { activeOrders, finishedOrders, orderDetail } from "../../mocks/orders.js";
import { pickup } from "../../mocks/pickup.js";

/** @param {string} ruta */
function irA(ruta) {
  window.location.hash = `#${ruta}`;
}

function crearResumen() {
  const tarjeta = Card({ padding: 16 });
  tarjeta.classList.add("seguimiento__resumen");

  const fila = document.createElement("div");
  fila.className = "seguimiento__resumen-fila";

  const textos = document.createElement("div");
  textos.className = "seguimiento__resumen-textos";

  const item = document.createElement("span");
  item.className = "seguimiento__item";
  item.textContent = orderDetail.item;

  const taller = document.createElement("span");
  taller.className = "seguimiento__taller";
  taller.textContent = orderDetail.workshopName;

  textos.append(item, taller);
  fila.append(
    ImagePlaceholder({ alt: orderDetail.item, width: 48, height: 48 }),
    textos,
    Chip({ variant: "status", tone: "amber", children: orderDetail.statusLabel })
  );

  const fase = document.createElement("div");
  fase.className = "seguimiento__fase";

  const etiquetaFase = document.createElement("span");
  etiquetaFase.className = "seguimiento__fase-etiqueta";
  etiquetaFase.textContent = `Fase ${orderDetail.phase} de ${orderDetail.totalPhases}`;

  const porcentaje = document.createElement("span");
  porcentaje.className = "seguimiento__porcentaje";
  porcentaje.textContent = `${orderDetail.progress}%`;

  fase.append(etiquetaFase, porcentaje);

  const progreso = ProgressBar({ value: orderDetail.progress });
  progreso.classList.add("seguimiento__progreso");

  tarjeta.append(fila, fase, progreso);
  return tarjeta;
}

function crearPaso(paso) {
  const elemento = document.createElement("li");
  elemento.className = "seguimiento__paso";

  const indicador = document.createElement("div");
  indicador.className = "seguimiento__indicador";

  const circulo = document.createElement("span");
  circulo.className = `seguimiento__circulo seguimiento__circulo--${paso.state}`;
  if (paso.state === "done") {
    circulo.appendChild(Icon({ name: "check", size: 12, color: "var(--color-on-primary)" }));
  }

  const linea = document.createElement("span");
  linea.className =
    "seguimiento__linea" + (paso.state === "done" ? " seguimiento__linea--done" : "");

  const textos = document.createElement("div");
  textos.className = "seguimiento__paso-textos";

  const titulo = document.createElement("span");
  titulo.className = "seguimiento__paso-titulo";
  titulo.textContent = paso.title;

  const meta = document.createElement("span");
  meta.className = "seguimiento__paso-meta";
  meta.textContent = paso.meta;

  textos.append(titulo, meta);
  indicador.append(circulo, linea);
  elemento.append(indicador, textos);
  return elemento;
}

function crearLineaTiempo() {
  const tarjeta = Card({ padding: 16 });
  tarjeta.classList.add("seguimiento__linea-tiempo");

  const lista = document.createElement("ol");
  lista.className = "seguimiento__pasos";
  for (const paso of orderDetail.steps) lista.appendChild(crearPaso(paso));

  tarjeta.appendChild(lista);
  return tarjeta;
}

function crearFotos() {
  const seccion = document.createElement("section");
  seccion.className = "seguimiento__fotos";

  const cabecera = document.createElement("div");
  cabecera.className = "seguimiento__fotos-cabecera";

  const titulo = document.createElement("h2");
  titulo.className = "seguimiento__fotos-titulo";
  titulo.textContent = "Fotos de avance";

  const cuenta = document.createElement("span");
  cuenta.className = "seguimiento__fotos-cuenta";
  cuenta.textContent = `${orderDetail.progressPhotos} fotos`;

  cabecera.append(titulo, cuenta);

  const grid = document.createElement("div");
  grid.className = "seguimiento__galeria";
  for (let numero = 1; numero <= orderDetail.progressPhotos; numero += 1) {
    const foto = ImagePlaceholder({ alt: `Foto de avance ${numero}` });
    foto.classList.add("seguimiento__foto");
    grid.appendChild(foto);
  }

  seccion.append(cabecera, grid);
  return seccion;
}

function crearBotonChat() {
  const boton = Button({
    variant: "outline",
    fullWidth: true,
    leftIcon: "message",
    onClick: () => irA(`/chat/${orderDetail.id}`),
    children: "Escribir al taller",
  });
  boton.classList.add("seguimiento__chat");
  return boton;
}

/** @returns {HTMLElement} */
export function OrderTrackingScreen() {
  const contenido = document.createElement("div");
  contenido.className = "seguimiento";

  const izquierda = document.createElement("div");
  izquierda.className = "seguimiento__izquierda";
  izquierda.append(crearResumen(), crearBotonChat());

  const derecha = document.createElement("div");
  derecha.className = "seguimiento__derecha";
  derecha.append(crearLineaTiempo(), crearFotos());

  const grid = document.createElement("div");
  grid.className = "seguimiento__grid";
  grid.append(izquierda, derecha);

  contenido.append(PageHeader({ title: `Pedido #${orderDetail.id}` }), grid);

  return AppShell({ activeNav: "pedidos", children: contenido });
}

/**
 * Hash simple determinista para generar el patrón del QR de muestra.
 * @param {string} texto
 * @returns {number}
 */
function hashQr(texto) {
  let hash = 2166136261;
  for (let i = 0; i < texto.length; i += 1) {
    hash ^= texto.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/**
 * Placeholder de QR determinista a partir de un valor.
 * // TODO(BACKEND): reemplazar por generación/lectura de QR real escaneable.
 * @param {{ value: string, size?: number }} props
 * @returns {SVGSVGElement}
 */
function QrPlaceholder({ value, size = 168 }) {
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", "0 0 21 21");
  svg.setAttribute("width", String(size));
  svg.setAttribute("height", String(size));
  svg.setAttribute("shape-rendering", "crispEdges");
  svg.setAttribute("aria-label", "Código QR del pedido");
  svg.setAttribute("role", "img");

  const fondo = document.createElementNS(ns, "rect");
  fondo.setAttribute("width", "21");
  fondo.setAttribute("height", "21");
  fondo.setAttribute("fill", "#FFFFFF");
  svg.appendChild(fondo);

  /** @param {number} fila @param {number} col */
  const enBuscador = (fila, col) => {
    if (fila < 7 && col < 7) return true;
    if (fila < 7 && col > 13) return true;
    if (fila > 13 && col < 7) return true;
    return false;
  };

  /** @param {number} ox @param {number} oy */
  const dibujarBuscador = (ox, oy) => {
    const exterior = document.createElementNS(ns, "rect");
    exterior.setAttribute("x", String(ox));
    exterior.setAttribute("y", String(oy));
    exterior.setAttribute("width", "7");
    exterior.setAttribute("height", "7");
    exterior.setAttribute("fill", "#2B1D14");
    svg.appendChild(exterior);

    const medio = document.createElementNS(ns, "rect");
    medio.setAttribute("x", String(ox + 1));
    medio.setAttribute("y", String(oy + 1));
    medio.setAttribute("width", "5");
    medio.setAttribute("height", "5");
    medio.setAttribute("fill", "#FFFFFF");
    svg.appendChild(medio);

    const interior = document.createElementNS(ns, "rect");
    interior.setAttribute("x", String(ox + 2));
    interior.setAttribute("y", String(oy + 2));
    interior.setAttribute("width", "3");
    interior.setAttribute("height", "3");
    interior.setAttribute("fill", "#2B1D14");
    svg.appendChild(interior);
  };

  dibujarBuscador(0, 0);
  dibujarBuscador(14, 0);
  dibujarBuscador(0, 14);

  let semilla = hashQr(value);
  for (let fila = 0; fila < 21; fila += 1) {
    for (let col = 0; col < 21; col += 1) {
      if (enBuscador(fila, col)) continue;
      semilla = (Math.imul(semilla, 1103515245) + 12345) >>> 0;
      if ((semilla >>> 16) % 2 === 0) {
        const modulo = document.createElementNS(ns, "rect");
        modulo.setAttribute("x", String(col));
        modulo.setAttribute("y", String(fila));
        modulo.setAttribute("width", "1");
        modulo.setAttribute("height", "1");
        modulo.setAttribute("fill", "#2B1D14");
        svg.appendChild(modulo);
      }
    }
  }

  return svg;
}

/** @returns {HTMLElement} */
export function PickupScreen() {
  const contenido = document.createElement("div");
  contenido.className = "recoger";

  const cabecera = PageHeader({ title: "Recoger pedido" });

  const listo = document.createElement("div");
  listo.className = "recoger__listo";
  listo.appendChild(Chip({ variant: "status", tone: "green", children: pickup.readyLabel }));

  const titulo = document.createElement("h2");
  titulo.className = "recoger__titulo";
  titulo.textContent = "Muestra este código en el taller";

  const tarjetaQr = Card({ padding: 16 });
  tarjetaQr.classList.add("recoger__qr-tarjeta");
  tarjetaQr.appendChild(QrPlaceholder({ value: pickup.qrValue, size: 168 }));

  const textoPin = document.createElement("p");
  textoPin.className = "recoger__texto-pin";
  textoPin.textContent = "o dicta el PIN de entrega";

  const pin = document.createElement("div");
  pin.className = "recoger__pin";
  pin.setAttribute("aria-label", `PIN de entrega ${pickup.pin.join(" ")}`);
  for (const digito of pickup.pin) {
    const caja = document.createElement("span");
    caja.className = "recoger__digito";
    caja.textContent = digito;
    pin.appendChild(caja);
  }

  const tarjetaTaller = Card({ padding: 12 });
  tarjetaTaller.classList.add("recoger__taller");

  const iconoPin = document.createElement("span");
  iconoPin.className = "recoger__taller-icono";
  iconoPin.appendChild(Icon({ name: "map-pin", size: 18 }));

  const textosTaller = document.createElement("div");
  textosTaller.className = "recoger__taller-textos";

  const nombreTaller = document.createElement("span");
  nombreTaller.className = "recoger__taller-nombre";
  nombreTaller.textContent = pickup.workshopName;

  const direccion = document.createElement("span");
  direccion.className = "recoger__taller-direccion";
  direccion.textContent = pickup.addressLine;

  textosTaller.append(nombreTaller, direccion);
  tarjetaTaller.append(iconoPin, textosTaller);

  const mapaUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(pickup.mapsQuery)}`;
  const barra = StickyActionBar({
    children: Button({
      variant: "teal",
      fullWidth: true,
      leftIcon: "navigation",
      href: mapaUrl,
      children: "Cómo llegar",
    }),
  });
  const enlaceMapa = barra.querySelector("a");
  if (enlaceMapa) {
    enlaceMapa.target = "_blank";
    enlaceMapa.rel = "noopener noreferrer";
  }

  const columna = document.createElement("div");
  columna.className = "recoger__columna";
  columna.append(cabecera, listo, titulo, tarjetaQr, textoPin, pin, tarjetaTaller, barra);
  contenido.appendChild(columna);

  return AppShell({ activeNav: "pedidos", hideNavOnMobile: true, children: contenido });
}

/**
 * @param {{ stars: number, tags: string[], review: string }} datos
 */
function onSubmitRating(datos) {
  void datos;
  // TODO(BACKEND): guardar la calificación (stars, tags, review) del pedido.
  irA("/pedidos");
}

/** @returns {HTMLElement} */
export function RatingScreen() {
  let stars = 4;
  /** @type {string[]} */
  let tags = ["Puntual", "Buen acabado"];
  let review = "";

  const contenido = document.createElement("div");
  contenido.className = "calificar";

  const tarjeta = document.createElement("div");
  tarjeta.className = "calificar__tarjeta";

  const cabecera = document.createElement("div");
  cabecera.className = "calificar__cabecera";

  const tituloCabecera = document.createElement("h1");
  tituloCabecera.className = "calificar__titulo-cabecera";
  tituloCabecera.textContent = "Califica tu experiencia";

  const cerrar = Button({
    variant: "icon",
    ariaLabel: "Cerrar",
    leftIcon: "x",
    onClick: () => irA("/pedidos"),
  });
  cerrar.classList.add("calificar__cerrar");

  cabecera.append(tituloCabecera, cerrar);

  const exito = document.createElement("div");
  exito.className = "calificar__exito";
  exito.appendChild(Icon({ name: "check", size: 40 }));

  const titulo = document.createElement("h2");
  titulo.className = "calificar__titulo";
  titulo.textContent = "Entrega confirmada";

  const subtitulo = document.createElement("p");
  subtitulo.className = "calificar__subtitulo";
  subtitulo.textContent = "¿Cómo te fue con Talabartería Don Chucho?";

  /** @type {Record<number, string>} */
  const etiquetas = {
    1: "Muy mal",
    2: "Mal",
    3: "Regular",
    4: "Muy bien",
    5: "Excelente",
  };

  const etiquetaEstrellas = document.createElement("p");
  etiquetaEstrellas.className = "calificar__etiqueta-estrellas";

  const contenedorEstrellas = document.createElement("div");
  contenedorEstrellas.className = "calificar__estrellas";

  const renderEstrellas = () => {
    etiquetaEstrellas.textContent = etiquetas[stars] || "";
    contenedorEstrellas.replaceChildren(
      Rating({
        value: stars,
        size: 36,
        interactive: true,
        onChange: (valor) => {
          stars = valor;
          renderEstrellas();
        },
      })
    );
  };
  renderEstrellas();

  const etiquetasFila = document.createElement("div");
  etiquetasFila.className = "calificar__etiquetas";
  const opciones = ["Puntual", "Buen acabado", "Buen trato", "Buen precio"];

  const renderEtiquetas = () => {
    etiquetasFila.replaceChildren();
    for (const opcion of opciones) {
      const activa = tags.includes(opcion);
      const chip = Chip({
        variant: "filter",
        active: activa,
        children: opcion,
        onClick: () => {
          if (tags.includes(opcion)) tags = tags.filter((t) => t !== opcion);
          else tags = [...tags, opcion];
          renderEtiquetas();
        },
      });
      etiquetasFila.appendChild(chip);
    }
  };
  renderEtiquetas();

  const area = TextArea({
    placeholder: "Escribe una reseña (opcional)",
    value: review,
    rows: 4,
    onChange: (valor) => {
      review = valor;
    },
  });
  area.classList.add("calificar__resena");

  const barra = StickyActionBar({
    children: Button({
      variant: "primary",
      fullWidth: true,
      children: "Enviar calificación",
      onClick: () => onSubmitRating({ stars, tags, review }),
    }),
  });

  tarjeta.append(
    cabecera,
    exito,
    titulo,
    subtitulo,
    contenedorEstrellas,
    etiquetaEstrellas,
    etiquetasFila,
    area,
    barra
  );
  contenido.appendChild(tarjeta);

  return AppShell({ activeNav: "pedidos", hideNavOnMobile: true, children: contenido });
}

/**
 * @param {{id: string, item: string, workshopName: string, chipLabel: string, chipTone: "amber" | "teal" | "green", progress: number}} pedido
 * @returns {HTMLElement}
 */
function crearTarjetaActiva(pedido) {
  const tarjeta = Card({
    padding: 12,
    onClick: () => irA(`/pedido/${pedido.id}`),
  });
  tarjeta.classList.add("pedidos__tarjeta");

  const fila = document.createElement("div");
  fila.className = "pedidos__tarjeta-fila";

  const foto = ImagePlaceholder({ alt: pedido.item, width: 56, height: 56 });
  foto.classList.add("pedidos__foto");

  const cuerpo = document.createElement("div");
  cuerpo.className = "pedidos__cuerpo";

  const superior = document.createElement("div");
  superior.className = "pedidos__superior";

  const item = document.createElement("span");
  item.className = "pedidos__item";
  item.textContent = pedido.item;

  const chip = Chip({ variant: "status", tone: pedido.chipTone, children: pedido.chipLabel });
  superior.append(item, chip);

  const taller = document.createElement("span");
  taller.className = "pedidos__taller";
  taller.textContent = pedido.workshopName;

  const progreso = ProgressBar({ value: pedido.progress });

  cuerpo.append(superior, taller, progreso);
  fila.append(foto, cuerpo);
  tarjeta.appendChild(fila);
  return tarjeta;
}

/**
 * @param {{id: string, item: string, workshopName: string, date: string, chipLabel: string, chipTone: "green", stars: number}} pedido
 * @returns {HTMLElement}
 */
function crearTarjetaTerminada(pedido) {
  const tarjeta = Card({
    padding: 12,
    onClick: () => irA(`/pedido/${pedido.id}`),
  });
  tarjeta.classList.add("pedidos__tarjeta");

  const fila = document.createElement("div");
  fila.className = "pedidos__tarjeta-fila";

  const foto = ImagePlaceholder({ alt: pedido.item, width: 56, height: 56 });
  foto.classList.add("pedidos__foto");

  const cuerpo = document.createElement("div");
  cuerpo.className = "pedidos__cuerpo";

  const superior = document.createElement("div");
  superior.className = "pedidos__superior";

  const item = document.createElement("span");
  item.className = "pedidos__item";
  item.textContent = pedido.item;

  const chip = Chip({ variant: "status", tone: pedido.chipTone, children: pedido.chipLabel });
  superior.append(item, chip);

  const meta = document.createElement("span");
  meta.className = "pedidos__meta";
  meta.textContent = `${pedido.workshopName} · ${pedido.date}`;

  const rating = document.createElement("div");
  rating.className = "pedidos__rating";
  rating.appendChild(Rating({ value: pedido.stars, size: 12 }));

  cuerpo.append(superior, meta, rating);
  fila.append(foto, cuerpo);
  tarjeta.appendChild(fila);
  return tarjeta;
}

/** @returns {HTMLElement} */
export function MyOrdersScreen() {
  /** @type {"activos" | "historial"} */
  let tab = "activos";

  const contenido = document.createElement("div");
  contenido.className = "pedidos";

  const titulo = document.createElement("h1");
  titulo.className = "pedidos__titulo";
  titulo.textContent = "Mis pedidos";

  const tabs = document.createElement("div");
  tabs.className = "pedidos__tabs";
  tabs.setAttribute("role", "tablist");

  const botonActivos = document.createElement("button");
  botonActivos.type = "button";
  botonActivos.className = "pedidos__tab";
  botonActivos.setAttribute("role", "tab");
  botonActivos.id = "tab-activos";
  botonActivos.setAttribute("aria-controls", "panel-pedidos");

  const botonHistorial = document.createElement("button");
  botonHistorial.type = "button";
  botonHistorial.className = "pedidos__tab";
  botonHistorial.setAttribute("role", "tab");
  botonHistorial.textContent = "Historial";
  botonHistorial.id = "tab-historial";
  botonHistorial.setAttribute("aria-controls", "panel-pedidos");

  tabs.append(botonActivos, botonHistorial);

  const panel = document.createElement("div");
  panel.className = "pedidos__panel";
  panel.id = "panel-pedidos";
  panel.setAttribute("role", "tabpanel");

  const render = () => {
    botonActivos.textContent = `Activos (${activeOrders.length})`;
    const esActivos = tab === "activos";

    botonActivos.classList.toggle("pedidos__tab--activa", esActivos);
    botonHistorial.classList.toggle("pedidos__tab--activa", !esActivos);
    botonActivos.setAttribute("aria-selected", esActivos ? "true" : "false");
    botonHistorial.setAttribute("aria-selected", esActivos ? "false" : "true");
    panel.setAttribute("aria-labelledby", esActivos ? "tab-activos" : "tab-historial");

    panel.replaceChildren();

    if (esActivos) {
      const listaActivos = document.createElement("div");
      listaActivos.className = "pedidos__lista pedidos__lista--activos";
      for (const pedido of activeOrders) listaActivos.appendChild(crearTarjetaActiva(pedido));
      panel.appendChild(listaActivos);
    }

    const etiquetaTerminados = document.createElement("p");
    etiquetaTerminados.className = "pedidos__terminados-etiqueta";
    etiquetaTerminados.textContent = "Terminados";

    const listaTerminados = document.createElement("div");
    listaTerminados.className = "pedidos__lista pedidos__lista--terminados";
    for (const pedido of finishedOrders) listaTerminados.appendChild(crearTarjetaTerminada(pedido));

    panel.append(etiquetaTerminados, listaTerminados);
  };

  botonActivos.addEventListener("click", () => {
    tab = "activos";
    render();
  });
  botonHistorial.addEventListener("click", () => {
    tab = "historial";
    render();
  });

  render();
  contenido.append(titulo, tabs, panel);

  return AppShell({ activeNav: "pedidos", children: contenido });
}
