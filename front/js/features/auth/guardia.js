// Guardia por rol (CU-01): decide a dónde va cada usuario según su perfil y protege las rutas de cada rol.
// La base de datos ya impide el acceso (RLS); esto solo evita mostrar una pantalla que no le toca al usuario.
import { USAR_API_SIMULADA } from "../../../../apis/config.js";
import { RUTA_ACCESO } from "../../router.js";
import { crear, ir } from "../../ui/dom.js";
import { api } from "./index.js";

/** @typedef {"client" | "craftsman" | "admin"} Rol */
/** @typedef {{ role: Rol | null, full_name: string }} PerfilMinimo */

/** Pantalla de inicio de cada rol. */
export const INICIO_POR_ROL = Object.freeze({
  client: "/principal",
  craftsman: "/artesano/tablero",
  admin: "/admin",
});

/**
 * Destino tras entrar: sin rol → elegir rol; sin nombre → completar perfil; si no, el inicio de su rol.
 * @param {PerfilMinimo} perfil
 * @returns {string}
 */
export function destinoPorPerfil(perfil) {
  if (perfil.role === null) return `${RUTA_ACCESO}/rol`;
  if (perfil.role !== "admin" && perfil.full_name.trim() === "") return `${RUTA_ACCESO}/perfil`;
  return INICIO_POR_ROL[perfil.role];
}

/** @type {Promise<PerfilMinimo | null> | null} */
let perfilEnCurso = null;

/**
 * Perfil del usuario con sesión, o null si no hay sesión. Se guarda mientras dura la sesión: el rol no cambia.
 * Con la API simulada el rol lo lleva la sesión simulada que comparten los demás api.mock.js.
 * @returns {Promise<PerfilMinimo | null>}
 */
export function obtenerPerfilActual() {
  if (USAR_API_SIMULADA) return perfilSimulado();
  perfilEnCurso ??= api.getMyProfile().catch((/** @type {any} */ error) => {
    perfilEnCurso = null;
    if (error?.code === "not_authenticated") return null;
    throw error;
  });
  return perfilEnCurso;
}

/** Olvida el perfil guardado (al elegir rol, completar el perfil o cerrar sesión). */
export function olvidarPerfil() {
  perfilEnCurso = null;
}

/** @returns {Promise<PerfilMinimo | null>} */
async function perfilSimulado() {
  const { estado } = await import("../../../../apis/api-mixanab/requests/simulacion.js");
  if (!estado.sesion) return null;
  // El simulado de solicitudes no guarda nombre; la guardia solo revisa el rol.
  return { role: /** @type {Rol | null} */ (estado.rol), full_name: "Simulado" };
}

/**
 * Con la API simulada, alinea la sesión de los demás simulados con la de acceso (rol elegido o sesión cerrada).
 * @param {{ sesion: boolean, rol?: Rol | null }} cambios
 */
export async function sincronizarSesionSimulada({ sesion, rol = null }) {
  if (!USAR_API_SIMULADA) return;
  const [simulacion, taller] = await Promise.all([import("../../../../apis/api-mixanab/requests/simulacion.js"), import("../../../../apis/api-mixanab/workshop/api.mock.js")]);
  simulacion.fijarSesionSimulada(sesion ? { sesion: true, rol } : { sesion: false });
  if (sesion && rol !== null) taller.fijarSesionSimulada({ rol });
}

/**
 * Envuelve el render de una ruta para que solo la abran los roles indicados. Sin sesión manda a Acceso, sin rol a
 * elegirlo, y con otro rol a su propio inicio.
 * @param {ReadonlyArray<Rol>} roles
 * @param {(contexto: import("../../router.js").Contexto) => Node | Promise<Node>} render
 * @returns {(contexto: import("../../router.js").Contexto) => Promise<Node>}
 */
export function soloPara(roles, render) {
  return async (contexto) => {
    const perfil = await obtenerPerfilActual();
    const destino = perfil === null ? RUTA_ACCESO : perfil.role === null || !roles.includes(perfil.role) ? destinoPorPerfil(perfil) : null;
    if (destino !== null) {
      ir(destino);
      return crear("p", { clase: "estado-cargando", texto: "Cargando…" });
    }
    return render(contexto);
  };
}
