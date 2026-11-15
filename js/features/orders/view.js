// Pantallas de pedidos: seguimiento, entrega y calificación (CU-05 y CU-06).

import { AppShell } from "../../components/shell.js";
import {
  Button,
  Card,
  Chip,
  ImagePlaceholder,
  PageHeader,
  ProgressBar,
} from "../../components/ui.js";
import { Icon } from "../../components/icon.js";
import { orderDetail } from "../../mocks/orders.js";
import { Pantalla } from "../../components/pantalla.js";

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

/** @returns {HTMLElement} */
export function PickupScreen() {
  return Pantalla({
    activeNav: "pedidos",
    hideNavOnMobile: true,
    titulo: "Recoger pedido",
  });
}

/** @returns {HTMLElement} */
export function RatingScreen() {
  return Pantalla({
    activeNav: "pedidos",
    hideNavOnMobile: true,
    titulo: "Calificación",
  });
}

/** @returns {HTMLElement} */
export function MyOrdersScreen() {
  return Pantalla({
    activeNav: "pedidos",
    titulo: "Mis pedidos",
  });
}
