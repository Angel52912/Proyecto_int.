// Service worker: solo cachea la interfaz (HTML, CSS, JS, íconos).
// Nunca cachea Supabase, tiles del mapa ni fotos. Ignora todo lo que no sea GET del mismo origen.
const CACHE_VERSION = "mixanab-ui-v4";

// Toda la interfaz: los módulos ES se cargan por import, así que cada archivo debe estar aquí para funcionar sin red.
const INTERFAZ = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./css/actualizar-fase.css",
  "./css/calificar.css",
  "./css/chat.css",
  "./css/chats.css",
  "./css/acceso.css",
  "./css/admin.css",
  "./css/avisos.css",
  "./css/components.css",
  "./css/enviar-presupuesto.css",
  "./css/inicio.css",
  "./css/layout.css",
  "./css/mapa.css",
  "./css/mi-taller.css",
  "./css/pedidos.css",
  "./css/perfil-taller.css",
  "./css/presupuesto.css",
  "./css/recoger.css",
  "./css/seguimiento.css",
  "./css/solicitar.css",
  "./css/solicitudes-artesano.css",
  "./css/tablero.css",
  "./css/taller.css",
  "./css/talleres.css",
  "./css/tokens.css",
  "./css/verificar-entrega.css",
  "./js/app.js",
  "./js/config.js",
  "./js/features/admin/api.js",
  "./js/features/admin/api.mock.js",
  "./js/features/admin/componentes.js",
  "./js/features/admin/index.js",
  "./js/features/admin/pages/bitacora.js",
  "./js/features/admin/pages/consultas.js",
  "./js/features/admin/pages/panel.js",
  "./js/features/admin/pages/resenas.js",
  "./js/features/admin/pages/talleres.js",
  "./js/features/admin/pages/usuarios.js",
  "./js/features/admin/routes.js",
  "./js/features/admin/validar.js",
  "./js/features/auth/api.js",
  "./js/features/auth/api.mock.js",
  "./js/features/auth/avatar.js",
  "./js/features/auth/flujo.js",
  "./js/features/auth/guardia.js",
  "./js/features/auth/index.js",
  "./js/features/auth/pages/bienvenida.js",
  "./js/features/auth/pages/codigo.js",
  "./js/features/auth/pages/completar-perfil.js",
  "./js/features/auth/pages/correo.js",
  "./js/features/auth/pages/perfil-cliente.js",
  "./js/features/auth/pages/rol.js",
  "./js/features/auth/routes.js",
  "./js/features/auth/validar.js",
  "./js/features/chat/api.js",
  "./js/features/chat/api.mock.js",
  "./js/features/chat/componente.js",
  "./js/features/chat/index.js",
  "./js/features/chat/pages/chat.js",
  "./js/features/chat/pages/chats.js",
  "./js/features/chat/routes.js",
  "./js/features/map/api.js",
  "./js/features/map/api.mock.js",
  "./js/features/map/componentes.js",
  "./js/features/map/index.js",
  "./js/features/map/pages/inicio.js",
  "./js/features/map/pages/mapa.js",
  "./js/features/map/pages/perfil-taller.js",
  "./js/features/map/pages/talleres.js",
  "./js/features/map/routes.js",
  "./js/features/map/validar.js",
  "./js/features/orders/api.js",
  "./js/features/orders/api.mock.js",
  "./js/features/orders/fases.js",
  "./js/features/orders/index.js",
  "./js/features/orders/pages/actualizar-fase.js",
  "./js/features/orders/pages/calificar.js",
  "./js/features/orders/pages/pedidos.js",
  "./js/features/orders/pages/recoger.js",
  "./js/features/orders/pages/seguimiento.js",
  "./js/features/orders/pages/tablero.js",
  "./js/features/orders/pages/verificar-entrega.js",
  "./js/features/orders/routes.js",
  "./js/features/orders/validar.js",
  "./js/features/quotes/api.js",
  "./js/features/quotes/api.mock.js",
  "./js/features/quotes/index.js",
  "./js/features/quotes/pages/enviar-presupuesto.js",
  "./js/features/quotes/pages/presupuesto.js",
  "./js/features/quotes/routes.js",
  "./js/features/quotes/tarjeta.js",
  "./js/features/quotes/validar.js",
  "./js/features/requests/api.js",
  "./js/features/requests/api.mock.js",
  "./js/features/requests/avisos.js",
  "./js/features/requests/index.js",
  "./js/features/requests/pages/avisos.js",
  "./js/features/requests/pages/simulacion.js",
  "./js/features/requests/pages/solicitar.js",
  "./js/features/requests/pages/solicitudes-artesano.js",
  "./js/features/requests/routes.js",
  "./js/features/requests/simulacion.js",
  "./js/features/requests/validar.js",
  "./js/features/workshop/api.js",
  "./js/features/workshop/api.mock.js",
  "./js/features/workshop/index.js",
  "./js/features/workshop/pages/mi-taller.js",
  "./js/features/workshop/pages/taller.js",
  "./js/features/workshop/routes.js",
  "./js/features/workshop/validar.js",
  "./js/lib/apiError.js",
  "./js/lib/escape.js",
  "./js/lib/fechas.js",
  "./js/lib/imagen.js",
  "./js/lib/money.js",
  "./js/lib/validate.js",
  "./js/router.js",
  "./js/supabaseClient.js",
  "./js/ui/ciclo.js",
  "./js/ui/dom.js",
  "./js/ui/estados.js",
  "./js/ui/foto.js",
  "./js/ui/iconos.js",
  "./js/ui/layout.js",
  "./js/ui/mensajes.js",
  "./js/ui/qr.js",
  "./js/ui/sesion.js",
  "./js/vendor/supabase.js",
  "./js/vendor/leaflet.js",
  "./js/vendor/leaflet.css",
  "./js/vendor/qrcode.js",
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
