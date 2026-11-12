import { USAR_API_SIMULADA } from "./config.js";
import { crearRouter } from "./router.js";
import { obtenerSesion } from "./supabaseClient.js";
import { rutas as rutasAdmin } from "./features/admin/routes.js";
import { rutas as rutasAuth } from "./features/auth/routes.js";
import { rutas as rutasChat } from "./features/chat/routes.js";
import { rutas as rutasMapa } from "./features/map/routes.js";
import { rutas as rutasPedidos } from "./features/orders/routes.js";
import { rutas as rutasPresupuestos } from "./features/quotes/routes.js";
import { rutas as rutasSolicitudes } from "./features/requests/routes.js";
import { rutas as rutasTaller } from "./features/workshop/routes.js";

/** @returns {Node} */
function crearInicio() {
  const seccion = document.createElement("section");
  const titulo = document.createElement("h1");
  titulo.textContent = "MiXanab";
  const lema = document.createElement("p");
  lema.textContent = "No lo tires, restáuralo.";
  seccion.append(titulo, lema);
  return seccion;
}

/** @type {ReadonlyArray<import("./router.js").Ruta>} */
const rutas = [
  { path: "/", render: crearInicio },
  ...rutasAuth,
  ...rutasMapa,
  ...rutasSolicitudes,
  ...rutasChat,
  ...rutasPresupuestos,
  ...rutasPedidos,
  ...rutasTaller,
  ...rutasAdmin,
];

/** Con la API simulada no hay Supabase configurado: no hay sesión. */
const sesionActual = USAR_API_SIMULADA ? async () => null : obtenerSesion;

/** En localhost el service worker se omite (evita caché vieja) salvo con `?sw=1`. */
function registrarServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  const esLocal = ["localhost", "127.0.0.1"].includes(window.location.hostname);
  if (esLocal && new URLSearchParams(window.location.search).get("sw") !== "1") return;
  navigator.serviceWorker.register("./sw.js").catch(() => {
    // La app funciona sin service worker.
  });
}

const contenedor = document.getElementById("app");
if (contenedor !== null) {
  crearRouter({ rutas, contenedor, obtenerSesion: sesionActual }).iniciar();
  registrarServiceWorker();
}
