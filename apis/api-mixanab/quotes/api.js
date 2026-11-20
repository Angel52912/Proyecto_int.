// Única capa que toca Supabase para presupuestos (CU-04). Contrato: docs/contrato-api.md.
// api.mock.js debe tener las mismas funciones, respuestas y errores.
import { obtenerCliente } from "../../supabaseClient.js";
import { ApiError, traducirError } from "../../lib/apiError.js";
import { exigirUuid } from "../requests/validar.js";
import { validarDatosPresupuesto } from "./validar.js";

const COLUMNAS_PRESUPUESTO = "id, request_id, amount_mxn, delivery_date, detail, status, created_at, responded_at";

/**
 * @typedef {{ id: string, request_id: string, amount_mxn: number, delivery_date: string, detail: Record<string, unknown>, status: "sent" | "accepted" | "rejected" | "superseded", created_at: string, responded_at: string | null }} Presupuesto
 * @typedef {{ quote_id: string, status: "accepted" | "rejected", order_id: string | null }} RespuestaPresupuesto
 */

/**
 * Envía el presupuesto (RPC `send_quote`). Si ya había uno vigente lo rectifica (A2): el anterior queda `superseded`.
 * @param {string} requestId
 * @param {import("./validar.js").DatosPresupuesto} datos
 * @returns {Promise<Presupuesto>}
 */
export async function sendQuote(requestId, datos) {
  exigirUuid(requestId);
  const valido = validarDatosPresupuesto(datos);
  const { data, error } = await obtenerCliente().rpc("send_quote", {
    p_request_id: requestId,
    p_amount_mxn: valido.amount_mxn,
    p_delivery_date: valido.delivery_date,
    p_detail: valido.detail,
  });
  if (error) throw traducirError(error);
  return data;
}

/**
 * El cliente acepta o rechaza el presupuesto vigente (RPC `respond_quote`). Aceptar crea la orden.
 * @param {string} quoteId
 * @param {boolean} aceptar
 * @returns {Promise<RespuestaPresupuesto>}
 */
export async function respondQuote(quoteId, aceptar) {
  exigirUuid(quoteId);
  if (typeof aceptar !== "boolean") throw new ApiError("invalid_input");
  const { data, error } = await obtenerCliente().rpc("respond_quote", { p_quote_id: quoteId, p_accept: aceptar });
  if (error) throw traducirError(error);
  return { quote_id: data.quote_id, status: data.status, order_id: data.order_id };
}

/**
 * @param {string} quoteId
 * @returns {Promise<Presupuesto>}
 */
export async function getQuote(quoteId) {
  exigirUuid(quoteId);
  const { data, error } = await obtenerCliente().from("quotes").select(COLUMNAS_PRESUPUESTO).eq("id", quoteId).maybeSingle();
  if (error) throw traducirError(error);
  if (!data) throw new ApiError("not_found");
  return data;
}

/**
 * Historial de presupuestos de la solicitud, del más antiguo al más reciente.
 * @param {string} requestId
 * @returns {Promise<Presupuesto[]>}
 */
export async function listQuotes(requestId) {
  exigirUuid(requestId);
  const { data, error } = await obtenerCliente()
    .from("quotes")
    .select(COLUMNAS_PRESUPUESTO)
    .eq("request_id", requestId)
    .order("created_at", { ascending: true });
  if (error) throw traducirError(error);
  return data ?? [];
}
