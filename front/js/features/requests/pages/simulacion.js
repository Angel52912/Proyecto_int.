// Solo con la API simulada: cambia la sesión simulada entre cliente, artesano y admin para recorrer los flujos
// (por ejemplo: el cliente envía una solicitud y luego el artesano la cotiza). No existe con la API real.
// El admin no se puede elegir en el registro (es una cuenta interna), por eso solo se entra como admin desde aquí.
import { USAR_API_SIMULADA } from "../../../../../apis/config.js";
import { sincronizarSesionSimulada } from "../../auth/guardia.js";
import { crear, ir } from "../../../ui/dom.js";
import { crearBoton, crearPantalla } from "../../../ui/layout.js";

/** Pantalla de entrada de cada rol en el modo simulado. */
const ENTRADA = Object.freeze({ client: "/principal", craftsman: "/artesano/solicitudes", admin: "/admin" });

/**
 * @param {"client" | "craftsman" | "admin"} rol
 */
async function cambiarRol(rol) {
  await sincronizarSesionSimulada({ sesion: true, rol });
  if (rol === "craftsman") await prepararTallerDelArtesano();
  ir(ENTRADA[rol]);
}

/**
 * El artesano simulado es el dueño del taller que recibe las solicitudes en el mapa ("Calzado El Buen Paso"):
 * entra con ese taller ya configurado y publicado, sin el aviso de "Configura y publica tu taller".
 * Un artesano que se registra desde Crear cuenta sigue empezando sin taller.
 */
async function prepararTallerDelArtesano() {
  const [taller, mapa] = await Promise.all([import("../../../../../apis/api-mixanab/workshop/api.mock.js"), import("../../../../../apis/api-mixanab/map/api.mock.js")]);
  if ((await taller.getMyWorkshop()) !== null) return;
  await taller.saveMyWorkshop({ ...mapa.datosTallerSimulado(), description: "Taller familiar en el Centro de Mérida: reparamos y limpiamos calzado y artículos de piel." });
  await taller.publishMyWorkshop();
}

/** @returns {Promise<Node>} */
export async function renderSimulacion() {
  if (!USAR_API_SIMULADA) return crear("p", { clase: "estado-error", texto: "No encontramos esa página." });
  return crearPantalla({ titulo: "Modo simulado", clase: "simulacion" }, [
    crear("p", { texto: "Elige con qué rol recorrer la app. Los datos viven en memoria y se pierden al recargar la página." }),
    crearBoton("Entrar como cliente", { icono: "perfil", alHacerClic: () => cambiarRol("client") }),
    crearBoton("Entrar como artesano", { variante: "secundario", icono: "reparacion", alHacerClic: () => cambiarRol("craftsman") }),
    crearBoton("Entrar como admin", { variante: "secundario", icono: "escudo", alHacerClic: () => cambiarRol("admin") }),
  ]);
}
