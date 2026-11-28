// Tarjeta de presupuesto que aparece en el chat (mensajes `quote_card`, CU-04).
// Nuevo front: el cliente acepta o rechaza ahí mismo, sin cambiar de pantalla; "Ver detalle" abre el desglose.
import { formatearFecha } from "../../lib/fechas.js";
import { formatearMxn } from "../../lib/money.js";
import { crear, enlace, irSinRegreso } from "../../ui/dom.js";
import { icono } from "../../ui/iconos.js";
import { crearBoton, crearInsignia } from "../../ui/layout.js";
import { mensajeDeError } from "../../ui/mensajes.js";
import { api } from "./index.js";

/** @type {Readonly<Record<string, { texto: string, tono: "miel" | "cenote" | "exito" | "cuero" | "error" | "neutra" }>>} */
export const ESTADO_PRESUPUESTO = Object.freeze({
  sent: { texto: "Presupuesto", tono: "cenote" },
  accepted: { texto: "Aceptado", tono: "exito" },
  rejected: { texto: "Rechazado", tono: "error" },
  superseded: { texto: "Reemplazado", tono: "neutra" },
});

/**
 * Texto descriptivo del trabajo dentro de `detail` (campo libre del contrato).
 * @param {Record<string, unknown>} detalle
 * @returns {string}
 */
export function descripcionDelDetalle(detalle) {
  const texto = detalle.descripcion ?? detalle.description ?? detalle.detalle ?? detalle.nota;
  return typeof texto === "string" ? texto : "";
}

/**
 * Pide confirmación, responde el presupuesto y lleva al pedido (si se aceptó) o al chat.
 * @param {any} presupuesto
 * @param {boolean} aceptar
 * @returns {Promise<boolean>} false si la persona canceló la confirmación.
 */
export async function responderPresupuesto(presupuesto, aceptar) {
  const pregunta = aceptar
    ? `¿Aceptar el presupuesto de ${formatearMxn(presupuesto.amount_mxn)}? Pagas al recoger tu calzado.`
    : "¿Rechazar este presupuesto? El taller podrá enviarte otro.";
  if (!window.confirm(pregunta)) return false;
  const resultado = await api.respondQuote(presupuesto.id, aceptar);
  irSinRegreso(resultado.order_id ? `/pedido/${resultado.order_id}` : `/chat/${presupuesto.request_id}`);
  return true;
}

/**
 * Crea la tarjeta y la llena al cargar el presupuesto.
 * @param {string} quoteId
 * @param {{ ruta: (presupuesto: any) => string | null, textoBoton?: string, responder?: boolean }} opciones
 *   `ruta` del enlace (null = sin enlace). `responder`: el cliente ve Aceptar y Rechazar mientras esté vigente.
 * @returns {HTMLElement}
 */
export function crearTarjetaPresupuesto(quoteId, opciones) {
  const tarjeta = crear("div", { clase: "tarjeta-presupuesto" }, [crear("p", { clase: "texto-secundario", texto: "Cargando presupuesto…" })]);

  /** @param {any} presupuesto */
  function pintar(presupuesto) {
    const estado = ESTADO_PRESUPUESTO[presupuesto.status] ?? ESTADO_PRESUPUESTO.sent;
    const vigente = presupuesto.status === "sent";
    const ruta = opciones.ruta(presupuesto);
    const descripcion = descripcionDelDetalle(/** @type {Record<string, unknown>} */ (presupuesto.detail ?? {}));
    tarjeta.classList.toggle("tarjeta-presupuesto--vigente", vigente);
    tarjeta.classList.toggle("tarjeta-presupuesto--inactiva", presupuesto.status === "superseded" || presupuesto.status === "rejected");
    tarjeta.replaceChildren(
      vigente
        ? crear("p", { clase: "tarjeta-presupuesto__etiqueta" }, [icono("dinero", { tam: 16 }), crear("span", { texto: "Presupuesto" })])
        : crearInsignia(estado.texto, estado.tono),
      crear("p", { clase: "tarjeta-presupuesto__monto", texto: formatearMxn(presupuesto.amount_mxn) }),
      crear("p", { clase: "texto-secundario", texto: `Pagas al recoger · Listo el ${formatearFecha(presupuesto.delivery_date)}` }),
      descripcion ? crear("p", { clase: "tarjeta-presupuesto__detalle", texto: descripcion }) : null,
    );

    if (opciones.responder && vigente) {
      const aviso = crear("div", { attrs: { "aria-live": "assertive" } });
      const rechazar = crearBoton("Rechazar", { variante: "secundario", bloque: false });
      const aceptar = crearBoton("Aceptar", { bloque: false });
      /** @param {boolean} acepta */
      const responder = async (acepta) => {
        aviso.replaceChildren();
        rechazar.disabled = true;
        aceptar.disabled = true;
        try {
          const respondio = await responderPresupuesto(presupuesto, acepta);
          // Al rechazar se queda en este mismo chat: la tarjeta se vuelve a pintar con el estado nuevo.
          if (respondio && !acepta) cargar();
        } catch (error) {
          aviso.replaceChildren(crear("p", { clase: "aviso aviso--error", attrs: { role: "alert" }, texto: mensajeDeError(error, { invalid_state: "Este presupuesto ya no está vigente." }) }));
        } finally {
          rechazar.disabled = false;
          aceptar.disabled = false;
        }
      };
      rechazar.addEventListener("click", () => responder(false));
      aceptar.addEventListener("click", () => responder(true));
      tarjeta.append(aviso, crear("div", { clase: "tarjeta-presupuesto__acciones" }, [rechazar, aceptar]));
      if (ruta) tarjeta.append(enlace(ruta, { clase: "boton-texto tarjeta-presupuesto__detalle-enlace", texto: "Ver detalle" }));
      return;
    }
    if (ruta) tarjeta.append(enlace(ruta, { clase: "boton boton--secundario boton--bloque boton--chico", texto: opciones.textoBoton ?? "Ver presupuesto" }));
  }

  function cargar() {
    api
      .getQuote(quoteId)
      .then(pintar)
      .catch(() => {
        tarjeta.replaceChildren(crear("p", { clase: "texto-secundario", texto: "No pudimos cargar este presupuesto." }));
      });
  }

  cargar();
  return tarjeta;
}
