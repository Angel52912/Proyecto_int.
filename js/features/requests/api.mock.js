// Simulado en memoria de api.js (CU-03). Misma forma de respuesta y de errores que el real.
// El estado vive en simulacion.js (compartido con el chat). Por defecto la sesión es de un cliente activo.
import { ApiError } from "../../lib/apiError.js";
import { validarImagen } from "../../lib/validate.js";
import {
  MAX_FOTOS_SOLICITUD,
  MAX_SOLICITUDES_ACTIVAS,
  exigirUuid,
  validarDatosSolicitud,
} from "./validar.js";
import {
  UID_ARTESANO,
  UID_CLIENTE,
  agregarMensaje,
  estado,
  exigirClienteFuncion,
  exigirSesion,
  idSimulado,
  notificar,
  solicitudVisible,
  tallerAcepta,
  uidActual,
} from "./simulacion.js";

export { fijarSesionSimulada, fijarTallerSimulado, reiniciarSimulacion, ID_TALLER_SIMULADO } from "./simulacion.js";

const VIVAS = ["draft", "open", "quoted"];

/**
 * @param {import("./simulacion.js").SolicitudSim} s
 * @returns {any}
 */
function aSolicitud(s) {
  return { ...s, photo_count: estado.fotos.filter((f) => f.request_id === s.id).length };
}

/**
 * Notificación con la forma pública del contrato (sin `user_id`).
 * @param {{ id: string, type: string, payload: Record<string, unknown>, read_at: string | null, created_at: string }} n
 */
function aNotificacion(n) {
  return { id: n.id, type: n.type, payload: { ...n.payload }, read_at: n.read_at, created_at: n.created_at };
}

/** @param {string} path */
const urlFoto = (path) => `https://simulado.local/request-photos/${path}`;

/**
 * Solicitud propia en borrador (lo que exige RLS para subir o borrar fotos).
 * @param {string} requestId
 */
function borradorPropio(requestId) {
  const s = estado.solicitudes.find((x) => x.id === requestId);
  return s && s.status === "draft" && estado.rol === "client" && estado.activo && s.client_id === UID_CLIENTE ? s : undefined;
}

/** @param {import("./validar.js").DatosSolicitud} datos */
export async function createRequestDraft(datos) {
  const fila = validarDatosSolicitud(datos);
  exigirSesion();
  // RLS: solo un cliente activo, y un taller que recibe ese servicio.
  if (estado.rol !== "client" || !estado.activo || !tallerAcepta(fila.workshop_id, fila.service_type)) throw new ApiError("forbidden");
  const viva = estado.solicitudes.find((s) => s.client_id === UID_CLIENTE && s.workshop_id === fila.workshop_id && VIVAS.includes(s.status));
  if (viva && viva.status !== "draft") throw new ApiError("invalid_state");
  if (viva) {
    viva.description = fila.description;
    return aSolicitud(viva);
  }
  const nueva = {
    id: idSimulado(),
    client_id: UID_CLIENTE,
    workshop_id: fila.workshop_id,
    service_type: fila.service_type,
    description: fila.description,
    status: "draft",
    submitted_at: null,
    created_at: new Date().toISOString(),
  };
  estado.solicitudes.push(nueva);
  return aSolicitud(nueva);
}

/**
 * @param {string} requestId
 * @param {{ type: string, size: number }} archivo
 */
export async function addRequestPhoto(requestId, archivo) {
  exigirUuid(requestId);
  if (!validarImagen(archivo).valido) throw new ApiError("invalid_input");
  exigirSesion();
  const solicitud = borradorPropio(requestId);
  if (!solicitud) throw new ApiError("forbidden");
  if (estado.fotos.filter((f) => f.request_id === requestId).length >= MAX_FOTOS_SOLICITUD) throw new ApiError("limit_reached");
  const foto = { id: idSimulado(), request_id: requestId, path: `${requestId}/${idSimulado()}` };
  estado.fotos.push(foto);
  return { id: foto.id, path: foto.path, url: urlFoto(foto.path) };
}

/** @param {string} photoId */
export async function removeRequestPhoto(photoId) {
  exigirUuid(photoId);
  exigirSesion();
  const indice = estado.fotos.findIndex((f) => f.id === photoId);
  if (indice === -1 || !borradorPropio(estado.fotos[indice].request_id)) throw new ApiError("not_found");
  estado.fotos.splice(indice, 1);
}

