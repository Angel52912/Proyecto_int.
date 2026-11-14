// Única capa que toca Supabase para solicitudes de cotización y notificaciones (CU-03). Contrato: docs/contrato-api.md.
// api.mock.js debe tener las mismas funciones, respuestas y errores.
import { obtenerCliente } from "../../supabaseClient.js";
import { ApiError, traducirError } from "../../lib/apiError.js";
import { validarImagen } from "../../lib/validate.js";
import { exigirUuid, validarDatosSolicitud } from "./validar.js";

const BUCKET = "request-photos";
const SEGUNDOS_URL_FIRMADA = 3600;
const COLUMNAS_SOLICITUD = "id, client_id, workshop_id, service_type, description, status, submitted_at, created_at";

/**
 * @typedef {{ id: string, client_id: string, workshop_id: string, service_type: "repair" | "cleaning", description: string, status: "draft" | "open" | "quoted" | "accepted" | "declined" | "cancelled", submitted_at: string | null, created_at: string, photo_count: number }} Solicitud
 * @typedef {{ id: string, path: string, url: string }} FotoSolicitud
 * @typedef {{ id: string, full_name: string, avatar_path: string | null }} Contraparte
 * @typedef {Solicitud & { photos: FotoSolicitud[], counterpart: Contraparte | null }} SolicitudDetalle
 * @typedef {{ id: string, type: string, payload: Record<string, unknown>, read_at: string | null, created_at: string }} Notificacion
 */

/**
 * @returns {Promise<string>} id del usuario con sesión; lanza not_authenticated si no hay
 */
async function obtenerUid() {
  const { data, error } = await obtenerCliente().auth.getSession();
  if (error) throw traducirError(error);
  const uid = data?.session?.user?.id;
  if (!uid) throw new ApiError("not_authenticated");
  return uid;
}

/**
 * @param {Record<string, any>} fila fila de service_requests con `request_photos(count)` incrustado
 * @returns {Solicitud}
 */
function aSolicitud(fila) {
  const { request_photos: fotos, ...resto } = fila;
  return { ...resto, photo_count: fotos?.[0]?.count ?? 0 };
}

/**
 * Fotos con URL firmada (el bucket es privado).
 * @param {string} requestId
 * @returns {Promise<FotoSolicitud[]>}
 */
async function leerFotos(requestId) {
  const cliente = obtenerCliente();
  const { data, error } = await cliente
    .from("request_photos")
    .select("id, path")
    .eq("request_id", requestId)
    .order("created_at", { ascending: true });
  if (error) throw traducirError(error);
  const filas = data ?? [];
  if (filas.length === 0) return [];
  const firmadas = await cliente.storage.from(BUCKET).createSignedUrls(
    filas.map((f) => f.path),
    SEGUNDOS_URL_FIRMADA,
  );
  if (firmadas.error) throw traducirError(firmadas.error);
  const urls = new Map((firmadas.data ?? []).map((f) => [f.path, f.signedUrl]));
  return filas.map((f) => ({ id: f.id, path: f.path, url: urls.get(f.path) ?? "" }));
}

/**
 * Perfil de la otra parte (nombre y foto). `null` si no se puede ver (p. ej. el taller ya no está publicado).
 * @param {Solicitud} solicitud
 * @param {string} uid
 * @returns {Promise<Contraparte | null>}
 */
async function leerContraparte(solicitud, uid) {
  const cliente = obtenerCliente();
  let otroId = solicitud.client_id;
  if (solicitud.client_id === uid) {
    const { data, error } = await cliente.from("workshops").select("owner_id").eq("id", solicitud.workshop_id).maybeSingle();
    if (error) throw traducirError(error);
    if (!data) return null;
    otroId = data.owner_id;
  }
  const { data, error } = await cliente.from("profiles").select("id, full_name, avatar_path").eq("id", otroId).maybeSingle();
  if (error) throw traducirError(error);
  return data;
}

/**
 * Solicitud propia (cliente) o de su taller (artesano). `null` si no existe o no es visible.
 * @param {string} requestId
 * @returns {Promise<Solicitud | null>}
 */
async function leerSolicitud(requestId) {
  const { data, error } = await obtenerCliente()
    .from("service_requests")
    .select(`${COLUMNAS_SOLICITUD}, request_photos(count)`)
    .eq("id", requestId)
    .maybeSingle();
  if (error) throw traducirError(error);
  return data ? aSolicitud(data) : null;
}

/**
 * Crea la solicitud en borrador. Si ya hay un borrador para ese taller lo reutiliza y actualiza la descripción.
 * @param {import("./validar.js").DatosSolicitud} datos
 * @returns {Promise<Solicitud>}
 */
export async function createRequestDraft(datos) {
  const fila = validarDatosSolicitud(datos);
  const uid = await obtenerUid();
  const cliente = obtenerCliente();
  const { data: viva, error: errorVida } = await cliente
    .from("service_requests")
    .select("id, status")
    .eq("client_id", uid)
    .eq("workshop_id", fila.workshop_id)
    .in("status", ["draft", "open", "quoted"])
    .maybeSingle();
  if (errorVida) throw traducirError(errorVida);
  if (viva && viva.status !== "draft") throw new ApiError("invalid_state");

  const consulta = viva
    ? cliente.from("service_requests").update({ description: fila.description }).eq("id", viva.id)
    : cliente.from("service_requests").insert(fila);
  const { data, error } = await consulta.select(`${COLUMNAS_SOLICITUD}, request_photos(count)`).maybeSingle();
  if (error) throw traducirError(error);
  if (!data) throw new ApiError("forbidden"); // RLS: no es cliente activo o el taller no recibe ese servicio
  return aSolicitud(data);
}

