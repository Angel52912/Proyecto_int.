// Estado del flujo de acceso (CU-01) entre pantallas: correo pendiente de verificar y nombre capturado al crear la
// cuenta. Vive en memoria y en sessionStorage (sobrevive a recargar), nunca en la URL.
import { ir } from "../../ui/dom.js";
import { olvidarAvatares } from "./avatar.js";
import { destinoPorPerfil, olvidarPerfil, sincronizarSesionSimulada } from "./guardia.js";
import { api } from "./index.js";

const CLAVE = "mixanab:acceso";

/** @typedef {{ correo: string, nombre: string }} DatosAcceso */

/** @type {DatosAcceso} */
let datos = leer();

/** @returns {DatosAcceso} */
function leer() {
  try {
    const guardado = JSON.parse(globalThis.sessionStorage?.getItem(CLAVE) ?? "null");
    if (guardado && typeof guardado.correo === "string" && typeof guardado.nombre === "string") return guardado;
  } catch {
    // Sin almacenamiento (modo privado): solo en memoria.
  }
  return { correo: "", nombre: "" };
}

/** @returns {DatosAcceso} */
export function datosAcceso() {
  return { ...datos };
}

/** @param {Partial<DatosAcceso>} cambios */
export function guardarDatosAcceso(cambios) {
  datos = { ...datos, ...cambios };
  try {
    globalThis.sessionStorage?.setItem(CLAVE, JSON.stringify(datos));
  } catch {
    // Sin almacenamiento: se queda en memoria.
  }
}

/** Borra el correo y el nombre del flujo (al terminar o al cerrar sesión). */
export function limpiarDatosAcceso() {
  datos = { correo: "", nombre: "" };
  try {
    globalThis.sessionStorage?.removeItem(CLAVE);
  } catch {
    // Nada que borrar.
  }
}

/**
 * Tras iniciar sesión (código o Google): lee el perfil y lleva al usuario a elegir rol, completar su perfil o su inicio.
 * @returns {Promise<void>}
 */
export async function continuarTrasEntrar() {
  olvidarPerfil();
  const perfil = await api.getMyProfile();
  await sincronizarSesionSimulada({ sesion: true, rol: perfil.role });
  ir(destinoPorPerfil(perfil));
}

/**
 * Cierra la sesión y vuelve a la Bienvenida.
 * @returns {Promise<void>}
 */
export async function cerrarSesion() {
  try {
    await api.signOut();
  } finally {
    olvidarPerfil();
    olvidarAvatares();
    limpiarDatosAcceso();
    await sincronizarSesionSimulada({ sesion: false });
    ir("/acceso");
  }
}
