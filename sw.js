// Service worker: solo cachea la interfaz (HTML, CSS, JS, íconos).
// Nunca cachea Supabase, tiles del mapa ni fotos. Ignora todo lo que no sea GET del mismo origen.
const CACHE_VERSION = "mixanab-ui-a9d9ea3201";

// Toda la interfaz: los módulos ES se cargan por import, así que cada archivo debe estar aquí para funcionar sin red.
const INTERFAZ = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./front/icons/icon-192.png",
  "./front/icons/icon-512.png",
  "./front/css/actualizar-fase.css",
  "./front/css/calificar.css",
  "./front/css/chat.css",
  "./front/css/chats.css",
  "./front/css/acceso.css",
  "./front/css/admin.css",
  "./front/css/avisos.css",
  "./front/css/components.css",
  "./front/css/enviar-presupuesto.css",
  "./front/css/inicio.css",
  "./front/css/layout.css",
  "./front/css/mapa.css",
  "./front/css/mi-taller.css",
  "./front/css/pedidos.css",
  "./front/css/portada.css",
  "./front/css/perfil-taller.css",
  "./front/css/perfil-cliente.css",
  "./front/css/historial.css",
  "./front/css/nuevo-front.css",
  "./front/css/escritorio.css",
  "./front/css/presupuesto.css",
  "./front/css/recoger.css",
  "./front/css/seguimiento.css",
  "./front/css/solicitar.css",
  "./front/css/solicitudes-artesano.css",
  "./front/css/tablero.css",
  "./front/css/taller.css",
  "./front/css/talleres.css",
  "./front/css/tokens.css",
  "./front/css/verificar-entrega.css",
  "./front/fonts/inter-latin-wght-normal.woff2",
  "./front/fonts/poppins-latin-600-normal.woff2",
  "./front/fonts/poppins-latin-700-normal.woff2",
  "./front/js/app.js",
  "./front/js/antes-de-pintar.js",
  "./apis/config.js",
  "./apis/api-mixanab/admin/api.js",
  "./apis/api-mixanab/admin/api.mock.js",
  "./front/js/features/admin/componentes.js",
  "./front/js/features/admin/index.js",
  "./front/js/features/admin/pages/bitacora.js",
  "./front/js/features/admin/pages/consultas.js",
  "./front/js/features/admin/pages/panel.js",
  "./front/js/features/admin/pages/resenas.js",
  "./front/js/features/admin/pages/talleres.js",
  "./front/js/features/admin/pages/usuarios.js",
  "./front/js/features/admin/routes.js",
  "./apis/api-mixanab/admin/validar.js",
  "./apis/api-inicio-sesion/api.js",
  "./apis/api-inicio-sesion/api.mock.js",
  "./front/js/features/auth/avatar.js",
  "./front/js/features/auth/flujo.js",
  "./front/js/features/auth/guardia.js",
  "./front/js/features/auth/index.js",
  "./front/js/features/auth/pages/bienvenida.js",
  "./front/js/features/auth/pages/codigo.js",
  "./front/js/features/auth/pages/completar-perfil.js",
  "./front/js/features/auth/pages/correo.js",
  "./front/js/features/auth/pages/perfil-cliente.js",
  "./front/js/features/auth/pages/portada.js",
  "./front/js/features/auth/pages/rol.js",
  "./front/js/features/auth/routes.js",
  "./apis/api-inicio-sesion/validar.js",
  "./apis/api-mixanab/chat/api.js",
  "./apis/api-mixanab/chat/api.mock.js",
  "./front/js/features/chat/componente.js",
  "./front/js/features/chat/index.js",
  "./front/js/features/chat/pages/chat.js",
  "./front/js/features/chat/pages/chats.js",
  "./front/js/features/chat/routes.js",
  "./apis/api-mixanab/map/api.js",
  "./apis/api-mixanab/map/api.mock.js",
  "./front/js/features/map/componentes.js",
  "./front/js/features/map/index.js",
  "./front/js/features/map/pages/inicio.js",
  "./front/js/features/map/pages/mapa.js",
  "./front/js/features/map/pages/perfil-taller.js",
  "./front/js/features/map/pages/talleres.js",
  "./front/js/features/map/routes.js",
  "./apis/api-mixanab/map/validar.js",
  "./apis/api-mixanab/orders/api.js",
  "./apis/api-mixanab/orders/api.mock.js",
  "./front/js/features/orders/fases.js",
  "./front/js/features/orders/index.js",
  "./front/js/features/orders/pasos.js",
  "./front/js/features/orders/pages/actualizar-fase.js",
  "./front/js/features/orders/pages/calificar.js",
  "./front/js/features/orders/pages/pedidos.js",
  "./front/js/features/orders/pages/recoger.js",
  "./front/js/features/orders/pages/seguimiento.js",
  "./front/js/features/orders/pages/historial.js",
  "./front/js/features/orders/pages/tablero.js",
  "./front/js/features/orders/pages/verificar-entrega.js",
  "./front/js/features/orders/routes.js",
  "./apis/api-mixanab/orders/validar.js",
  "./apis/api-mixanab/quotes/api.js",
  "./apis/api-mixanab/quotes/api.mock.js",
  "./front/js/features/quotes/index.js",
  "./front/js/features/quotes/pages/enviar-presupuesto.js",
  "./front/js/features/quotes/pages/presupuesto.js",
  "./front/js/features/quotes/routes.js",
  "./front/js/features/quotes/tarjeta.js",
  "./apis/api-mixanab/quotes/validar.js",
  "./apis/api-mixanab/requests/api.js",
  "./apis/api-mixanab/requests/api.mock.js",
  "./front/js/features/requests/insignias.js",
  "./front/js/features/requests/avisos.js",
  "./front/js/features/requests/index.js",
  "./front/js/features/requests/pages/avisos.js",
  "./front/js/features/requests/pages/simulacion.js",
  "./front/js/features/requests/pages/solicitar.js",
  "./front/js/features/requests/pages/solicitudes-artesano.js",
  "./front/js/features/requests/routes.js",
  "./apis/api-mixanab/requests/simulacion.js",
  "./apis/api-mixanab/requests/validar.js",
  "./apis/api-mixanab/workshop/api.js",
  "./apis/api-mixanab/workshop/api.mock.js",
  "./front/js/features/workshop/index.js",
  "./front/js/features/workshop/pages/mi-taller.js",
  "./front/js/features/workshop/pages/taller.js",
  "./front/js/features/workshop/routes.js",
  "./apis/api-mixanab/workshop/validar.js",
  "./apis/lib/apiError.js",
  "./apis/lib/fotoSimulada.js",
  "./front/js/lib/escape.js",
  "./front/js/lib/fechas.js",
  "./front/js/lib/geocodificar.js",
  "./front/js/lib/imagen.js",
  "./front/js/lib/money.js",
  "./apis/lib/validate.js",
  "./front/js/router.js",
  "./apis/supabaseClient.js",
  "./front/js/ui/ampliar-foto.js",
  "./front/js/ui/aviso-flotante.js",
  "./front/js/ui/ciclo.js",
  "./front/js/ui/conexion.js",
  "./front/js/ui/dom.js",
  "./front/js/ui/escritorio.js",
  "./front/js/ui/estados.js",
  "./front/js/ui/foto.js",
  "./front/js/ui/iconos.js",
  "./front/js/ui/layout.js",
  "./front/js/ui/mensajes.js",
  "./front/js/ui/qr.js",
  "./front/js/ui/vista.js",
  "./front/js/ui/sesion.js",
  "./front/js/ui/tema.js",
  "./front/js/ui/validacion.js",
  "./front/js/vendor/supabase.js",
  "./front/js/vendor/leaflet.js",
  "./front/js/vendor/leaflet.css",
  "./front/js/vendor/qrcode.js",
];

