// Única capa que toca Supabase para la administración (CU-08). Contrato: docs/contrato-api.md.
// api.mock.js debe tener las mismas funciones, respuestas y errores. Todo pasa por funciones `admin_*` de la base.
import { obtenerCliente } from "../../supabaseClient.js";
import { ApiError, traducirError } from "../../lib/apiError.js";
import { exigirUuid } from "../requests/validar.js";
import {
  ESTADOS_PEDIDO,
  ESTADOS_SOLICITUD,
  ROLES,
  exigirFiltros,
  validarBooleanoOpcional,
  validarBusqueda,
  validarMotivo,
  validarOpcionDeLista,
  validarPagina,
  validarUuidOpcional,
} from "./validar.js";

/**
 * @typedef {{ users: { total: number, active: number, clients: number, craftsmen: number, admins: number, without_role: number }, workshops: { total: number, published: number, suspended: number }, requests: { total: number, open: number, quoted: number, accepted: number, cancelled: number }, orders: { total: number, in_progress: number, ready: number, delivered: number, cancelled: number }, reviews: { count: number, rating_avg: number | null } }} Panel
 * @typedef {{ id: string, role: "client" | "craftsman" | "admin" | null, full_name: string, email: string, active: boolean, created_at: string }} UsuarioAdmin
 * @typedef {{ id: string, owner_id: string, owner_name: string, name: string | null, colonia: string | null, services: string[], published: boolean, suspended: boolean, rating_avg: number | null, rating_count: number, created_at: string }} TallerAdmin
 * @typedef {{ id: string, order_id: string, workshop_id: string, workshop_name: string | null, client_id: string, rating: number, tags: string[], comment: string | null, hidden: boolean, created_at: string }} ResenaAdmin
 * @typedef {{ id: string, client_id: string, workshop_id: string, workshop_name: string | null, service_type: "repair" | "cleaning", status: string, submitted_at: string | null, created_at: string, updated_at: string }} SolicitudAdmin
 * @typedef {{ id: string, request_id: string, client_id: string, workshop_id: string, workshop_name: string | null, phase: number, status: string, due_date: string, ready_at: string | null, delivered_at: string | null, created_at: string, updated_at: string }} PedidoAdmin
 * @typedef {{ id: string, admin_id: string, admin_name: string, action: string, target_table: string, target_id: string, details: Record<string, unknown>, created_at: string }} AccionAdmin
 */

/**
 * @template T
 * @typedef {{ total: number, items: T[] }} Pagina
 */

/**
 * Llama a una función `admin_*` y traduce el error al contrato.
 * @param {string} funcion
 * @param {Record<string, unknown>} [parametros]
 * @returns {Promise<any>}
 */
async function llamar(funcion, parametros = {}) {
  const { data, error } = await obtenerCliente().rpc(funcion, parametros);
  if (error) throw traducirError(error);
  return data;
}

/** @returns {Promise<Panel>} totales de usuarios, talleres, solicitudes (sin borradores), pedidos y reseñas */
export async function getDashboard() {
  return llamar("admin_dashboard");
}

/**
 * Lista y busca usuarios por nombre o correo. No incluye datos privados del cliente (edad, dirección).
 * @param {{ search?: string, role?: "client" | "craftsman" | "admin", active?: boolean, limit?: number, offset?: number }} [filtros]
 * @returns {Promise<Pagina<UsuarioAdmin>>}
 */
export async function listUsers(filtros) {
  const f = exigirFiltros(filtros);
  return llamar("admin_list_users", {
    p_search: validarBusqueda(f.search),
    p_role: validarOpcionDeLista(f.role, ROLES),
    p_active: validarBooleanoOpcional(f.active, "active"),
    ...validarPagina(f),
  });
}

/**
 * Desactiva o reactiva un usuario (no se eliminan). A1: no puede desactivarse a sí mismo (`forbidden`) y siempre
 * queda al menos un admin activo (`invalid_state`).
 * @param {string} userId
 * @param {boolean} active
 * @param {string} [reason] motivo opcional (máximo 300), queda en la bitácora
 * @returns {Promise<{ id: string, active: boolean }>}
 */
