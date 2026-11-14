// Única capa que toca Supabase para el taller del artesano (CU-07). Contrato: docs/contrato-api.md.
// api.mock.js debe tener las mismas funciones, respuestas y errores.
import { obtenerCliente } from "../../supabaseClient.js";
import { ApiError, traducirError } from "../../lib/apiError.js";
import { validarImagen } from "../../lib/validate.js";
import { validarDatosTaller } from "./validar.js";

const BUCKET = "workshop-photos";
const TIPOS_FOTO = /** @type {ReadonlyArray<string>} */ (["profile", "work"]);
const COLUMNAS_TALLER =
  "id, owner_id, name, address, colonia, postal_code, lat, lng, services, hours, price_from, published, suspended, rating_avg, rating_count";

/**
 * @typedef {{ id: string, path: string, kind: "profile" | "work", sort: number, url: string }} FotoTaller
 * @typedef {{ id: string, owner_id: string, name: string | null, address: string | null, colonia: string | null, postal_code: string | null, lat: number | null, lng: number | null, services: string[], hours: import("./validar.js").Horario | null, price_from: number | null, published: boolean, suspended: boolean, rating_avg: number | null, rating_count: number, photos: FotoTaller[] }} Taller
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
 * @param {{ id: string, path: string, kind: "profile" | "work", sort: number }} fila
 * @returns {FotoTaller}
 */
function aFoto(fila) {
  const { data } = obtenerCliente().storage.from(BUCKET).getPublicUrl(fila.path);
  return { id: fila.id, path: fila.path, kind: fila.kind, sort: fila.sort, url: data.publicUrl };
}

/**
 * Taller propio sin fotos, o null.
 * @param {string} uid
 * @returns {Promise<Omit<Taller, "photos"> | null>}
 */
async function leerFilaTaller(uid) {
  const { data, error } = await obtenerCliente().from("workshops").select(COLUMNAS_TALLER).eq("owner_id", uid).maybeSingle();
  if (error) throw traducirError(error);
  return data;
}

/**
 * @param {string} workshopId
 * @returns {Promise<FotoTaller[]>}
 */
async function leerFotos(workshopId) {
  const { data, error } = await obtenerCliente()
    .from("workshop_photos")
    .select("id, path, kind, sort")
    .eq("workshop_id", workshopId)
    .order("sort", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw traducirError(error);
  return (data ?? []).map(aFoto);
}

/** @returns {Promise<Taller | null>} `null` si el artesano aún no crea su taller (o si no es artesano) */
export async function getMyWorkshop() {
  const uid = await obtenerUid();
  const fila = await leerFilaTaller(uid);
  if (!fila) return null;
  return { ...fila, photos: await leerFotos(fila.id) };
}

/**
 * Crea el taller propio o actualiza los campos enviados. Se puede guardar incompleto (borrador).
 * @param {import("./validar.js").DatosTaller} datos
 * @returns {Promise<Taller>}
 */
export async function saveMyWorkshop(datos) {
  const uid = await obtenerUid();
  const fila = validarDatosTaller(datos);
  const existente = await leerFilaTaller(uid);
  const tabla = obtenerCliente().from("workshops");
  const consulta = existente ? tabla.update(fila).eq("id", existente.id) : tabla.insert({ ...fila, owner_id: uid });
  const { data, error } = await consulta.select(COLUMNAS_TALLER).maybeSingle();
  if (error) throw traducirError(error);
  if (!data) throw new ApiError("forbidden"); // RLS: no es artesano activo
  return { ...data, photos: await leerFotos(data.id) };
}

/**
 * Valida y publica el taller en el mapa (RPC `publish_my_workshop`). Si faltan datos no lanza: devuelve `missing`.
 * @returns {Promise<{ published: boolean, missing: string[] }>}
 */
export async function publishMyWorkshop() {
  const { data, error } = await obtenerCliente().rpc("publish_my_workshop");
  if (error) throw traducirError(error);
  return { published: data.published, missing: data.missing };
}

/** @returns {Promise<{ published: false, missing: string[] }>} */
export async function unpublishMyWorkshop() {
  const { data, error } = await obtenerCliente().rpc("unpublish_my_workshop");
  if (error) throw traducirError(error);
  return { published: false, missing: data.missing };
}

/**
 * Sube una foto al bucket público y la registra. La foto de perfil reemplaza a la anterior.
 * @param {{ type: string, size: number }} archivo imagen jpeg, png o webp de hasta 5 MB
 * @param {"profile" | "work"} kind
 * @returns {Promise<FotoTaller>}
 */
export async function addWorkshopPhoto(archivo, kind) {
  if (!TIPOS_FOTO.includes(kind) || !validarImagen(archivo).valido) throw new ApiError("invalid_input");
  const uid = await obtenerUid();
  const taller = await leerFilaTaller(uid);
  if (!taller) throw new ApiError("not_found");
  const fotos = await leerFotos(taller.id);
  const anterior = fotos.find((f) => f.kind === "profile");
  if (kind === "profile" && anterior) await removeWorkshopPhoto(anterior.id);

  const cliente = obtenerCliente();
  const path = `${taller.id}/${globalThis.crypto.randomUUID()}`;
  const subida = await cliente.storage.from(BUCKET).upload(path, archivo, { contentType: archivo.type, upsert: false });
  if (subida.error) throw traducirError(subida.error);

  const orden = fotos.reduce((max, f) => Math.max(max, f.sort), -1) + 1;
  const { data, error } = await cliente
    .from("workshop_photos")
    .insert({ workshop_id: taller.id, path, kind, sort: orden })
    .select("id, path, kind, sort")
    .maybeSingle();
  if (error || !data) {
    await cliente.storage.from(BUCKET).remove([path]); // no deja archivos huérfanos
    throw error ? traducirError(error) : new ApiError("forbidden");
  }
  return aFoto(data);
}

/**
 * Elimina una foto propia (registro y archivo).
 * @param {string} photoId
 * @returns {Promise<void>}
 */
export async function removeWorkshopPhoto(photoId) {
  if (typeof photoId !== "string" || photoId.length === 0) throw new ApiError("invalid_input");
  const cliente = obtenerCliente();
  const { data, error } = await cliente.from("workshop_photos").delete().eq("id", photoId).select("path").maybeSingle();
  if (error) throw traducirError(error);
  if (!data) throw new ApiError("not_found");
  const borrado = await cliente.storage.from(BUCKET).remove([data.path]);
  if (borrado.error) throw traducirError(borrado.error);
}
