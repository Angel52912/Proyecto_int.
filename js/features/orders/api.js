// Única capa que toca Supabase para órdenes de trabajo (CU-04: solo lectura; CU-05 y CU-06 agregan fases y entrega).
// Contrato: docs/contrato-api.md. api.mock.js debe tener las mismas funciones, respuestas y errores.
import { obtenerCliente } from "../../supabaseClient.js";
import { ApiError, traducirError } from "../../lib/apiError.js";
import { exigirUuid } from "../requests/validar.js";

// Sin delivery_pin_hash, pin_attempts ni pin_locked_until: la base de datos no los concede.
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
