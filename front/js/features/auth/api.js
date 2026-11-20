// Única capa que toca Supabase para acceso, rol y perfil (CU-01). Contrato: docs/contrato-api.md.
// api.mock.js debe tener las mismas funciones, respuestas y errores.
import { obtenerCliente } from "../../supabaseClient.js";
import { ApiError, traducirError } from "../../lib/apiError.js";
import { validarCodigo, validarCorreo, validarImagen } from "../../lib/validate.js";

import { esRutaAvatar } from "./validar.js";

const BUCKET_AVATARES = "avatars";
const SEGUNDOS_URL_FIRMADA = 3600;
const COLUMNAS_PERFIL = "id, role, full_name, avatar_path, active";
const ROLES_ELEGIBLES = /** @type {ReadonlyArray<string>} */ (["client", "craftsman"]);

/**
 * @typedef {{ id: string, role: "client" | "craftsman" | "admin" | null, full_name: string, avatar_path: string | null, active: boolean }} Perfil
 * @typedef {{ user_id: string, age: number | null, address: string | null }} DatosPrivadosCliente
 * @typedef {{ path: string, url: string }} FotoPerfil
 */

/**
 * Id del usuario con sesión; lanza not_authenticated si no hay.
 * @returns {Promise<string>}
 */
async function obtenerUid() {
  const { data, error } = await obtenerCliente().auth.getSession();
  if (error) throw traducirError(error);
  const uid = data?.session?.user?.id;
  if (!uid) throw new ApiError("not_authenticated");
  return uid;
}

