// Service worker: solo cachea la interfaz (HTML, CSS, JS, íconos).
// Nunca cachea Supabase, tiles del mapa ni fotos. Ignora todo lo que no sea GET del mismo origen.
const CACHE_VERSION = "mixanab-ui-v1";

const INTERFAZ = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./css/tokens.css",
  "./css/components.css",
  "./js/app.js",
  "./js/router.js",
  "./js/supabaseClient.js",
  "./js/config.js",
  "./js/lib/escape.js",
  "./js/lib/validate.js",
  "./js/lib/money.js",
  "./js/features/auth/routes.js",
  "./js/features/map/routes.js",
  "./js/features/requests/routes.js",
  "./js/features/chat/routes.js",
  "./js/features/quotes/routes.js",
  "./js/features/orders/routes.js",
  "./js/features/workshop/routes.js",
  "./js/features/admin/routes.js",
  "./js/vendor/supabase.js",
  "./js/vendor/leaflet.js",
  "./js/vendor/leaflet.css",
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
