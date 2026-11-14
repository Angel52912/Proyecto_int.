// Simulado en memoria de api.js (CU-01). Misma forma de respuesta y de errores que el real.
// Código de verificación válido en el simulado: CODIGO_SIMULADO. No usa red ni Supabase.
import { ApiError } from "../../lib/apiError.js";
import { validarCodigo, validarCorreo } from "../../lib/validate.js";

export const CODIGO_SIMULADO = "123456";
const ROLES_ELEGIBLES = /** @type {ReadonlyArray<string>} */ (["client", "craftsman"]);

/** @type {{ uid: string | null, perfil: any, privados: any, correoPendiente: string | null }} */
let estado = estadoInicial();

/** @returns {typeof estado} */
function estadoInicial() {
  return { uid: null, perfil: null, privados: null, correoPendiente: null };
}

/** Reinicia el estado (para pruebas). */
export function reiniciarSimulacion() {
  estado = estadoInicial();
}

/** @returns {string} */
function exigirSesion() {
  if (!estado.uid) throw new ApiError("not_authenticated");
  return estado.uid;
}

/** @returns {Promise<void>} */
export async function signInWithGoogle() {
  iniciarSesion();
}

/** @param {string} email */
export async function signInWithEmail(email) {
  if (!validarCorreo(email)) throw new ApiError("invalid_input");
  estado.correoPendiente = email;
  return { sent: /** @type {const} */ (true) };
}

/**
 * @param {string} email
 * @param {string} code
 */
export async function verifyEmailCode(email, code) {
  if (!validarCorreo(email) || !validarCodigo(code)) throw new ApiError("invalid_input");
  if (estado.correoPendiente !== email || code !== CODIGO_SIMULADO) throw new ApiError("invalid_code");
  estado.correoPendiente = null;
  iniciarSesion();
  return { session: { user_id: /** @type {string} */ (estado.uid) } };
}

/** @param {string} email */
export async function resendEmailCode(email) {
  return signInWithEmail(email);
}

/** Crea la sesión y el perfil sin rol (igual que el trigger real). */
function iniciarSesion() {
  estado.uid ??= "00000000-0000-4000-8000-000000000001";
  estado.perfil ??= { id: estado.uid, role: null, full_name: "", avatar_path: null, active: true };
}

export async function getMyProfile() {
  exigirSesion();
  return { ...estado.perfil };
}

/** @param {string} role */
export async function setMyRole(role) {
  exigirSesion();
  if (!ROLES_ELEGIBLES.includes(role)) throw new ApiError("invalid_input");
  if (!estado.perfil.active) throw new ApiError("inactive_user");
  if (estado.perfil.role !== null) throw new ApiError("role_already_set");
  estado.perfil.role = role;
  return { role };
}

/** @param {{ full_name?: string, avatar_path?: string }} cambios */
export async function updateMyProfile(cambios) {
  exigirSesion();
  /** @type {{ full_name?: string, avatar_path?: string }} */
  const fila = {};
  if (cambios.full_name !== undefined) {
    const nombre = typeof cambios.full_name === "string" ? cambios.full_name.trim() : "";
    if (nombre.length < 1 || nombre.length > 100) throw new ApiError("invalid_input");
    fila.full_name = nombre;
  }
  if (cambios.avatar_path !== undefined) {
    if (typeof cambios.avatar_path !== "string" || cambios.avatar_path.length < 1 || cambios.avatar_path.length > 300) {
      throw new ApiError("invalid_input");
    }
    fila.avatar_path = cambios.avatar_path;
  }
  if (Object.keys(fila).length === 0) throw new ApiError("invalid_input");
  if (!estado.perfil.active || !ROLES_ELEGIBLES.includes(estado.perfil.role)) throw new ApiError("forbidden");
  Object.assign(estado.perfil, fila);
  return { ...estado.perfil };
}

export async function getMyClientPrivate() {
  exigirSesion();
  return estado.perfil.role === "client" && estado.privados ? { ...estado.privados } : null;
}

/** @param {{ age: number, address: string }} datos */
export async function saveMyClientPrivate(datos) {
  const uid = exigirSesion();
  const direccion = typeof datos.address === "string" ? datos.address.trim() : "";
  if (!Number.isInteger(datos.age) || datos.age < 1 || datos.age > 120) throw new ApiError("invalid_input");
  if (direccion.length < 1 || direccion.length > 300) throw new ApiError("invalid_input");
  if (estado.perfil.role !== "client" || !estado.perfil.active) throw new ApiError("forbidden");
  estado.privados = { user_id: uid, age: datos.age, address: direccion };
  return { ...estado.privados };
}

export async function signOut() {
  estado.uid = null;
  estado.perfil = null;
  estado.privados = null;
  estado.correoPendiente = null;
}
