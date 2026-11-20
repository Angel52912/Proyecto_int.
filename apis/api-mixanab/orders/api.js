// Única capa que toca Supabase para órdenes de trabajo (CU-04: solo lectura; CU-05 y CU-06 agregan fases y entrega).
// Contrato: docs/contrato-api.md. api.mock.js debe tener las mismas funciones, respuestas y errores.
import { obtenerCliente } from "../../supabaseClient.js";
import { ApiError, traducirError } from "../../lib/apiError.js";
import { validarImagen } from "../../lib/validate.js";
import { exigirUuid } from "../requests/validar.js";
import { extraerPin, validarResena } from "./validar.js";

// El PIN no está en `orders`: vive en private.order_pins y solo lo tocan las funciones de entrega.
const COLUMNAS_ORDEN = "id, quote_id, request_id, client_id, workshop_id, phase, status, due_date, ready_at, delivered_at, created_at, updated_at";

/**
 * @typedef {{ id: string, quote_id: string, request_id: string, client_id: string, workshop_id: string, phase: number, status: "in_progress" | "ready" | "delivered" | "cancelled", due_date: string, ready_at: string | null, delivered_at: string | null, created_at: string, updated_at: string }} Orden
 */

/**
 * Órdenes del cliente o del taller del artesano, de la más reciente a la más antigua.
 * @returns {Promise<Orden[]>}
 */
export async function listMyOrders() {
  const { data, error } = await obtenerCliente().from("orders").select(COLUMNAS_ORDEN).order("created_at", { ascending: false });
  if (error) throw traducirError(error);
  return data ?? [];
}

/**
 * @typedef {{ id: string, order_id: string, phase: number, photo_path: string, note: string | null, corrected: boolean, created_by: string, created_at: string }} Avance
 * @typedef {Avance & { url: string }} AvanceConFoto
 * @typedef {{ phase: number, photo: { type: string, size: number }, note?: string, confirm?: boolean }} DatosFase
 */

/** Ruta de Storage de la foto de avance: {order_id}/{uuid}. */
const BUCKET_AVANCES = "progress-photos";
const SEGUNDOS_URL_FIRMADA = 3600;

/**
 * Cambia la fase del pedido (RPC `advance_phase`). La foto de avance es obligatoria: se sube primero y, si la
 * función falla, se borra el archivo huérfano. Avanzar es de una fase; un salto o retroceso exige `confirm` y `note`.
 * @param {string} orderId
 * @param {DatosFase} datos
 * @returns {Promise<{ order_id: string, phase: number, status: string, update: Avance }>}
 */
export async function advanceOrderPhase(orderId, datos) {
  exigirUuid(orderId);
  if (!Number.isInteger(datos?.phase) || datos.phase < 1 || datos.phase > 4) throw new ApiError("invalid_input");
  if (datos.note !== undefined && (typeof datos.note !== "string" || datos.note.trim().length > 500)) throw new ApiError("invalid_input");
  if (datos.confirm !== undefined && typeof datos.confirm !== "boolean") throw new ApiError("invalid_input");
  if (!datos.photo) throw new ApiError("photo_required");
  if (!validarImagen(datos.photo).valido) throw new ApiError("invalid_input");

  const cliente = obtenerCliente();
  const ruta = `${orderId}/${globalThis.crypto.randomUUID()}`;
  const subida = await cliente.storage.from(BUCKET_AVANCES).upload(ruta, /** @type {File} */ (datos.photo), { contentType: datos.photo.type, upsert: false });
  if (subida.error) throw traducirError(subida.error);

  const { data, error } = await cliente.rpc("advance_phase", {
    p_order_id: orderId,
    p_to_phase: datos.phase,
    p_photo_path: ruta,
    p_note: datos.note ?? null,
    p_confirm: datos.confirm ?? false,
  });
  if (error) {
    await cliente.storage.from(BUCKET_AVANCES).remove([ruta]); // no deja archivos huérfanos
    throw traducirError(error);
  }
  return data;
}

/**
 * Marca el pedido "Listo para entrega" (RPC `mark_ready`). Exige la fase 4.
 * @param {string} orderId
 * @returns {Promise<{ order_id: string, status: "ready", phase: number, ready_at: string }>}
 */
export async function markOrderReady(orderId) {
  exigirUuid(orderId);
  const { data, error } = await obtenerCliente().rpc("mark_ready", { p_order_id: orderId });
  if (error) throw traducirError(error);
  return data;
}

/**
 * Historial de avances del pedido con URL firmada de la foto (bucket privado), del más antiguo al más reciente.
 * @param {string} orderId
 * @returns {Promise<AvanceConFoto[]>}
 */
export async function listOrderUpdates(orderId) {
  exigirUuid(orderId);
  const cliente = obtenerCliente();
  const { data, error } = await cliente
    .from("order_updates")
    .select("id, order_id, phase, photo_path, note, corrected, created_by, created_at")
    .eq("order_id", orderId)
    .order("created_at", { ascending: true });
  if (error) throw traducirError(error);
  const filas = data ?? [];
  if (filas.length === 0) return [];
  const firmadas = await cliente.storage.from(BUCKET_AVANCES).createSignedUrls(
    filas.map((f) => f.photo_path),
    SEGUNDOS_URL_FIRMADA,
  );
  if (firmadas.error) throw traducirError(firmadas.error);
  const urls = new Map((firmadas.data ?? []).map((f) => [f.path, f.signedUrl]));
  return filas.map((f) => ({ ...f, url: urls.get(f.photo_path) ?? "" }));
}