const RUTAS_INTERFAZ = new Set(INTERFAZ.map((ruta) => new URL(ruta, self.location).pathname));
const RAIZ = new URL("./", self.location).pathname;

self.addEventListener("install", (evento) => {
  evento.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) => cache.addAll(INTERFAZ))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (evento) => {
  evento.waitUntil(
    caches
      .keys()
      .then((claves) => Promise.all(claves.filter((clave) => clave !== CACHE_VERSION).map((clave) => caches.delete(clave))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (evento) => {
  const peticion = evento.request;
  if (peticion.method !== "GET") return;

  const url = new URL(peticion.url);
  // Otro origen (Supabase, tiles de OSM, fotos firmadas): no se intercepta.
  if (url.origin !== self.location.origin) return;

  if (peticion.mode === "navigate" && (url.pathname === RAIZ || url.pathname === `${RAIZ}index.html`)) {
    evento.respondWith(cacheLuegoRed(new Request(new URL("./index.html", self.location))));
    return;
  }

  if (RUTAS_INTERFAZ.has(url.pathname)) {
    evento.respondWith(cacheLuegoRed(peticion));
  }
  // Cualquier otra ruta va directo a la red y no se guarda.
});

/**
 * @param {Request} peticion
 * @returns {Promise<Response>}
 */
async function cacheLuegoRed(peticion) {
  const cache = await caches.open(CACHE_VERSION);
  const guardada = await cache.match(peticion);
  return guardada ?? fetch(peticion);
}
