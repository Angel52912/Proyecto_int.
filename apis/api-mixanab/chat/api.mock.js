// Simulado en memoria de api.js del chat (CU-03). Comparte estado con el simulado de solicitudes (requests/simulacion.js).
import { ApiError } from "../../lib/apiError.js";
import { exigirTexto, exigirUuid, MAX_MENSAJE } from "../requests/validar.js";
import { agregarMensaje, estado, exigirSesion, participa, uidActual } from "../requests/simulacion.js";

export { fijarSesionSimulada, reiniciarSimulacion } from "../requests/simulacion.js";

const LIMITE_POR_DEFECTO = 50;
const LIMITE_MAXIMO = 100;

/**
 * @param {string} requestId
 * @param {{ limit?: number, before?: string }} [opciones]
 */
export async function listMessages(requestId, opciones = {}) {
  exigirUuid(requestId);
  const limite = opciones.limit ?? LIMITE_POR_DEFECTO;
  if (!Number.isInteger(limite) || limite < 1 || limite > LIMITE_MAXIMO) throw new ApiError("invalid_input");
  if (opciones.before !== undefined && Number.isNaN(Date.parse(opciones.before))) throw new ApiError("invalid_input");
  exigirSesion();
  const solicitud = estado.solicitudes.find((s) => s.id === requestId);
  if (!solicitud || !participa(solicitud)) throw new ApiError("not_found");
  const antes = opciones.before === undefined ? Infinity : Date.parse(opciones.before);
  return estado.mensajes
    .filter((m) => m.request_id === requestId && Date.parse(m.created_at) < antes)
    .slice(-limite)
    .map((m) => ({ ...m }));
}

/**
 * @param {string} requestId
 * @param {string} body
 */
export async function sendMessage(requestId, body) {
  exigirUuid(requestId);
  const texto = exigirTexto(body, MAX_MENSAJE);
  exigirSesion();
  const solicitud = estado.solicitudes.find((s) => s.id === requestId);
  // RLS: solo participantes y solo con la solicitud abierta, cotizada o aceptada.
  if (!solicitud || !participa(solicitud) || !["open", "quoted", "accepted"].includes(solicitud.status)) throw new ApiError("forbidden");
  return { ...agregarMensaje({ request_id: requestId, sender_id: uidActual(), body: texto }) };
}

/**
 * @param {string} requestId
 * @param {(mensaje: any) => void} alRecibir
 */
export async function subscribeToMessages(requestId, alRecibir) {
  exigirUuid(requestId);
  exigirSesion();
  const solicitud = estado.solicitudes.find((s) => s.id === requestId);
  const permitido = solicitud !== undefined && participa(solicitud);
  /** @param {any} mensaje */
  const escucha = (mensaje) => {
    if (permitido && mensaje.request_id === requestId) alRecibir(mensaje);
  };
  estado.escuchasMensajes.add(escucha);
  return () => {
    estado.escuchasMensajes.delete(escucha);
  };
}
