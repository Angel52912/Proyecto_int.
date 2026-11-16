// Pantalla de presupuesto de una solicitud (CU-04).

import { AppShell } from "../../components/shell.js";
import {
  Button,
  Card,
  ImagePlaceholder,
  PageHeader,
  Rating,
  StickyActionBar,
} from "../../components/ui.js";
import { Icon } from "../../components/icon.js";
import { budget } from "../../mocks/budget.js";

/** @param {string} ruta */
function irA(ruta) {
  window.location.hash = `#${ruta}`;
}

/**
 * Presupuesto recibido del taller.
 * @param {{ params?: Record<string, string>, onAccept?: () => void, onReject?: () => void }} [contexto]
 * @returns {HTMLElement}
 */
export function BudgetScreen({ params, onAccept, onReject } = {}) {
  const pedidoId = params?.pedidoId ?? budget.request_id;

  const contenido = document.createElement("div");
  contenido.className = "presupuesto";
  const shell = AppShell({
    activeNav: "pedidos",
    hideNavOnMobile: true,
    children: contenido,
  });

  function crearTaller() {
    const fila = document.createElement("div");
    fila.className = "presupuesto__taller";

    const textos = document.createElement("div");
    textos.className = "presupuesto__taller-textos";

    const nombre = document.createElement("span");
    nombre.className = "presupuesto__taller-nombre";
    nombre.textContent = budget.workshopName;

    const rating = document.createElement("div");
    rating.className = "presupuesto__rating";

    const valor = document.createElement("span");
    valor.className = "presupuesto__rating-valor";
    valor.textContent = budget.rating.toFixed(1);

    rating.append(Rating({ value: 5, size: 11 }), valor);
    textos.append(nombre, rating);

    fila.append(ImagePlaceholder({ alt: budget.workshopName, width: 36, height: 36 }), textos);
    return fila;
  }

  function crearDivisor() {
    const divisor = document.createElement("div");
    divisor.className = "presupuesto__divisor";
    return divisor;
  }

  function crearDesglose() {
    const lista = document.createElement("ul");
    lista.className = "presupuesto__lineas";

    for (const linea of budget.lines) {
      const item = document.createElement("li");
      item.className = "presupuesto__linea";

      const etiqueta = document.createElement("span");
      etiqueta.textContent = linea.label;

      const importe = document.createElement("span");
      importe.className = "presupuesto__importe";
      importe.textContent = linea.amount;

      item.append(etiqueta, importe);
      lista.appendChild(item);
    }

    return lista;
  }

  function crearTarjeta() {
    const tarjeta = Card({ padding: 16 });
    tarjeta.classList.add("presupuesto__tarjeta");

    const titulo = document.createElement("h2");
    titulo.className = "presupuesto__titulo";
    titulo.textContent = budget.title;

    const descripcion = document.createElement("p");
    descripcion.className = "presupuesto__descripcion";
    descripcion.textContent = budget.description;

    const total = document.createElement("div");
    total.className = "presupuesto__total-fila";

    const etiquetaTotal = document.createElement("span");
    etiquetaTotal.className = "presupuesto__total-etiqueta";
    etiquetaTotal.textContent = "Total";

    const monto = document.createElement("span");
    monto.className = "presupuesto__total";
    monto.textContent = budget.total;

    total.append(etiquetaTotal, monto);
    tarjeta.append(
      crearTaller(),
      crearDivisor(),
      titulo,
      descripcion,
      crearDesglose(),
      crearDivisor(),
      total
    );
    return tarjeta;
  }

  function crearDato(icono, etiqueta, valor) {
    const tarjeta = Card({ padding: 12 });
    tarjeta.classList.add("presupuesto__dato");

    const textos = document.createElement("div");
    textos.className = "presupuesto__dato-textos";

    const titulo = document.createElement("span");
    titulo.className = "presupuesto__dato-etiqueta";
    titulo.textContent = etiqueta;

    const contenidoValor = document.createElement("span");
    contenidoValor.className = "presupuesto__dato-valor";
    contenidoValor.textContent = valor;

    textos.append(titulo, contenidoValor);
    tarjeta.append(Icon({ name: icono, size: 20, color: "var(--color-primary)" }), textos);
    return tarjeta;
  }

  function crearAviso() {
    const aviso = document.createElement("div");
    aviso.className = "presupuesto__aviso";

    const texto = document.createElement("span");
    texto.textContent = budget.notice;

    aviso.append(Icon({ name: "shield-check", size: 18, color: "var(--color-teal)" }), texto);
    return aviso;
  }

  function crearAcciones() {
    const barra = StickyActionBar({
      children: [
        Button({
          variant: "outline",
          onClick: () => {
            // TODO(BACKEND): responder el presupuesto con respondQuote(id, false).
            if (onReject !== undefined) onReject();
            irA(`/chat/${pedidoId}`);
          },
          children: "Rechazar",
        }),
        Button({
          variant: "primary",
          onClick: () => {
            // TODO(BACKEND): responder el presupuesto con respondQuote(id, true).
            if (onAccept !== undefined) onAccept();
            irA(`/pedido/${pedidoId}`);
          },
          children: "Aceptar",
        }),
      ],
    });
    barra.classList.add("presupuesto__acciones");
    return barra;
  }

  const datos = document.createElement("div");
  datos.className = "presupuesto__datos";
  datos.append(
    crearDato("calendar", "Entrega", budget.delivery),
    crearDato("clock", "Tiempo", budget.time)
  );

  contenido.append(
    PageHeader({ title: "Presupuesto" }),
    crearTarjeta(),
    datos,
    crearAviso(),
    crearAcciones()
  );
  return shell;
}
