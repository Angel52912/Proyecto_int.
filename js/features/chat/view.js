// Pantalla de chat de una solicitud (CU-03).

import { AppShell } from "../../components/shell.js";
import {
  Avatar,
  Button,
  Card,
  Chip,
  ImagePlaceholder,
} from "../../components/ui.js";
import { Icon } from "../../components/icon.js";
import { chatContext, chatHeader, chatMessages } from "../../mocks/chat.js";

/** @returns {string} Hora local en formato HH:MM. */
function horaActual() {
  const ahora = new Date();
  return `${String(ahora.getHours()).padStart(2, "0")}:${String(ahora.getMinutes()).padStart(2, "0")}`;
}

/**
 * Chat con el taller sobre una solicitud.
 * @param {{ params?: Record<string, string> }} [contexto]
 * @returns {HTMLElement}
 */
export function ChatScreen({ params } = {}) {
  const pedidoId = params?.pedidoId ?? chatContext.requestId;
  /** @type {Array<Record<string, string | number>>} */
  const mensajes = [...chatMessages];

  const contenido = document.createElement("div");
  contenido.className = "chat";
  const shell = AppShell({
    activeNav: "pedidos",
    hideNavOnMobile: true,
    flush: true,
    children: contenido,
  });

  const area = document.createElement("div");
  area.className = "chat__mensajes";
  area.setAttribute("role", "log");
  area.setAttribute("aria-live", "polite");

  function crearCabecera() {
    const cabecera = document.createElement("header");
    cabecera.className = "chat__cabecera";

    const atras = Button({
      variant: "icon",
      leftIcon: "chevron-left",
      ariaLabel: "Volver",
      onClick: () => window.history.back(),
    });
    atras.classList.add("chat__atras");

    const textos = document.createElement("div");
    textos.className = "chat__contacto";

    const nombre = document.createElement("span");
    nombre.className = "chat__nombre";
    nombre.textContent = chatHeader.name;

    const estado = document.createElement("span");
    estado.className = "chat__estado";
    estado.textContent = chatHeader.status;

    textos.append(nombre, estado);
    cabecera.append(atras, Avatar({ initials: chatHeader.initials, size: 36 }), textos);
    return cabecera;
  }

  function crearContexto() {
    const tarjeta = Card({ tone: "amber-soft", padding: 10 });
    tarjeta.classList.add("chat__contexto");

    const textos = document.createElement("div");
    textos.className = "chat__contexto-textos";

    const solicitud = document.createElement("span");
    solicitud.className = "chat__contexto-solicitud";
    solicitud.textContent = `Solicitud #${chatContext.requestId}`;

    const detalle = document.createElement("span");
    detalle.className = "chat__contexto-detalle";
    detalle.textContent = `${chatContext.item} · ${chatContext.service}`;

    textos.append(solicitud, detalle);
    tarjeta.append(
      ImagePlaceholder({ alt: chatContext.item, width: 32, height: 32 }),
      textos
    );
    return tarjeta;
  }

  /** @param {Record<string, string | number>} mensaje */
  function crearMensaje(mensaje) {
    const deMi = mensaje.from === "me";
    const fila = document.createElement("div");
    fila.className = "chat__mensaje " + (deMi ? "chat__mensaje--me" : "chat__mensaje--them");

    if (mensaje.type === "text") {
      const burbuja = document.createElement("div");
      burbuja.className = "chat__burbuja";
      burbuja.textContent = String(mensaje.text);

      const hora = document.createElement("span");
      hora.className = "chat__hora";
      hora.textContent = String(mensaje.time);

      fila.append(burbuja, hora);
      return fila;
    }

    if (mensaje.type === "image") {
      const imagen = ImagePlaceholder({ alt: "Foto del calzado", width: 110, height: 80 });
      imagen.classList.add("chat__imagen");
      fila.appendChild(imagen);
      return fila;
    }

    const presupuesto = Card({ padding: 12 });
    presupuesto.classList.add("chat__presupuesto");
    presupuesto.append(
      Chip({ variant: "status", tone: "teal", children: "Presupuesto" })
    );

    const monto = document.createElement("span");
    monto.className = "chat__monto";
    monto.textContent = String(mensaje.amount);

    const entrega = document.createElement("span");
    entrega.className = "chat__entrega";
    entrega.textContent = String(mensaje.delivery);

    const ver = Button({
      variant: "teal",
      fullWidth: true,
      href: `/pedido/${pedidoId}/presupuesto`,
      children: "Ver presupuesto",
    });
    ver.classList.add("chat__ver-presupuesto");

    presupuesto.append(monto, entrega, ver);
    fila.appendChild(presupuesto);
    return fila;
  }

  function irAlFinal() {
    requestAnimationFrame(() => {
      area.scrollTop = area.scrollHeight;
    });
  }

  function pintarMensajes() {
    area.replaceChildren(crearContexto(), ...mensajes.map(crearMensaje));
    irAlFinal();
  }

  function crearEscritura() {
    const formulario = document.createElement("form");
    formulario.className = "chat__escribir";

    const entrada = document.createElement("input");
    entrada.type = "file";
    entrada.accept = "image/*";
    entrada.hidden = true;

    const adjuntar = document.createElement("button");
    adjuntar.type = "button";
    adjuntar.className = "chat__adjuntar";
    adjuntar.setAttribute("aria-label", "Adjuntar foto");
    adjuntar.appendChild(Icon({ name: "camera", size: 22 }));
    adjuntar.addEventListener("click", () => entrada.click());

    const campo = document.createElement("input");
    campo.type = "text";
    campo.className = "chat__campo";
    campo.placeholder = "Escribe un mensaje";
    campo.setAttribute("aria-label", "Escribe un mensaje");

    const enviar = document.createElement("button");
    enviar.type = "submit";
    enviar.className = "chat__enviar";
    enviar.setAttribute("aria-label", "Enviar");
    enviar.appendChild(Icon({ name: "send", size: 18 }));

    formulario.addEventListener("submit", (evento) => {
      evento.preventDefault();
      const texto = campo.value.trim();
      if (texto === "") return;
      mensajes.push({
        id: Date.now(),
        from: "me",
        type: "text",
        text: texto,
        time: horaActual(),
      });
      // TODO(BACKEND): enviar el mensaje real con sendMessage.
      campo.value = "";
      pintarMensajes();
      campo.focus();
    });

    formulario.append(adjuntar, campo, enviar, entrada);
    return formulario;
  }

  contenido.append(crearCabecera(), area, crearEscritura());
  pintarMensajes();
  return shell;
}