/** @returns {Promise<void>} */
export async function signInWithGoogle() {
  const { error } = await obtenerCliente().auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${globalThis.location.origin}${globalThis.location.pathname}` },
  });
  if (error) throw traducirError(error, "auth_failed");
}

/**
 * Envía el código de 6 dígitos. La respuesta es igual exista o no el correo.
 * @param {string} email
 * @returns {Promise<{ sent: true }>}
 */
export async function signInWithEmail(email) {
  if (!validarCorreo(email)) throw new ApiError("invalid_input");
  const { error } = await obtenerCliente().auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
  if (error) throw traducirError(error, "auth_failed");
  return { sent: true };
}

/**
 * @param {string} email
 * @param {string} code 6 dígitos
 * @returns {Promise<{ session: { user_id: string } }>}
 */
export async function verifyEmailCode(email, code) {
  if (!validarCorreo(email) || !validarCodigo(code)) throw new ApiError("invalid_input");
  const { data, error } = await obtenerCliente().auth.verifyOtp({ email, token: code, type: "email" });
  if (error) throw traducirError(error, "invalid_code");
  const uid = data?.user?.id ?? data?.session?.user?.id;
  if (!uid) throw new ApiError("invalid_code");
  return { session: { user_id: uid } };
}

/**
 * @param {string} email
 * @returns {Promise<{ sent: true }>}
 */
export async function resendEmailCode(email) {
  return signInWithEmail(email);
}

/** @returns {Promise<Perfil>} */
export async function getMyProfile() {
  const uid = await obtenerUid();
  const { data, error } = await obtenerCliente().from("profiles").select(COLUMNAS_PERFIL).eq("id", uid).maybeSingle();
  if (error) throw traducirError(error);
  if (!data) throw new ApiError("not_found");
  return data;
}

/**
 * Elige el rol una sola vez (RPC `set_my_role`). Solo `client` o `craftsman`.
 * @param {string} role
 * @returns {Promise<{ role: "client" | "craftsman" }>}
 */
export async function setMyRole(role) {
  if (!ROLES_ELEGIBLES.includes(role)) throw new ApiError("invalid_input");
  const { data, error } = await obtenerCliente().rpc("set_my_role", { p_role: role });
  if (error) throw traducirError(error);
  return { role: data };
}

/**
 * @param {{ full_name?: string, avatar_path?: string }} cambios
 * @returns {Promise<Perfil>}
 */
export async function updateMyProfile(cambios) {
  const uid = await obtenerUid();
  /** @type {{ full_name?: string, avatar_path?: string }} */
  const fila = {};
  if (cambios.full_name !== undefined) {
    const nombre = typeof cambios.full_name === "string" ? cambios.full_name.trim() : "";
    if (nombre.length < 1 || nombre.length > 100) throw new ApiError("invalid_input");
    fila.full_name = nombre;
  }
  if (cambios.avatar_path !== undefined) {
    if (!esRutaAvatar(cambios.avatar_path) || !cambios.avatar_path?.startsWith(`${uid}/`)) throw new ApiError("invalid_input");
    fila.avatar_path = cambios.avatar_path;
  }
  if (Object.keys(fila).length === 0) throw new ApiError("invalid_input");
  const { data, error } = await obtenerCliente().from("profiles").update(fila).eq("id", uid).select(COLUMNAS_PERFIL).maybeSingle();
  if (error) throw traducirError(error);
  if (!data) throw new ApiError("forbidden"); // RLS: sin rol, admin o cuenta desactivada
  return data;
}

/**
 * Sube la foto de perfil al bucket privado `avatars` ({uid}/{uuid}) y la guarda en el perfil. Reemplaza a la anterior
 * (se borran los archivos viejos de la carpeta). Solo cliente o artesano activo.
 * @param {{ type: string, size: number }} archivo imagen jpeg, png o webp de hasta 5 MB
 * @returns {Promise<FotoPerfil>}
 */
export async function addAvatar(archivo) {
  if (!archivo || !validarImagen(archivo).valido) throw new ApiError("invalid_input");
  const uid = await obtenerUid();
  const cliente = obtenerCliente();
  const perfil = await getMyProfile();

  // Limpia lo que haya quedado en la carpeta (la política limita a 3 archivos por usuario).
  const { data: existentes, error: errorLista } = await cliente.storage.from(BUCKET_AVATARES).list(uid);
  if (errorLista) throw traducirError(errorLista);
  const viejos = (existentes ?? []).map((f) => `${uid}/${f.name}`).filter((ruta) => ruta !== perfil.avatar_path);
  if (viejos.length > 0) await cliente.storage.from(BUCKET_AVATARES).remove(viejos);

  const path = `${uid}/${globalThis.crypto.randomUUID()}`;
  const subida = await cliente.storage.from(BUCKET_AVATARES).upload(path, /** @type {File} */ (archivo), { contentType: archivo.type, upsert: false });
  if (subida.error) throw traducirError(subida.error);

  const { data, error } = await cliente.from("profiles").update({ avatar_path: path }).eq("id", uid).select(COLUMNAS_PERFIL).maybeSingle();
  if (error || !data) {
    await cliente.storage.from(BUCKET_AVATARES).remove([path]); // no deja archivos huérfanos
    throw error ? traducirError(error) : new ApiError("forbidden"); // RLS: sin rol, admin o cuenta desactivada
  }
  if (perfil.avatar_path) await cliente.storage.from(BUCKET_AVATARES).remove([perfil.avatar_path]);
  return { path, url: await urlFirmada(path) };
}

/**
 * Quita la foto de perfil propia (ruta y archivo). No falla si no había.
 * @returns {Promise<Perfil>}
 */
export async function removeAvatar() {
  const uid = await obtenerUid();
  const cliente = obtenerCliente();
  const perfil = await getMyProfile();
  const { data, error } = await cliente.from("profiles").update({ avatar_path: null }).eq("id", uid).select(COLUMNAS_PERFIL).maybeSingle();
  if (error) throw traducirError(error);
  if (!data) throw new ApiError("forbidden");
  if (perfil.avatar_path) await cliente.storage.from(BUCKET_AVATARES).remove([perfil.avatar_path]);
  return data;
}

/**
 * URL firmada (1 h) de una foto de perfil: la propia o la de la contraparte con la que se comparte una solicitud.
 * @param {string} avatarPath ruta `{uid}/{uuid}` (la trae `Perfil.avatar_path` o `Contraparte.avatar_path`)
 * @returns {Promise<string>}
 */
export async function getAvatarUrl(avatarPath) {
  if (!esRutaAvatar(avatarPath)) throw new ApiError("invalid_input");
  await obtenerUid();
  return urlFirmada(avatarPath);
}

/**
 * @param {string} path
 * @returns {Promise<string>}
 */
async function urlFirmada(path) {
  const { data, error } = await obtenerCliente().storage.from(BUCKET_AVATARES).createSignedUrl(path, SEGUNDOS_URL_FIRMADA);
  if (error) throw traducirError(error);
  return data.signedUrl;
}

/** @returns {Promise<DatosPrivadosCliente | null>} `null` si aún no capturó sus datos */
export async function getMyClientPrivate() {
  const uid = await obtenerUid();
  const { data, error } = await obtenerCliente().from("client_private").select("user_id, age, address").eq("user_id", uid).maybeSingle();
  if (error) throw traducirError(error);
  return data;
}

/**
 * @param {{ age: number, address: string }} datos
 * @returns {Promise<DatosPrivadosCliente>}
 */
export async function saveMyClientPrivate(datos) {
  const uid = await obtenerUid();
  const direccion = typeof datos.address === "string" ? datos.address.trim() : "";
  if (!Number.isInteger(datos.age) || datos.age < 1 || datos.age > 120) throw new ApiError("invalid_input");
  if (direccion.length < 1 || direccion.length > 300) throw new ApiError("invalid_input");
  // Sin upsert: PostgREST actualizaría también user_id y la columna no tiene UPDATE concedido.
  const existente = await getMyClientPrivate();
  const tabla = obtenerCliente().from("client_private");
  const consulta = existente
    ? tabla.update({ age: datos.age, address: direccion }).eq("user_id", uid)
    : tabla.insert({ user_id: uid, age: datos.age, address: direccion });
  const { data, error } = await consulta.select("user_id, age, address").maybeSingle();
  if (error) throw traducirError(error);
  if (!data) throw new ApiError("forbidden");
  return data;
}

/** @returns {Promise<void>} */
export async function signOut() {
  const { error } = await obtenerCliente().auth.signOut();
  if (error) throw traducirError(error);
}