/**
 * Sube una foto privada a la solicitud en borrador y la registra (máximo 5).
 * @param {string} requestId
 * @param {{ type: string, size: number }} archivo imagen jpeg, png o webp de hasta 5 MB
 * @returns {Promise<FotoSolicitud>}
 */
export async function addRequestPhoto(requestId, archivo) {
  exigirUuid(requestId);
  if (!validarImagen(archivo).valido) throw new ApiError("invalid_input");
  await obtenerUid();
  const cliente = obtenerCliente();
  const path = `${requestId}/${globalThis.crypto.randomUUID()}`;
  const subida = await cliente.storage.from(BUCKET).upload(path, /** @type {File} */ (archivo), { contentType: archivo.type, upsert: false });
  if (subida.error) throw traducirError(subida.error);

  const { data, error } = await cliente.from("request_photos").insert({ request_id: requestId, path }).select("id, path").maybeSingle();
  if (error || !data) {
    await cliente.storage.from(BUCKET).remove([path]); // no deja archivos huérfanos
    throw error ? traducirError(error) : new ApiError("forbidden");
  }
  const firmada = await cliente.storage.from(BUCKET).createSignedUrl(path, SEGUNDOS_URL_FIRMADA);
  if (firmada.error) throw traducirError(firmada.error);
  return { id: data.id, path: data.path, url: firmada.data.signedUrl };
}

/**
 * Quita una foto de una solicitud en borrador (registro y archivo).
 * @param {string} photoId
 * @returns {Promise<void>}
 */
export async function removeRequestPhoto(photoId) {
  exigirUuid(photoId);
  await obtenerUid();
  const cliente = obtenerCliente();
  const { data, error } = await cliente.from("request_photos").delete().eq("id", photoId).select("path").maybeSingle();
  if (error) throw traducirError(error);
  if (!data) throw new ApiError("not_found");
  const borrado = await cliente.storage.from(BUCKET).remove([data.path]);
  if (borrado.error) throw traducirError(borrado.error);
}

/**
 * Envía la solicitud al taller (RPC `submit_request`): `draft` -> `open`.
 * @param {string} requestId
 * @returns {Promise<{ id: string, status: "open" }>}
 */
export async function submitRequest(requestId) {
  exigirUuid(requestId);
  const { data, error } = await obtenerCliente().rpc("submit_request", { p_request_id: requestId });
  if (error) throw traducirError(error);
  return { id: data.id, status: data.status };
}

/**
 * Cancela la solicitud (RPC `cancel_request`): solo desde `open` o `quoted`.
 * @param {string} requestId
 * @returns {Promise<{ id: string, status: "cancelled" }>}
 */
export async function cancelRequest(requestId) {
  exigirUuid(requestId);
  const { data, error } = await obtenerCliente().rpc("cancel_request", { p_request_id: requestId });
  if (error) throw traducirError(error);
  return { id: data.id, status: data.status };
}

/**
 * Solicitudes del cliente (todas las suyas) o del taller del artesano (sin borradores), de la más reciente a la más antigua.
 * @returns {Promise<Solicitud[]>}
 */
export async function listMyRequests() {
  await obtenerUid();
  const { data, error } = await obtenerCliente()
    .from("service_requests")
    .select(`${COLUMNAS_SOLICITUD}, request_photos(count)`)
    .order("created_at", { ascending: false });
  if (error) throw traducirError(error);
  return (data ?? []).map(aSolicitud);
}

/**
 * Detalle con fotos (URL firmada de 1 h) y datos de la contraparte.
 * @param {string} requestId
 * @returns {Promise<SolicitudDetalle>}
 */
export async function getRequest(requestId) {
  exigirUuid(requestId);
  const uid = await obtenerUid();
  const solicitud = await leerSolicitud(requestId);
  if (!solicitud) throw new ApiError("not_found");
  const [photos, counterpart] = await Promise.all([leerFotos(requestId), leerContraparte(solicitud, uid)]);
  return { ...solicitud, photos, counterpart };
}

/**
 * @param {{ unreadOnly?: boolean }} [opciones]
 * @returns {Promise<Notificacion[]>} las propias, de la más reciente a la más antigua (máximo 50)
 */
export async function listMyNotifications(opciones = {}) {
  await obtenerUid();
  let consulta = obtenerCliente().from("notifications").select("id, type, payload, read_at, created_at");
  if (opciones.unreadOnly === true) consulta = consulta.is("read_at", null);
  const { data, error } = await consulta.order("created_at", { ascending: false }).limit(50);
  if (error) throw traducirError(error);
  return data ?? [];
}

/**
 * @param {string} notificationId
 * @returns {Promise<Notificacion>}
 */
export async function markNotificationRead(notificationId) {
  exigirUuid(notificationId);
  await obtenerUid();
  const { data, error } = await obtenerCliente()
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", notificationId)
    .select("id, type, payload, read_at, created_at")
    .maybeSingle();
  if (error) throw traducirError(error);
  if (!data) throw new ApiError("not_found");
  return data;
}

/**
 * Notificaciones nuevas en tiempo real (Realtime aplica el RLS: solo las propias).
 * @param {(notificacion: Notificacion) => void} alRecibir
 * @returns {Promise<() => void>} función para cancelar la suscripción
 */
export async function subscribeToNotifications(alRecibir) {
  const uid = await obtenerUid();
  const cliente = obtenerCliente();
  const canal = cliente
    .channel(`notificaciones:${uid}`)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${uid}` },
      (cambio) => alRecibir(/** @type {Notificacion} */ (cambio.new)),
    )
    .subscribe();
  return () => {
    void cliente.removeChannel(canal);
  };
}
