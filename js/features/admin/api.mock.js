// Simulado en memoria de api.js de administración (CU-08). Misma forma de respuesta y de errores que el real.
// La sesión es la compartida de requests/simulacion.js (cliente por defecto): para actuar como admin usa
// `fijarSesionSimulada({ rol: "admin" })`. `reiniciarSimulacion()` de este módulo ya deja la sesión como admin activo.
import { ApiError } from "../../lib/apiError.js";
import { exigirUuid } from "../requests/validar.js";
import { UID_ARTESANO, UID_CLIENTE, estado, notificar, reiniciarSimulacion as reiniciarSesion } from "../requests/simulacion.js";
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

export { fijarSesionSimulada } from "../requests/simulacion.js";

export const UID_ADMIN = "00000000-0000-4000-8000-0000000000ad";
export const UID_ADMIN2 = "00000000-0000-4000-8000-0000000000ae";
export const UID_ARTESANO2 = "00000000-0000-4000-8000-000000000003";
export const UID_SIN_ROL = "00000000-0000-4000-8000-0000000000e2";
const ID_T1 = "00000000-0000-4000-8000-0000000000a1";
const ID_T2 = "00000000-0000-4000-8000-0000000000a2";
const ID_T3 = "00000000-0000-4000-8000-0000000000a3";

/**
 * @typedef {{ id: string, role: "client" | "craftsman" | "admin" | null, full_name: string, email: string, active: boolean, created_at: string }} UsuarioSim
 * @typedef {{ id: string, owner_id: string, name: string | null, colonia: string | null, services: string[], published: boolean, suspended: boolean, rating_avg: number | null, rating_count: number, created_at: string }} TallerAdminSim
 * @typedef {{ id: string, order_id: string, workshop_id: string, client_id: string, rating: number, tags: string[], comment: string | null, hidden: boolean, created_at: string }} ResenaAdminSim
 * @typedef {{ id: string, client_id: string, workshop_id: string, service_type: "repair" | "cleaning", status: string, submitted_at: string | null, created_at: string, updated_at: string }} SolicitudAdminSim
 * @typedef {{ id: string, request_id: string, client_id: string, workshop_id: string, phase: number, status: string, due_date: string, ready_at: string | null, delivered_at: string | null, created_at: string, updated_at: string }} PedidoAdminSim
 * @typedef {{ id: string, admin_id: string, action: string, target_table: string, target_id: string, details: Record<string, unknown>, created_at: string }} AccionSim
 */

