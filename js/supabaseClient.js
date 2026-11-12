import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./config.js";

/**
 * @typedef {(url: string, clave: string, opciones: object) => any} FabricaCliente
 */

/** @type {any} */
let clienteUnico = null;

/**
 * Crea el cliente de Supabase. Falla si la configuración sigue con los valores de ejemplo.
 * @param {FabricaCliente | undefined} fabrica Normalmente `globalThis.supabase.createClient`.
 * @param {string} url
 * @param {string} clave
 * @returns {any}
 */
export function crearCliente(fabrica, url, clave) {
  if (typeof fabrica !== "function") {
    throw new Error("supabase-js no está cargado. Ejecuta `npm run vendor` y revisa index.html.");
  }
  if (url.includes("REEMPLAZAR") || clave.includes("REEMPLAZAR")) {
    throw new Error("Configura SUPABASE_URL y SUPABASE_ANON_KEY en js/config.js.");
  }
  return fabrica(url, clave, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: "pkce" },
  });
}

/**
 * Cliente compartido de la app.
 * @returns {any}
 */
export function obtenerCliente() {
  if (clienteUnico === null) {
    clienteUnico = crearCliente(globalThis.supabase?.createClient, SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  return clienteUnico;
}

/**
 * Sesión actual o `null` si no hay.
 * @returns {Promise<object | null>}
 */
export async function obtenerSesion() {
  const { data, error } = await obtenerCliente().auth.getSession();
  if (error) throw error;
  return data.session;
}
