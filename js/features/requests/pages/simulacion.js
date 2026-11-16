// Solo con la API simulada: cambia la sesión simulada entre cliente y artesano para recorrer ambos flujos
// (por ejemplo: el cliente envía una solicitud y luego el artesano la cotiza). No existe con la API real.
import { USAR_API_SIMULADA } from "../../../config.js";
import { crear, ir } from "../../../ui/dom.js";
import { crearBoton, crearPantalla } from "../../../ui/layout.js";

/**
 * @param {"client" | "craftsman"} rol
 */
async function cambiarRol(rol) {
  const [simulacion, taller] = await Promise.all([import("../simulacion.js"), import("../../workshop/api.mock.js")]);
  simulacion.fijarSesionSimulada({ rol });
  taller.fijarSesionSimulada({ rol });
  ir(rol === "client" ? "/inicio" : "/artesano/solicitudes");
}

/** @returns {Promise<Node>} */
export async function renderSimulacion() {
  if (!USAR_API_SIMULADA) return crear("p", { clase: "estado-error", texto: "No encontramos esa página." });
  return crearPantalla({ titulo: "Modo simulado", clase: "simulacion" }, [
    crear("p", { texto: "Elige con qué rol recorrer la app. Los datos viven en memoria y se pierden al recargar la página." }),
    crearBoton("Entrar como cliente", { icono: "perfil", alHacerClic: () => cambiarRol("client") }),
    crearBoton("Entrar como artesano", { variante: "secundario", icono: "reparacion", alHacerClic: () => cambiarRol("craftsman") }),
  ]);
}