/** @param {number} n @returns {string} uuid simulado con prefijo distinto de los demás simulados */
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "1")}`;
/** @param {number} dia @returns {string} fecha de muestra */
const fecha = (dia) => `2026-10-${String(dia).padStart(2, "0")}T12:00:00.000Z`;

/** @returns {{ usuarios: UsuarioSim[], talleres: TallerAdminSim[], resenas: ResenaAdminSim[], solicitudes: SolicitudAdminSim[], pedidos: PedidoAdminSim[], acciones: AccionSim[] }} */
function datosIniciales() {
  return {
    usuarios: [
      { id: UID_ADMIN, role: "admin", full_name: "Admin Principal", email: "admin@mixanab.test", active: true, created_at: fecha(1) },
      { id: UID_ADMIN2, role: "admin", full_name: "Admin Soporte", email: "soporte@mixanab.test", active: true, created_at: fecha(2) },
      { id: UID_CLIENTE, role: "client", full_name: "Cliente Uno", email: "cliente1@correo.test", active: true, created_at: fecha(3) },
      { id: id(4), role: "client", full_name: "Cliente Dos", email: "cliente2@correo.test", active: true, created_at: fecha(4) },
      { id: UID_ARTESANO, role: "craftsman", full_name: "Artesano Uno", email: "artesano1@correo.test", active: true, created_at: fecha(5) },
      { id: UID_ARTESANO2, role: "craftsman", full_name: "Artesano Dos", email: "artesano2@correo.test", active: true, created_at: fecha(6) },
      { id: UID_SIN_ROL, role: null, full_name: "", email: "nuevo@correo.test", active: true, created_at: fecha(7) },
    ],
    talleres: [
      { id: ID_T1, owner_id: UID_ARTESANO, name: "Calzado El Buen Paso", colonia: "Centro", services: ["repair", "cleaning"], published: true, suspended: false, rating_avg: 4.5, rating_count: 2, created_at: fecha(10) },
      { id: ID_T2, owner_id: UID_ARTESANO2, name: "Talabartería Yucatán", colonia: "García Ginerés", services: ["repair"], published: true, suspended: false, rating_avg: 3, rating_count: 1, created_at: fecha(11) },
      { id: ID_T3, owner_id: id(40), name: null, colonia: null, services: [], published: false, suspended: false, rating_avg: null, rating_count: 0, created_at: fecha(12) },
    ],
    resenas: [
      { id: id(50), order_id: id(70), workshop_id: ID_T1, client_id: UID_CLIENTE, rating: 5, tags: ["Puntual"], comment: "Excelente", hidden: false, created_at: fecha(20) },
      { id: id(51), order_id: id(71), workshop_id: ID_T1, client_id: id(4), rating: 4, tags: [], comment: null, hidden: false, created_at: fecha(21) },
      { id: id(52), order_id: id(72), workshop_id: ID_T2, client_id: UID_CLIENTE, rating: 3, tags: [], comment: "Regular", hidden: false, created_at: fecha(22) },
    ],
    solicitudes: [
      { id: id(60), client_id: UID_CLIENTE, workshop_id: ID_T1, service_type: "repair", status: "open", submitted_at: fecha(15), created_at: fecha(15), updated_at: fecha(15) },
      { id: id(61), client_id: id(4), workshop_id: ID_T1, service_type: "cleaning", status: "quoted", submitted_at: fecha(16), created_at: fecha(16), updated_at: fecha(17) },
      { id: id(62), client_id: UID_CLIENTE, workshop_id: ID_T2, service_type: "repair", status: "accepted", submitted_at: fecha(17), created_at: fecha(17), updated_at: fecha(18) },
      { id: id(63), client_id: id(4), workshop_id: ID_T2, service_type: "repair", status: "cancelled", submitted_at: fecha(18), created_at: fecha(18), updated_at: fecha(19) },
    ],
    pedidos: [
      { id: id(70), request_id: id(62), client_id: UID_CLIENTE, workshop_id: ID_T2, phase: 4, status: "delivered", due_date: "2026-10-25", ready_at: fecha(23), delivered_at: fecha(24), created_at: fecha(19), updated_at: fecha(24) },
      { id: id(71), request_id: id(61), client_id: id(4), workshop_id: ID_T1, phase: 2, status: "in_progress", due_date: "2026-11-02", ready_at: null, delivered_at: null, created_at: fecha(20), updated_at: fecha(21) },
      { id: id(72), request_id: id(60), client_id: UID_CLIENTE, workshop_id: ID_T1, phase: 4, status: "ready", due_date: "2026-11-05", ready_at: fecha(25), delivered_at: null, created_at: fecha(21), updated_at: fecha(25) },
    ],
    acciones: [],
  };
}

let datos = datosIniciales();
let secuencia = 0;

/** Reinicia el estado (para pruebas). La sesión queda como la de un admin activo. */
export function reiniciarSimulacion() {
  reiniciarSesion();
  estado.rol = "admin";
  datos = datosIniciales();
  secuencia = 0;
}

/**
 * Sustituye los datos simulados (para pruebas).
 * @param {Partial<ReturnType<typeof datosIniciales>>} cambios
 */
export function fijarDatosSimulados(cambios) {
  Object.assign(datos, cambios);
}

/** @returns {ReturnType<typeof datosIniciales>} datos simulados (solo para pruebas) */
export function datosSimulados() {
  return datos;
}

/** Admin activo con sesión (igual que `private.assert_admin`). @returns {string} id del admin */
function exigirAdmin() {
  if (!estado.sesion) throw new ApiError("not_authenticated");
  if (!estado.activo) throw new ApiError("inactive_user");
  if (estado.rol !== "admin") throw new ApiError("forbidden");
  return UID_ADMIN;
}

/**
 * Registra la acción en la bitácora (igual que `private.log_admin_action`).
 * @param {string} accion
 * @param {string} tabla
 * @param {string} objetivo
 * @param {Record<string, unknown>} detalles
 */
function registrar(accion, tabla, objetivo, detalles) {
  secuencia += 1;
  datos.acciones.push({
    id: id(900 + secuencia),
    admin_id: UID_ADMIN,
    action: accion,
    target_table: tabla,
    target_id: objetivo,
    details: detalles,
    created_at: new Date().toISOString(),
  });
}

/**
 * @template T
 * @param {T[]} filas
 * @param {{ p_limit: number, p_offset: number }} pagina
 * @returns {{ total: number, items: T[] }}
 */
function paginar(filas, pagina) {
  return { total: filas.length, items: filas.slice(pagina.p_offset, pagina.p_offset + pagina.p_limit) };
}

/** @param {{ created_at: string }} a @param {{ created_at: string }} b */
const masReciente = (a, b) => b.created_at.localeCompare(a.created_at);

/** @param {string} texto @param {(string | null)[]} campos */
const coincide = (texto, campos) => campos.some((c) => (c ?? "").toLowerCase().includes(texto.toLowerCase()));

/** @param {string} idTaller */
const nombreTaller = (idTaller) => datos.talleres.find((t) => t.id === idTaller)?.name ?? null;

export async function getDashboard() {
  exigirAdmin();
  const u = datos.usuarios;
  const t = datos.talleres;
  const r = datos.solicitudes.filter((s) => s.status !== "draft");
  const p = datos.pedidos;
  const visibles = datos.resenas.filter((x) => !x.hidden);
  return {
    users: {
      total: u.length,
      active: u.filter((x) => x.active).length,
      clients: u.filter((x) => x.role === "client").length,
      craftsmen: u.filter((x) => x.role === "craftsman").length,
      admins: u.filter((x) => x.role === "admin").length,
      without_role: u.filter((x) => x.role === null).length,
    },
    workshops: { total: t.length, published: t.filter((x) => x.published && !x.suspended).length, suspended: t.filter((x) => x.suspended).length },
    requests: {
      total: r.length,
      open: r.filter((x) => x.status === "open").length,
      quoted: r.filter((x) => x.status === "quoted").length,
      accepted: r.filter((x) => x.status === "accepted").length,
      cancelled: r.filter((x) => x.status === "cancelled").length,
    },
    orders: {
      total: p.length,
      in_progress: p.filter((x) => x.status === "in_progress").length,
      ready: p.filter((x) => x.status === "ready").length,
      delivered: p.filter((x) => x.status === "delivered").length,
      cancelled: p.filter((x) => x.status === "cancelled").length,
    },
    reviews: {
      count: visibles.length,
      rating_avg: visibles.length === 0 ? null : Math.round((visibles.reduce((s, x) => s + x.rating, 0) / visibles.length) * 10) / 10,
    },
  };
}

/** @param {{ search?: string, role?: string, active?: boolean, limit?: number, offset?: number }} [filtros] */
export async function listUsers(filtros) {
  const f = exigirFiltros(filtros);
  const busqueda = validarBusqueda(f.search);
  const rol = validarOpcionDeLista(f.role, ROLES);
  const activo = validarBooleanoOpcional(f.active, "active");
  const pagina = validarPagina(f);
  exigirAdmin();
  const filas = datos.usuarios
    .filter((x) => busqueda === null || coincide(busqueda, [x.full_name, x.email]))
    .filter((x) => rol === null || x.role === rol)
    .filter((x) => activo === null || x.active === activo)
    .sort(masReciente);
  return paginar(filas.map((x) => ({ ...x })), pagina);
}

/**
 * @param {string} userId
 * @param {boolean} active
 * @param {string} [reason]
 */
export async function setUserActive(userId, active, reason) {
  exigirUuid(userId);
  if (typeof active !== "boolean") throw new ApiError("invalid_input");
  const motivo = validarMotivo(reason);
  const admin = exigirAdmin();
  const objetivo = datos.usuarios.find((x) => x.id === userId);
  if (!objetivo) throw new ApiError("not_found");
  if (!active && userId === admin) throw new ApiError("forbidden"); // A1: no puede desactivarse a sí mismo
  if (objetivo.active === active) throw new ApiError("invalid_state");

  const previo = objetivo.active;
  objetivo.active = active;
  if (datos.usuarios.filter((x) => x.role === "admin" && x.active).length === 0) {
    objetivo.active = previo; // A1: siempre queda al menos un admin activo (se revierte)
    throw new ApiError("invalid_state");
  }
  registrar(active ? "user_reactivated" : "user_deactivated", "profiles", userId, { role: objetivo.role, previous_active: previo, reason: motivo });
  return { id: userId, active };
}

/** @param {{ search?: string, published?: boolean, suspended?: boolean, limit?: number, offset?: number }} [filtros] */
export async function listWorkshops(filtros) {
  const f = exigirFiltros(filtros);
  const busqueda = validarBusqueda(f.search);
  const publicado = validarBooleanoOpcional(f.published, "published");
  const suspendido = validarBooleanoOpcional(f.suspended, "suspended");
  const pagina = validarPagina(f);
  exigirAdmin();
  const dueno = (/** @type {string} */ idDueno) => datos.usuarios.find((x) => x.id === idDueno)?.full_name ?? "";
  const filas = datos.talleres
    .filter((x) => busqueda === null || coincide(busqueda, [x.name, x.colonia, dueno(x.owner_id)]))
    .filter((x) => publicado === null || x.published === publicado)
    .filter((x) => suspendido === null || x.suspended === suspendido)
    .sort(masReciente);
  return paginar(
    filas.map((x) => ({ id: x.id, owner_id: x.owner_id, owner_name: dueno(x.owner_id), name: x.name, colonia: x.colonia, services: [...x.services], published: x.published, suspended: x.suspended, rating_avg: x.rating_avg, rating_count: x.rating_count, created_at: x.created_at })),
    pagina,
  );
}

/**
 * @param {string} workshopId
 * @param {boolean} suspended
 * @param {string} [reason]
 */
export async function setWorkshopSuspended(workshopId, suspended, reason) {
  exigirUuid(workshopId);
  if (typeof suspended !== "boolean") throw new ApiError("invalid_input");
  const motivo = validarMotivo(reason);
  exigirAdmin();
  const taller = datos.talleres.find((x) => x.id === workshopId);
  if (!taller) throw new ApiError("not_found");
  if (taller.suspended === suspended) throw new ApiError("invalid_state");
  taller.suspended = suspended;
  registrar(suspended ? "workshop_suspended" : "workshop_reactivated", "workshops", workshopId, { owner_id: taller.owner_id, published: taller.published, reason: motivo });
  notificar(taller.owner_id, suspended ? "workshop_suspended" : "workshop_reactivated", { workshop_id: workshopId });
  return { id: workshopId, suspended };
}

/** @param {{ workshop_id?: string, hidden?: boolean, limit?: number, offset?: number }} [filtros] */
export async function listReviews(filtros) {
  const f = exigirFiltros(filtros);
  const taller = validarUuidOpcional(f.workshop_id);
  const oculta = validarBooleanoOpcional(f.hidden, "hidden");
  const pagina = validarPagina(f);
  exigirAdmin();
  const filas = datos.resenas
    .filter((x) => taller === null || x.workshop_id === taller)
    .filter((x) => oculta === null || x.hidden === oculta)
    .sort(masReciente);
  return paginar(filas.map((x) => ({ ...x, workshop_name: nombreTaller(x.workshop_id), tags: [...x.tags] })), pagina);
}

/**
 * Oculta o restaura una reseña y recalcula el promedio del taller sobre las no ocultas.
 * @param {string} reviewId
 * @param {boolean} hidden
 * @param {string} [reason]
 */
export async function setReviewHidden(reviewId, hidden, reason) {
  exigirUuid(reviewId);
  if (typeof hidden !== "boolean") throw new ApiError("invalid_input");
  const motivo = validarMotivo(reason);
  exigirAdmin();
  const resena = datos.resenas.find((x) => x.id === reviewId);
  if (!resena) throw new ApiError("not_found");
  if (resena.hidden === hidden) throw new ApiError("invalid_state");
  resena.hidden = hidden;

  const taller = /** @type {TallerAdminSim} */ (datos.talleres.find((x) => x.id === resena.workshop_id));
  const visibles = datos.resenas.filter((x) => x.workshop_id === taller.id && !x.hidden);
  taller.rating_count = visibles.length;
  taller.rating_avg = visibles.length === 0 ? null : Math.round((visibles.reduce((s, x) => s + x.rating, 0) / visibles.length) * 10) / 10;

  registrar(hidden ? "review_hidden" : "review_restored", "reviews", reviewId, { workshop_id: resena.workshop_id, rating: resena.rating, reason: motivo });
  return { id: reviewId, hidden, workshop_id: taller.id, rating_avg: taller.rating_avg, rating_count: taller.rating_count };
}

/** @param {{ status?: string, limit?: number, offset?: number }} [filtros] */
export async function listRequests(filtros) {
  const f = exigirFiltros(filtros);
  const estadoFiltro = validarOpcionDeLista(f.status, ESTADOS_SOLICITUD);
  const pagina = validarPagina(f);
  exigirAdmin();
  const filas = datos.solicitudes.filter((x) => x.status !== "draft").filter((x) => estadoFiltro === null || x.status === estadoFiltro).sort(masReciente);
  return paginar(filas.map((x) => ({ ...x, workshop_name: nombreTaller(x.workshop_id) })), pagina);
}

/** @param {{ status?: string, limit?: number, offset?: number }} [filtros] */
export async function listOrders(filtros) {
  const f = exigirFiltros(filtros);
  const estadoFiltro = validarOpcionDeLista(f.status, ESTADOS_PEDIDO);
  const pagina = validarPagina(f);
  exigirAdmin();
  const filas = datos.pedidos.filter((x) => estadoFiltro === null || x.status === estadoFiltro).sort(masReciente);
  return paginar(filas.map((x) => ({ ...x, workshop_name: nombreTaller(x.workshop_id) })), pagina);
}

/** @param {{ admin_id?: string, action?: string, limit?: number, offset?: number }} [filtros] */
export async function listActions(filtros) {
  const f = exigirFiltros(filtros);
  const admin = validarUuidOpcional(f.admin_id);
  const accion = validarBusqueda(f.action);
  const pagina = validarPagina(f);
  exigirAdmin();
  const filas = datos.acciones
    .filter((x) => admin === null || x.admin_id === admin)
    .filter((x) => accion === null || x.action === accion)
    .reverse() // más reciente primero (a igual fecha, la última registrada)
    .sort(masReciente);
  const nombre = (/** @type {string} */ idAdmin) => datos.usuarios.find((x) => x.id === idAdmin)?.full_name ?? "";
  return paginar(filas.map((x) => ({ ...x, admin_name: nombre(x.admin_id), details: { ...x.details } })), pagina);
}
