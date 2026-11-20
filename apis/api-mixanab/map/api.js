// Única capa que toca Supabase para la búsqueda de talleres en el mapa (CU-02). Contrato: docs/contrato-api.md.
// api.mock.js debe tener las mismas funciones, respuestas y errores.
import { obtenerCliente } from "../../supabaseClient.js";
import { traducirError } from "../../lib/apiError.js";
import { exigirUuid } from "../requests/validar.js";
import { validarFiltros, validarUbicacion } from "./validar.js";

const BUCKET = "workshop-photos";

/**
 * @typedef {{ id: string, name: string, address: string, colonia: string, postal_code: string | null, lat: number, lng: number, services: ("repair" | "cleaning")[], hours: import("../workshop/validar.js").Horario, price_from: number, rating_avg: number | null, rating_count: number, distance_km: number | null, is_open: boolean }} TallerBase
 * @typedef {TallerBase & { profile_photo_url: string | null }} ResultadoBusqueda
 * @typedef {{ id: string, path: string, kind: "profile" | "work", sort: number, url: string }} FotoPerfil
 * @typedef {TallerBase & { photos: FotoPerfil[] }} PerfilTaller
 */

/**
 * URL pública de una foto del taller (el bucket es público).
 * @param {string} path
 * @returns {string}
 */
function urlPublica(path) {
  return obtenerCliente().storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

/**
 * Busca talleres publicados y no suspendidos (RPC `search_workshops`). Solo el cliente. Sin resultados (A2) devuelve [].
 * Con ubicación ordena por cercanía; sin ella (A1) por calificación.
 * @param {import("./validar.js").FiltrosBusqueda} filtros
 * @returns {Promise<ResultadoBusqueda[]>}
 */
export async function searchWorkshops(filtros) {
  const parametros = validarFiltros(filtros);
  const { data, error } = await obtenerCliente().rpc("search_workshops", parametros);
  if (error) throw traducirError(error);
  return (data ?? []).map((/** @type {Record<string, any>} */ fila) => {
    const { profile_photo_path: ruta, ...resto } = fila;
    return { ...resto, profile_photo_url: ruta ? urlPublica(ruta) : null };
  });
}

/**
 * Perfil del taller: calificación, servicios, horario, precio "desde", si está abierto y fotos (perfil primero y luego
 * los trabajos más recientes). La ubicación es opcional y solo sirve para calcular la distancia.
 * @param {string} workshopId
 * @param {{ lat: number, lng: number }} [ubicacion]
 * @returns {Promise<PerfilTaller>}
 */
export async function getWorkshopProfile(workshopId, ubicacion) {
  exigirUuid(workshopId);
  const { p_lat, p_lng } = validarUbicacion(ubicacion);
  const { data, error } = await obtenerCliente().rpc("get_workshop_profile", { p_workshop_id: workshopId, p_lat, p_lng });
  if (error) throw traducirError(error);
  return { ...data, photos: (data.photos ?? []).map((/** @type {Record<string, any>} */ f) => ({ ...f, url: urlPublica(f.path) })) };
}
