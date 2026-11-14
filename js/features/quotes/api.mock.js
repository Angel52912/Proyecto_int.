// Simulado en memoria de api.js de presupuestos (CU-04). Comparte estado con requests/simulacion.js.
// Misma forma de respuesta y de errores que el real.
import { ApiError } from "../../lib/apiError.js";
import { exigirUuid } from "../requests/validar.js";
import {
  UID_ARTESANO,
  UID_CLIENTE,
  agregarMensaje,
  estado,
  exigirClienteFuncion,
  exigirSesion,
  idSimulado,
  notificar,
  participa,
} from "../requests/simulacion.js";
import { validarDatosPresupuesto } from "./validar.js";

export { fijarSesionSimulada, fijarTallerSimulado, reiniciarSimulacion } from "../requests/simulacion.js";

/**
 * Cotización con la forma pública del contrato.
 * @param {import("../requests/simulacion.js").CotizacionSim} q
 */
function aPresupuesto(q) {
  return { ...q, detail: { ...q.detail } };
}

/** Artesano activo (igual que las funciones SQL: inactive_user antes que forbidden). */
function exigirArtesanoFuncion() {
  exigirSesion();
  if (!estado.activo) throw new ApiError("inactive_user");
  if (estado.rol !== "craftsman") throw new ApiError("forbidden");
}

/**
 * @param {string} requestId
 * @param {import("./validar.js").DatosPresupuesto} datos
 */
export async function sendQuote(requestId, datos) {
  exigirUuid(requestId);
  const valido = validarDatosPresupuesto(datos);
  exigirArtesanoFuncion();
  const solicitud = estado.solicitudes.find((s) => s.id === requestId);
  if (!solicitud || !participa(solicitud)) throw new ApiError("not_found");
  if (estado.taller.suspended) throw new ApiError("forbidden");
  if (solicitud.status !== "open" && solicitud.status !== "quoted") throw new ApiError("invalid_state");

  const ahora = new Date().toISOString();
  for (const q of estado.cotizaciones) {
    if (q.request_id === solicitud.id && q.status === "sent") {
      q.status = "superseded";
      q.responded_at = ahora;
    }
  }
  /** @type {import("../requests/simulacion.js").CotizacionSim} */
  const nueva = {
    id: idSimulado(),
    request_id: solicitud.id,
    amount_mxn: valido.amount_mxn,
    delivery_date: valido.delivery_date,
    detail: valido.detail,
    status: "sent",
    created_at: ahora,
    responded_at: null,
  };
  estado.cotizaciones.push(nueva);
  solicitud.status = "quoted";
  agregarMensaje({ request_id: solicitud.id, sender_id: UID_ARTESANO, body: "Presupuesto enviado", kind: "quote_card", quote_id: nueva.id });
  notificar(solicitud.client_id, "quote_received", { request_id: solicitud.id, quote_id: nueva.id });
  return aPresupuesto(nueva);
}

/**
 * @param {string} quoteId
 * @param {boolean} aceptar
 */
export async function respondQuote(quoteId, aceptar) {
  exigirUuid(quoteId);
  if (typeof aceptar !== "boolean") throw new ApiError("invalid_input");
  exigirClienteFuncion();
  const quote = estado.cotizaciones.find((q) => q.id === quoteId);
  if (!quote) throw new ApiError("not_found");
  const solicitud = estado.solicitudes.find((s) => s.id === quote.request_id && s.client_id === UID_CLIENTE);
  if (!solicitud) throw new ApiError("not_found");
  if (quote.status !== "sent" || solicitud.status !== "quoted") throw new ApiError("invalid_state");

  quote.responded_at = new Date().toISOString();
  if (!aceptar) {
    quote.status = "rejected";
    solicitud.status = "declined";
    agregarMensaje({ request_id: solicitud.id, sender_id: null, body: "Presupuesto rechazado por el cliente", kind: "system" });
    notificar(estado.taller.owner_id, "quote_rejected", { request_id: solicitud.id, quote_id: quote.id });
    return { quote_id: quote.id, status: /** @type {const} */ ("rejected"), order_id: null };
  }

  quote.status = "accepted";
  solicitud.status = "accepted";
  const ahora = new Date().toISOString();
  const orden = {
    id: idSimulado(),
    quote_id: quote.id,
    request_id: solicitud.id,
    client_id: solicitud.client_id,
    workshop_id: solicitud.workshop_id,
    phase: 1,
    status: /** @type {const} */ ("in_progress"),
    due_date: quote.delivery_date,
    ready_at: null,
    delivered_at: null,
    created_at: ahora,
    updated_at: ahora,
  };
  estado.ordenes.push(orden);
  agregarMensaje({ request_id: solicitud.id, sender_id: null, body: "Presupuesto aceptado. Orden de trabajo creada", kind: "system" });
  notificar(estado.taller.owner_id, "quote_accepted", { request_id: solicitud.id, quote_id: quote.id, order_id: orden.id });
  notificar(solicitud.client_id, "order_created", { request_id: solicitud.id, quote_id: quote.id, order_id: orden.id });
  return { quote_id: quote.id, status: /** @type {const} */ ("accepted"), order_id: orden.id };
}

/**
 * Cotización visible para el usuario simulado (participante de su solicitud).
 * @param {string} quoteId
 */
function cotizacionVisible(quoteId) {
  const q = estado.cotizaciones.find((x) => x.id === quoteId);
  const solicitud = q && estado.solicitudes.find((s) => s.id === q.request_id);
  return q && solicitud && participa(solicitud) ? q : undefined;
}

/** @param {string} quoteId */
export async function getQuote(quoteId) {
  exigirUuid(quoteId);
  exigirSesion();
  const q = cotizacionVisible(quoteId);
  if (!q) throw new ApiError("not_found");
  return aPresupuesto(q);
}

/** @param {string} requestId */
export async function listQuotes(requestId) {
  exigirUuid(requestId);
  exigirSesion();
  return estado.cotizaciones.filter((q) => q.request_id === requestId && cotizacionVisible(q.id)).map(aPresupuesto);
}
