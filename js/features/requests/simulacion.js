// Estado en memoria compartido por los simulados de solicitudes y chat (CU-03). Solo lo usan los api.mock.js y las pruebas.
// Por defecto la sesión simulada es de un cliente activo. `fijarSesionSimulada` cambia el rol para actuar como el artesano.
import { ApiError } from "../../lib/apiError.js";

export const UID_CLIENTE = "00000000-0000-4000-8000-0000000000c1";
export const UID_ARTESANO = "00000000-0000-4000-8000-000000000002";
export const UID_OTRO = "00000000-0000-4000-8000-0000000000e1";
export const ID_TALLER_SIMULADO = "00000000-0000-4000-8000-0000000000a1";

/**
 * @typedef {{ id: string, client_id: string, workshop_id: string, service_type: string, description: string, status: string, submitted_at: string | null, created_at: string }} SolicitudSim
 * @typedef {{ id: string, request_id: string, sender_id: string | null, body: string, kind: string, quote_id: string | null, created_at: string }} MensajeSim
 * @typedef {{ id: string, request_id: string, amount_mxn: number, delivery_date: string, detail: Record<string, unknown>, status: "sent" | "accepted" | "rejected" | "superseded", created_at: string, responded_at: string | null }} CotizacionSim
 * @typedef {{ id: string, quote_id: string, request_id: string, client_id: string, workshop_id: string, phase: number, status: "in_progress" | "ready" | "delivered" | "cancelled", due_date: string, ready_at: string | null, delivered_at: string | null, created_at: string, updated_at: string }} OrdenSim
 */

let contadorIds = 0;

/** @returns {string} uuid simulado (sin depender de crypto) */
export function idSimulado() {
  contadorIds += 1;
  return `00000000-0000-4000-8000-${String(contadorIds).padStart(12, "0")}`;
}

/** @returns {typeof estado} */
function estadoInicial() {
  return {
    sesion: true,
    /** @type {string | null} */
    rol: "client",
    activo: true,
    taller: { id: ID_TALLER_SIMULADO, owner_id: UID_ARTESANO, published: true, suspended: false, services: ["repair", "cleaning"] },
    /** @type {SolicitudSim[]} */
    solicitudes: [],
    /** @type {{ id: string, request_id: string, path: string }[]} */
    fotos: [],
    /** @type {MensajeSim[]} */
    mensajes: [],
    /** @type {CotizacionSim[]} */
    cotizaciones: [],
    /** @type {OrdenSim[]} */
    ordenes: [],
    /** @type {{ id: string, user_id: string, type: string, payload: Record<string, unknown>, read_at: string | null, created_at: string }[]} */
    notificaciones: [],
    /** @type {Set<(mensaje: MensajeSim) => void>} */
    escuchasMensajes: new Set(),
    /** @type {Set<{ uid: string, fn: (notificacion: any) => void }>} */
    escuchasNotificaciones: new Set(),
  };
}

export let estado = estadoInicial();

/** Reinicia el estado (para pruebas). */
export function reiniciarSimulacion() {
  estado = estadoInicial();
}

/**
 * Cambia la sesión simulada (para pruebas): rol `client`, `craftsman`, `admin` o null (sin rol); `sesion: false` = anónimo.
 * @param {{ sesion?: boolean, rol?: string | null, activo?: boolean }} cambios
 */
export function fijarSesionSimulada(cambios) {
  Object.assign(estado, cambios);
}

/**
 * Cambia el taller simulado (para pruebas).
 * @param {{ published?: boolean, suspended?: boolean, services?: string[] }} cambios
 */
export function fijarTallerSimulado(cambios) {
  Object.assign(estado.taller, cambios);
}

/** @returns {string} id del usuario simulado según el rol */
export function uidActual() {
  if (estado.rol === "client") return UID_CLIENTE;
  if (estado.rol === "craftsman") return UID_ARTESANO;
  return UID_OTRO;
}

export function exigirSesion() {
  if (!estado.sesion) throw new ApiError("not_authenticated");
}

/** Cliente activo (igual que las funciones SQL: inactive_user antes que forbidden). */
export function exigirClienteFuncion() {
  exigirSesion();
  if (!estado.activo) throw new ApiError("inactive_user");
  if (estado.rol !== "client") throw new ApiError("forbidden");
}

/**
 * ¿El usuario simulado participa en la solicitud? Cliente dueño o artesano dueño del taller (sin borradores).
 * @param {SolicitudSim} solicitud
 * @returns {boolean}
 */
export function participa(solicitud) {
  if (!estado.activo) return false;
  if (estado.rol === "client") return solicitud.client_id === UID_CLIENTE;
  if (estado.rol === "craftsman") return estado.taller.owner_id === UID_ARTESANO && solicitud.status !== "draft";
  return false;
}

/**
 * @param {string} requestId
 * @returns {SolicitudSim | undefined} la solicitud si es visible para el usuario simulado
 */
export function solicitudVisible(requestId) {
  const solicitud = estado.solicitudes.find((s) => s.id === requestId);
  return solicitud && participa(solicitud) ? solicitud : undefined;
}

/** ¿El taller recibe solicitudes de ese servicio? */
export function tallerAcepta(/** @type {string} */ workshopId, /** @type {string} */ servicio) {
  const t = estado.taller;
  return t.id === workshopId && t.published && !t.suspended && t.services.includes(servicio);
}

/**
 * Agrega un mensaje y avisa a los suscritos.
 * @param {{ request_id: string, sender_id: string | null, body: string, kind?: string, quote_id?: string | null }} datos
 * @returns {MensajeSim}
 */
export function agregarMensaje(datos) {
  /** @type {MensajeSim} */
  const mensaje = {
    id: idSimulado(),
    request_id: datos.request_id,
    sender_id: datos.sender_id,
    body: datos.body,
    kind: datos.kind ?? "text",
    quote_id: datos.quote_id ?? null,
    created_at: new Date().toISOString(),
  };
  estado.mensajes.push(mensaje);
  for (const escucha of estado.escuchasMensajes) escucha({ ...mensaje });
  return mensaje;
}

/**
 * Crea una notificación para un usuario y avisa a los suscritos.
 * @param {string} userId
 * @param {string} type
 * @param {Record<string, unknown>} payload
 */
export function notificar(userId, type, payload) {
  const notificacion = { id: idSimulado(), user_id: userId, type, payload, read_at: null, created_at: new Date().toISOString() };
  estado.notificaciones.push(notificacion);
  for (const escucha of estado.escuchasNotificaciones) {
    if (escucha.uid === userId) escucha.fn({ ...notificacion });
  }
}
