// Aviso de conexión: una franja fija arriba mientras no hay internet y un aviso flotante al volver.
import { crear } from "./dom.js";
import { icono } from "./iconos.js";
import { mostrarAvisoFlotante } from "./aviso-flotante.js";

export const TEXTO_SIN_CONEXION = "Sin conexión. Revisa tu internet; lo que hagas puede no guardarse.";

/** Instala la franja de "Sin conexión" (una sola vez). */
export function instalarAvisoConexion() {
  if (document.querySelector(".franja-conexion")) return;
  const franja = crear("div", { clase: "franja-conexion", attrs: { role: "status", hidden: "" } }, [
    icono("sinConexion", { tam: 16 }),
    crear("span", { texto: TEXTO_SIN_CONEXION }),
  ]);
  document.body.prepend(franja);
  const actualizar = (/** @type {boolean} */ avisarRegreso) => {
    const enLinea = navigator.onLine !== false;
    franja.hidden = enLinea;
    if (enLinea && avisarRegreso) mostrarAvisoFlotante("Conexión recuperada.", { tono: "info" });
  };
  window.addEventListener("offline", () => actualizar(false));
  window.addEventListener("online", () => actualizar(true));
  actualizar(false);
}