/** @param {string} requestId */
export async function submitRequest(requestId) {
  exigirUuid(requestId);
  exigirClienteFuncion();
  const s = estado.solicitudes.find((x) => x.id === requestId && x.client_id === UID_CLIENTE);
  if (!s) throw new ApiError("not_found");
  if (s.status !== "draft") throw new ApiError("invalid_state");
  if (!estado.fotos.some((f) => f.request_id === s.id)) throw new ApiError("photo_required");
  if (!tallerAcepta(s.workshop_id, s.service_type)) throw new ApiError("invalid_state");
  const activas = estado.solicitudes.filter((x) => x.client_id === UID_CLIENTE && (x.status === "open" || x.status === "quoted")).length;
  if (activas >= MAX_SOLICITUDES_ACTIVAS) throw new ApiError("limit_reached");
  s.status = "open";
  s.submitted_at = new Date().toISOString();
  agregarMensaje({ request_id: s.id, sender_id: null, body: "Solicitud enviada", kind: "system" });
  notificar(estado.taller.owner_id, "request_received", { request_id: s.id });
  return { id: s.id, status: /** @type {const} */ ("open") };
}

/** @param {string} requestId */
export async function cancelRequest(requestId) {
  exigirUuid(requestId);
  exigirClienteFuncion();
  const s = estado.solicitudes.find((x) => x.id === requestId && x.client_id === UID_CLIENTE);
  if (!s) throw new ApiError("not_found");
  if (s.status !== "open" && s.status !== "quoted") throw new ApiError("invalid_state");
  s.status = "cancelled";
  // CU-04: el presupuesto vigente queda rechazado (igual que cancel_request en 0011).
  for (const q of estado.cotizaciones) {
    if (q.request_id === s.id && q.status === "sent") {
      q.status = "rejected";
      q.responded_at = new Date().toISOString();
    }
  }
  agregarMensaje({ request_id: s.id, sender_id: null, body: "Solicitud cancelada por el cliente", kind: "system" });
  notificar(estado.taller.owner_id, "request_cancelled", { request_id: s.id });
  return { id: s.id, status: /** @type {const} */ ("cancelled") };
}

export async function listMyRequests() {
  exigirSesion();
  return estado.solicitudes
    .filter((s) => solicitudVisible(s.id))
    .reverse()
    .map(aSolicitud);
}

/** @param {string} requestId */
export async function getRequest(requestId) {
  exigirUuid(requestId);
  exigirSesion();
  const s = solicitudVisible(requestId);
  if (!s) throw new ApiError("not_found");
  const photos = estado.fotos.filter((f) => f.request_id === s.id).map((f) => ({ id: f.id, path: f.path, url: urlFoto(f.path) }));
  /** @type {{ id: string, full_name: string, avatar_path: string | null } | null} */
  let counterpart;
  if (estado.rol === "client") {
    // El cliente solo ve al artesano mientras el taller siga publicado (RLS de workshops).
    counterpart = estado.taller.published && !estado.taller.suspended ? { id: UID_ARTESANO, full_name: "Taller Simulado", avatar_path: null } : null;
  } else {
    counterpart = { id: UID_CLIENTE, full_name: "Cliente Simulado", avatar_path: null };
  }
  return { ...aSolicitud(s), photos, counterpart };
}

/** @param {{ unreadOnly?: boolean }} [opciones] */
export async function listMyNotifications(opciones = {}) {
  exigirSesion();
  return estado.notificaciones
    .filter((n) => n.user_id === uidActual() && (opciones.unreadOnly !== true || n.read_at === null))
    .reverse()
    .slice(0, 50)
    .map(aNotificacion);
}

/** @param {string} notificationId */
export async function markNotificationRead(notificationId) {
  exigirUuid(notificationId);
  exigirSesion();
  const n = estado.notificaciones.find((x) => x.id === notificationId && x.user_id === uidActual());
  if (!n) throw new ApiError("not_found");
  n.read_at ??= new Date().toISOString();
  return aNotificacion(n);
}

/** @param {(notificacion: any) => void} alRecibir */
export async function subscribeToNotifications(alRecibir) {
  exigirSesion();
  const escucha = { uid: uidActual(), fn: alRecibir };
  estado.escuchasNotificaciones.add(escucha);
  return () => {
    estado.escuchasNotificaciones.delete(escucha);
  };
}
