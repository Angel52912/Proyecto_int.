// Única capa que toca Supabase para el chat de la solicitud (CU-03). Contrato: docs/contrato-api.md.
// api.mock.js debe tener las mismas funciones, respuestas y errores.
import { obtenerCliente } from "../../supabaseClient.js";
import { ApiError, traducirError } from "../../lib/apiError.js";
import { exigirTexto, exigirUuid, MAX_MENSAJE } from "../requests/validar.js";

const COLUMNAS_MENSAJE = "id, request_id, sender_id, body, kind, quote_id, created_at";
const LIMITE_POR_DEFECTO = 50;
const LIMITE_MAXIMO = 100;

/**
 * @typedef {{ id: string, request_id: string, sender_id: string | null, body: string, kind: "text" | "quote_card" | "system", quote_id: string | null, created_at: string }} Mensaje
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
 * Mensajes de la solicitud, del más antiguo al más reciente. Para paginar hacia atrás usa `before` (created_at del más antiguo cargado).
 * @param {string} requestId
 * @param {{ limit?: number, before?: string }} [opciones] `limit` de 1 a 100 (por defecto 50)
 * @returns {Promise<Mensaje[]>}
 */
export async function listMessages(requestId, opciones = {}) {
  exigirUuid(requestId);
  const limite = opciones.limit ?? LIMITE_POR_DEFECTO;
  if (!Number.isInteger(limite) || limite < 1 || limite > LIMITE_MAXIMO) throw new ApiError("invalid_input");
  if (opciones.before !== undefined && Number.isNaN(Date.parse(opciones.before))) throw new ApiError("invalid_input");
  await obtenerUid();
  const cliente = obtenerCliente();
  let consulta = cliente.from("messages").select(COLUMNAS_MENSAJE).eq("request_id", requestId);
  if (opciones.before !== undefined) consulta = consulta.lt("created_at", opciones.before);
  const { data, error } = await consulta.order("created_at", { ascending: false }).limit(limite);
  if (error) throw traducirError(error);
  if ((data ?? []).length === 0) {
    // Sin mensajes: distingue "chat vacío" de "no participa en la solicitud".
    const { data: solicitud, error: errorSolicitud } = await cliente.from("service_requests").select("id").eq("id", requestId).maybeSingle();
    if (errorSolicitud) throw traducirError(errorSolicitud);
    if (!solicitud) throw new ApiError("not_found");
    return [];
  }
  return /** @type {Mensaje[]} */ (data).reverse();
}

/**
 * Envía un mensaje de texto. El remitente siempre es el usuario con sesión; el texto se guarda tal cual (la pantalla lo muestra con `textContent`).
 * @param {string} requestId
 * @param {string} body texto de 1 a 2000 caracteres
 * @returns {Promise<Mensaje>}
 */
export async function sendMessage(requestId, body) {
  exigirUuid(requestId);
  const texto = exigirTexto(body, MAX_MENSAJE);
  await obtenerUid();
  const { data, error } = await obtenerCliente().from("messages").insert({ request_id: requestId, body: texto }).select(COLUMNAS_MENSAJE).maybeSingle();
  if (error) throw traducirError(error); // 42501 (RLS) -> forbidden: no participa o la solicitud no admite mensajes
  if (!data) throw new ApiError("forbidden");
  return data;
}

/**
 * Mensajes nuevos en tiempo real (Realtime aplica el RLS: solo los de solicitudes donde participa).
 * @param {string} requestId
 * @param {(mensaje: Mensaje) => void} alRecibir
 * @returns {Promise<() => void>} función para cancelar la suscripción
 */
export async function subscribeToMessages(requestId, alRecibir) {
  exigirUuid(requestId);
  await obtenerUid();
  const cliente = obtenerCliente();
  const canal = cliente
    .channel(`chat:${requestId}`)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "messages", filter: `request_id=eq.${requestId}` },
      (cambio) => alRecibir(/** @type {Mensaje} */ (cambio.new)),
    )
    .subscribe();
  return () => {
    void cliente.removeChannel(canal);
  };
}