/**
 * Avisa de cada nuevo avance del pedido (Realtime, INSERT en `order_updates`). El estatus "listo" llega por la
 * notificación `order_ready` (no se escucha `orders`: Realtime no respeta los permisos por columna).
 * @param {string} orderId
 * @param {(avance: Avance) => void} alRecibir
 * @returns {Promise<() => void>} función que cancela la suscripción
 */
export async function subscribeToOrderUpdates(orderId, alRecibir) {
  exigirUuid(orderId);
  const cliente = obtenerCliente();
  const { data, error } = await cliente.auth.getSession();
  if (error) throw traducirError(error);
  if (!data?.session?.user?.id) throw new ApiError("not_authenticated");
  const canal = cliente
    .channel(`order-updates:${orderId}`)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "order_updates", filter: `order_id=eq.${orderId}` },
      (cambio) => alRecibir(/** @type {Avance} */ (cambio.new)),
    )
    .subscribe();
  return () => {
    void cliente.removeChannel(canal);
  };
}

/**
 * @typedef {{ order_id: string, pin: string }} PinEntrega
 * @typedef {{ ok: boolean, attempts_left: number, locked_until: string | null, status: string }} ResultadoPin
 * @typedef {{ id: string, order_id: string, workshop_id: string, rating: number, tags: string[], comment: string | null, hidden: boolean, created_at: string }} Resena
 */

/**
 * El cliente genera y muestra el PIN de entrega (RPC `reveal_delivery_pin`). Solo con el pedido `ready`.
 * Cada llamada rota el PIN. El QR codifica `${order_id}:${pin}`.
 * @param {string} orderId
 * @returns {Promise<PinEntrega>}
 */
export async function revealDeliveryPin(orderId) {
  exigirUuid(orderId);
  const { data, error } = await obtenerCliente().rpc("reveal_delivery_pin", { p_order_id: orderId });
  if (error) throw traducirError(error);
  return { order_id: data.order_id, pin: data.pin };
}

/**
 * El artesano confirma la entrega con el PIN o el texto del QR (RPC `verify_delivery_pin`). Un PIN incorrecto NO
 * lanza: devuelve `{ ok: false, attempts_left, locked_until }`. 5 intentos y bloqueo de 15 minutos.
 * @param {string} orderId
 * @param {string} codigo `123456` o `order_id:123456`
 * @returns {Promise<ResultadoPin>}
 */
export async function verifyDeliveryPin(orderId, codigo) {
  exigirUuid(orderId);
  const pin = extraerPin(orderId, codigo);
  const { data, error } = await obtenerCliente().rpc("verify_delivery_pin", { p_order_id: orderId, p_pin: pin });
  if (error) throw traducirError(error);
  return { ok: data.ok, attempts_left: data.attempts_left, locked_until: data.locked_until, status: data.status };
}

/**
 * El cliente califica al artesano (RPC `create_review`). Una reseña por pedido entregado; sin edición.
 * @param {string} orderId
 * @param {import("./validar.js").DatosResena} datos
 * @returns {Promise<Resena>}
 */
export async function createReview(orderId, datos) {
  exigirUuid(orderId);
  const valida = validarResena(datos);
  const { data, error } = await obtenerCliente().rpc("create_review", {
    p_order_id: orderId,
    p_rating: valida.rating,
    p_comment: valida.comment,
    p_tags: valida.tags,
  });
  if (error) throw traducirError(error);
  return data;
}

/**
 * Reseña del pedido, o `null` si no hay (o está oculta y no es del usuario).
 * @param {string} orderId
 * @returns {Promise<Resena | null>}
 */
export async function getOrderReview(orderId) {
  exigirUuid(orderId);
  const { data, error } = await obtenerCliente()
    .from("reviews")
    .select("id, order_id, workshop_id, rating, tags, comment, hidden, created_at")
    .eq("order_id", orderId)
    .maybeSingle();
  if (error) throw traducirError(error);
  return data;
}

/**
 * A2: pedidos entregados del cliente que aún no tienen calificación, del más reciente al más antiguo.
 * @returns {Promise<Orden[]>}
 */
export async function listPendingReviews() {
  const { data, error } = await obtenerCliente()
    .from("orders")
    .select(`${COLUMNAS_ORDEN}, reviews(id)`)
    .eq("status", "delivered")
    .order("delivered_at", { ascending: false });
  if (error) throw traducirError(error);
  return (data ?? [])
    .filter((o) => (o.reviews ?? []).length === 0)
    .map((o) => {
      const { reviews, ...orden } = o;
      void reviews; // solo sirve para el filtro; no forma parte de Orden
      return orden;
    });
}

/**
 * @param {string} orderId
 * @returns {Promise<Orden>}
 */
export async function getOrder(orderId) {
  exigirUuid(orderId);
  const { data, error } = await obtenerCliente().from("orders").select(COLUMNAS_ORDEN).eq("id", orderId).maybeSingle();
  if (error) throw traducirError(error);
  if (!data) throw new ApiError("not_found");
  return data;
}
