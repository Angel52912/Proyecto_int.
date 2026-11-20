// Tarjeta de presupuesto que aparece en el chat (mensajes `quote_card`, CU-04).
import { formatearFecha } from "../../lib/fechas.js";
import { formatearMxn } from "../../lib/money.js";
import { crear, enlace } from "../../ui/dom.js";
import { crearInsignia } from "../../ui/layout.js";
import { api } from "./index.js";

/** @type {Readonly<Record<string, { texto: string, tono: "miel" | "cenote" | "exito" | "cuero" | "error" | "neutra" }>>} */
export const ESTADO_PRESUPUESTO = Object.freeze({
  sent: { texto: "Presupuesto", tono: "cenote" },
  accepted: { texto: "Aceptado", tono: "exito" },
  rejected: { texto: "Rechazado", tono: "error" },
  superseded: { texto: "Reemplazado", tono: "neutra" },
});

/**
 * Crea la tarjeta y la llena al cargar el presupuesto.
 * @param {string} quoteId
 * @param {{ ruta: (presupuesto: any) => string | null, textoBoton?: string }} opciones `ruta` del botón (null = sin botón).
 * @returns {HTMLElement}
 */
export function crearTarjetaPresupuesto(quoteId, opciones) {
  const tarjeta = crear("div", { clase: "tarjeta-presupuesto" }, [crear("p", { clase: "texto-secundario", texto: "Cargando presupuesto…" })]);
  api
    .getQuote(quoteId)
    .then((presupuesto) => {
      const estado = ESTADO_PRESUPUESTO[presupuesto.status] ?? ESTADO_PRESUPUESTO.sent;
      const ruta = opciones.ruta(presupuesto);
      tarjeta.classList.toggle("tarjeta-presupuesto--inactiva", presupuesto.status === "superseded" || presupuesto.status === "rejected");
      tarjeta.replaceChildren(
        crearInsignia(estado.texto, estado.tono),
        crear("p", { clase: "tarjeta-presupuesto__monto", texto: `${formatearMxn(presupuesto.amount_mxn)} MXN` }),
        crear("p", { clase: "texto-secundario", texto: `Entrega: ${formatearFecha(presupuesto.delivery_date)}` }),
      );
      if (ruta) tarjeta.append(enlace(ruta, { clase: "boton boton--cenote boton--bloque boton--chico", texto: opciones.textoBoton ?? "Ver presupuesto" }));
    })
    .catch(() => {
      tarjeta.replaceChildren(crear("p", { clase: "texto-secundario", texto: "No pudimos cargar este presupuesto." }));
    });
  return tarjeta;
}
