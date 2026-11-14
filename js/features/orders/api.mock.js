// Simulado en memoria de api.js de órdenes (CU-04, solo lectura). Comparte estado con requests/simulacion.js.
import { ApiError } from "../../lib/apiError.js";
import { validarImagen } from "../../lib/validate.js";
import { exigirUuid } from "../requests/validar.js";
import { UID_ARTESANO, UID_CLIENTE, agregarMensaje, estado, exigirSesion, idSimulado, notificar } from "../requests/simulacion.js";

export { fijarSesionSimulada, reiniciarSimulacion } from "../requests/simulacion.js";

/**
 * ¿Participa el usuario simulado en la orden? Cliente de la orden o artesano dueño del taller (activos).
 * @param {import("../requests/simulacion.js").OrdenSim} orden
 */
function ordenVisible(orden) {
  if (!estado.activo) return false;
  if (estado.rol === "client") return orden.client_id === UID_CLIENTE;
  if (estado.rol === "craftsman") return orden.workshop_id === estado.taller.id;
  return false;
}

/** Artesano activo dueño de la orden (igual que las funciones SQL: inactive_user antes que forbidden). */
function exigirArtesanoDeOrden(/** @type {string} */ orderId) {
  exigirSesion();
  if (!estado.activo) throw new ApiError("inactive_user");
  if (estado.rol !== "craftsman") throw new ApiError("forbidden");
  const orden = estado.ordenes.find((o) => o.id === orderId);
  if (!orden || orden.workshop_id !== estado.taller.id) throw new ApiError("not_found");
  if (estado.taller.suspended) throw new ApiError("forbidden");
  return orden;
}

/**
 * Cambia la fase del pedido. Mismas reglas que `advance_phase`: una fase a la vez; un salto o retroceso exige
 * `confirm` y `note` (A1) y queda `corrected`; la foto de avance es obligatoria.
 * @param {string} orderId
 * @param {{ phase: number, photo: { type: string, size: number }, note?: string, confirm?: boolean }} datos
 */
export async function advanceOrderPhase(orderId, datos) {
  exigirUuid(orderId);
  if (!Number.isInteger(datos?.phase) || datos.phase < 1 || datos.phase > 4) throw new ApiError("invalid_input");
  if (datos.note !== undefined && (typeof datos.note !== "string" || datos.note.trim().length > 500)) throw new ApiError("invalid_input");
  if (datos.confirm !== undefined && typeof datos.confirm !== "boolean") throw new ApiError("invalid_input");
  if (!datos.photo) throw new ApiError("photo_required");
  if (!validarImagen(datos.photo).valido) throw new ApiError("invalid_input");
  const orden = exigirArtesanoDeOrden(orderId);
  if (orden.status !== "in_progress") throw new ApiError("invalid_state");
  if (datos.phase === orden.phase) throw new ApiError("invalid_input");
  const nota = datos.note?.trim() || null;
  const corregida = datos.phase !== orden.phase + 1;
  if (corregida && (datos.confirm !== true || nota === null)) throw new ApiError("confirmation_required");

  orden.phase = datos.phase;
  orden.updated_at = new Date().toISOString();
  /** @type {import("../requests/simulacion.js").AvanceSim} */
  const avance = {
    id: idSimulado(),
    order_id: orden.id,
    phase: datos.phase,
    photo_path: `${orden.id}/${idSimulado()}`,
    note: nota,
    corrected: corregida,
    created_by: UID_ARTESANO,
    created_at: new Date().toISOString(),
  };
  estado.avances.push(avance);
  notificar(orden.client_id, "order_phase_changed", { order_id: orden.id, request_id: orden.request_id, phase: datos.phase, corrected: corregida });
  for (const escucha of estado.escuchasAvances) escucha({ ...avance });
  return { order_id: orden.id, phase: orden.phase, status: orden.status, update: { ...avance } };
}

/** @param {string} orderId */
export async function markOrderReady(orderId) {
  exigirUuid(orderId);
  const orden = exigirArtesanoDeOrden(orderId);
  if (orden.status !== "in_progress" || orden.phase !== 4) throw new ApiError("invalid_state");
  orden.status = "ready";
  orden.ready_at = new Date().toISOString();
  orden.updated_at = orden.ready_at;
  agregarMensaje({ request_id: orden.request_id, sender_id: null, body: "Tu pedido está listo para entrega", kind: "system" });
  notificar(orden.client_id, "order_ready", { order_id: orden.id, request_id: orden.request_id });
  return { order_id: orden.id, status: orden.status, phase: orden.phase, ready_at: orden.ready_at };
}

/** @param {string} orderId */
export async function listOrderUpdates(orderId) {
  exigirUuid(orderId);
  exigirSesion();
  const orden = estado.ordenes.find((o) => o.id === orderId);
  if (!orden || !ordenVisible(orden)) return [];
  return estado.avances.filter((a) => a.order_id === orderId).map((a) => ({ ...a, url: `https://simulado.mixanab.test/progress-photos/${a.photo_path}` }));
}

/**
 * @param {string} orderId
 * @param {(avance: import("../requests/simulacion.js").AvanceSim) => void} alRecibir
 */
export async function subscribeToOrderUpdates(orderId, alRecibir) {
  exigirUuid(orderId);
  exigirSesion();
  const orden = estado.ordenes.find((o) => o.id === orderId);
  const permitido = orden !== undefined && ordenVisible(orden);
  /** @param {import("../requests/simulacion.js").AvanceSim} avance */
  const escucha = (avance) => {
    if (permitido && avance.order_id === orderId) alRecibir(avance);
  };
  estado.escuchasAvances.add(escucha);
  return () => {
    estado.escuchasAvances.delete(escucha);
  };
}

export async function listMyOrders() {
  exigirSesion();
  return estado.ordenes
    .filter(ordenVisible)
    .reverse()
    .map((o) => ({ ...o }));
}

/** @param {string} orderId */
export async function getOrder(orderId) {
  exigirUuid(orderId);
  exigirSesion();
  const orden = estado.ordenes.find((o) => o.id === orderId);
  if (!orden || !ordenVisible(orden)) throw new ApiError("not_found");
  return { ...orden };
}
