// Simulado en memoria de api.js de órdenes (CU-04, solo lectura). Comparte estado con requests/simulacion.js.
import { ApiError } from "../../lib/apiError.js";
import { validarImagen } from "../../lib/validate.js";
import { exigirUuid } from "../requests/validar.js";
import { UID_ARTESANO, UID_CLIENTE, agregarMensaje, estado, exigirClienteFuncion, exigirSesion, idSimulado, notificar } from "../requests/simulacion.js";
import { INTENTOS_PIN, MINUTOS_BLOQUEO_PIN, extraerPin, validarResena } from "./validar.js";

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

/**
 * El cliente genera el PIN de entrega (solo con el pedido `ready`). Cada llamada rota el PIN y reinicia los intentos,
 * pero no levanta un bloqueo vigente.
 * @param {string} orderId
 */
export async function revealDeliveryPin(orderId) {
  exigirUuid(orderId);
  exigirClienteFuncion();
  const orden = estado.ordenes.find((o) => o.id === orderId && o.client_id === UID_CLIENTE);
  if (!orden) throw new ApiError("not_found");
  if (orden.status !== "ready") throw new ApiError("invalid_state");
  const azar = new Uint32Array(1);
  globalThis.crypto.getRandomValues(azar);
  const pin = String(azar[0] % 1_000_000).padStart(6, "0");
  const previo = estado.pins.get(orden.id);
  estado.pins.set(orden.id, { pin, attempts: 0, lockedUntil: previo?.lockedUntil ?? null });
  return { order_id: orden.id, pin };
}

/**
 * El artesano confirma la entrega. Un PIN incorrecto no lanza: devuelve `{ ok: false, attempts_left, locked_until }`.
 * @param {string} orderId
 * @param {string} codigo `123456` o `order_id:123456`
 */
export async function verifyDeliveryPin(orderId, codigo) {
  exigirUuid(orderId);
  const pin = extraerPin(orderId, codigo);
  const orden = exigirArtesanoDeOrden(orderId);
  if (orden.status !== "ready") throw new ApiError("invalid_state");
  const registro = estado.pins.get(orden.id);
  if (!registro) throw new ApiError("invalid_state"); // el cliente aún no muestra el PIN

  const ahora = Date.now();
  if (registro.lockedUntil !== null && registro.lockedUntil > ahora) {
    return { ok: false, attempts_left: 0, locked_until: new Date(registro.lockedUntil).toISOString(), status: orden.status };
  }
  if (registro.pin === pin) {
    estado.pins.delete(orden.id);
    orden.status = "delivered";
    orden.delivered_at = new Date(ahora).toISOString();
    orden.updated_at = orden.delivered_at;
    agregarMensaje({ request_id: orden.request_id, sender_id: null, body: "Pedido entregado y resuelto", kind: "system" });
    notificar(orden.client_id, "order_delivered", { order_id: orden.id, request_id: orden.request_id, review_pending: true });
    return { ok: true, attempts_left: INTENTOS_PIN, locked_until: null, status: orden.status };
  }
  registro.attempts += 1;
  if (registro.attempts >= INTENTOS_PIN) {
    registro.attempts = 0;
    registro.lockedUntil = ahora + MINUTOS_BLOQUEO_PIN * 60_000;
    return { ok: false, attempts_left: 0, locked_until: new Date(registro.lockedUntil).toISOString(), status: orden.status };
  }
  registro.lockedUntil = null;
  return { ok: false, attempts_left: INTENTOS_PIN - registro.attempts, locked_until: null, status: orden.status };
}

/**
 * El cliente califica al artesano. Una reseña por pedido entregado; sin edición.
 * @param {string} orderId
 * @param {import("./validar.js").DatosResena} datos
 */
export async function createReview(orderId, datos) {
  exigirUuid(orderId);
  const valida = validarResena(datos);
  exigirClienteFuncion();
  const orden = estado.ordenes.find((o) => o.id === orderId && o.client_id === UID_CLIENTE);
  if (!orden) throw new ApiError("not_found");
  if (orden.status !== "delivered") throw new ApiError("invalid_state");
  if (estado.resenas.some((r) => r.order_id === orden.id)) throw new ApiError("invalid_state");

  /** @type {import("../requests/simulacion.js").ResenaSim} */
  const resena = {
    id: idSimulado(),
    order_id: orden.id,
    workshop_id: orden.workshop_id,
    client_id: UID_CLIENTE,
    rating: valida.rating,
    tags: valida.tags,
    comment: valida.comment,
    hidden: false,
    created_at: new Date().toISOString(),
  };
  estado.resenas.push(resena);
  recalcularPromedio(orden.workshop_id);
  notificar(UID_ARTESANO, "review_received", { order_id: orden.id, review_id: resena.id, rating: resena.rating });
  return aResena(resena);
}

/** Recalcula el promedio del taller sobre las reseñas no ocultas (igual que el trigger de la base). */
function recalcularPromedio(/** @type {string} */ workshopId) {
  if (estado.taller.id !== workshopId) return;
  const visibles = estado.resenas.filter((r) => r.workshop_id === workshopId && !r.hidden);
  estado.taller.rating_count = visibles.length;
  estado.taller.rating_avg = visibles.length === 0 ? null : Math.round((visibles.reduce((s, r) => s + r.rating, 0) / visibles.length) * 10) / 10;
}

/** @param {import("../requests/simulacion.js").ResenaSim} r */
function aResena(r) {
  return { id: r.id, order_id: r.order_id, workshop_id: r.workshop_id, rating: r.rating, tags: [...r.tags], comment: r.comment, hidden: r.hidden, created_at: r.created_at };
}

/** @param {string} orderId */
export async function getOrderReview(orderId) {
  exigirUuid(orderId);
  exigirSesion();
  if (!estado.activo || (estado.rol !== "client" && estado.rol !== "craftsman")) return null;
  const resena = estado.resenas.find((r) => r.order_id === orderId);
  if (!resena || (resena.hidden && !(estado.rol === "client" && resena.client_id === UID_CLIENTE))) return null;
  return aResena(resena);
}

/** A2: pedidos entregados del cliente sin calificación, del más reciente al más antiguo. */
export async function listPendingReviews() {
  exigirSesion();
  if (!estado.activo || estado.rol !== "client") return [];
  return estado.ordenes
    .filter((o) => o.client_id === UID_CLIENTE && o.status === "delivered" && !estado.resenas.some((r) => r.order_id === o.id))
    .reverse()
    .map((o) => ({ ...o }));
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