export async function setUserActive(userId, active, reason) {
  exigirUuid(userId);
  if (typeof active !== "boolean") throw new ApiError("invalid_input");
  return llamar("admin_set_user_active", { p_user_id: userId, p_active: active, p_reason: validarMotivo(reason) });
}

/**
 * @param {{ search?: string, published?: boolean, suspended?: boolean, limit?: number, offset?: number }} [filtros]
 * @returns {Promise<Pagina<TallerAdmin>>}
 */
export async function listWorkshops(filtros) {
  const f = exigirFiltros(filtros);
  return llamar("admin_list_workshops", {
    p_search: validarBusqueda(f.search),
    p_published: validarBooleanoOpcional(f.published, "published"),
    p_suspended: validarBooleanoOpcional(f.suspended, "suspended"),
    ...validarPagina(f),
  });
}

/**
 * Suspende (sale del mapa) o reactiva un taller y avisa a su dueño.
 * @param {string} workshopId
 * @param {boolean} suspended
 * @param {string} [reason]
 * @returns {Promise<{ id: string, suspended: boolean }>}
 */
export async function setWorkshopSuspended(workshopId, suspended, reason) {
  exigirUuid(workshopId);
  if (typeof suspended !== "boolean") throw new ApiError("invalid_input");
  return llamar("admin_set_workshop_suspended", { p_workshop_id: workshopId, p_suspended: suspended, p_reason: validarMotivo(reason) });
}

/**
 * @param {{ workshop_id?: string, hidden?: boolean, limit?: number, offset?: number }} [filtros]
 * @returns {Promise<Pagina<ResenaAdmin>>}
 */
export async function listReviews(filtros) {
  const f = exigirFiltros(filtros);
  return llamar("admin_list_reviews", {
    p_workshop_id: validarUuidOpcional(f.workshop_id),
    p_hidden: validarBooleanoOpcional(f.hidden, "hidden"),
    ...validarPagina(f),
  });
}

/**
 * Oculta o restaura una reseña; el promedio del taller se recalcula sobre las no ocultas.
 * @param {string} reviewId
 * @param {boolean} hidden
 * @param {string} [reason]
 * @returns {Promise<{ id: string, hidden: boolean, workshop_id: string, rating_avg: number | null, rating_count: number }>}
 */
export async function setReviewHidden(reviewId, hidden, reason) {
  exigirUuid(reviewId);
  if (typeof hidden !== "boolean") throw new ApiError("invalid_input");
  return llamar("admin_set_review_hidden", { p_review_id: reviewId, p_hidden: hidden, p_reason: validarMotivo(reason) });
}

/**
 * Solicitudes de solo lectura (sin borradores): estatus y fechas. Sin descripción, fotos ni chat.
 * @param {{ status?: "open" | "quoted" | "accepted" | "declined" | "cancelled", limit?: number, offset?: number }} [filtros]
 * @returns {Promise<Pagina<SolicitudAdmin>>}
 */
export async function listRequests(filtros) {
  const f = exigirFiltros(filtros);
  return llamar("admin_list_requests", { p_status: validarOpcionDeLista(f.status, ESTADOS_SOLICITUD), ...validarPagina(f) });
}

/**
 * Pedidos de solo lectura: fase, estatus y fechas. Sin montos, fotos de avance ni PIN.
 * @param {{ status?: "in_progress" | "ready" | "delivered" | "cancelled", limit?: number, offset?: number }} [filtros]
 * @returns {Promise<Pagina<PedidoAdmin>>}
 */
export async function listOrders(filtros) {
  const f = exigirFiltros(filtros);
  return llamar("admin_list_orders", { p_status: validarOpcionDeLista(f.status, ESTADOS_PEDIDO), ...validarPagina(f) });
}

/**
 * Bitácora del admin, de la más reciente a la más antigua.
 * @param {{ admin_id?: string, action?: string, limit?: number, offset?: number }} [filtros]
 * @returns {Promise<Pagina<AccionAdmin>>}
 */
export async function listActions(filtros) {
  const f = exigirFiltros(filtros);
  const accion = validarBusqueda(f.action);
  if (accion !== null && accion.length > 50) throw new ApiError("invalid_input");
  return llamar("admin_list_actions", { p_admin_id: validarUuidOpcional(f.admin_id), p_action: accion, ...validarPagina(f) });
}
