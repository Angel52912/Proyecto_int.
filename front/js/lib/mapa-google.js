// Google Maps con la misma forma que usan las pantallas con Leaflet (setView, panTo, fitBounds, getZoom, on("click"),
// remove), para cambiar de proveedor sin reescribir Buscar, Inicio, la ficha del taller ni Mi taller.
// Se usa solo si apis/config-mapa.js tiene PROVEEDOR_MAPA = "google" y una llave (ver docs/mapa-google.md).
import { GOOGLE_MAPS_API_KEY, GOOGLE_MAPS_MAP_ID } from "../../../apis/config-mapa.js";

/** @typedef {{ lat: number, lng: number }} Punto */

/** @type {Promise<any> | null} */
let cargando = null;

/**
 * Carga la API de Google Maps una sola vez (al abrir el primer mapa, no al arrancar la app).
 * @returns {Promise<any>} el espacio `google.maps`
 */
export function cargarGoogleMaps() {
  cargando ??= new Promise((resolver, rechazar) => {
    const global = /** @type {any} */ (window);
    if (global.google?.maps?.importLibrary) {
      resolver(global.google.maps);
      return;
    }
    const llamada = "__mixanabGoogleMapsListo";
    global[llamada] = () => resolver(global.google.maps);
    const url = new URL("https://maps.googleapis.com/maps/api/js");
    url.searchParams.set("key", GOOGLE_MAPS_API_KEY);
    url.searchParams.set("v", "weekly");
    url.searchParams.set("libraries", "marker,geocoding");
    url.searchParams.set("language", "es");
    url.searchParams.set("region", "MX");
    url.searchParams.set("loading", "async");
    url.searchParams.set("callback", llamada);
    const script = document.createElement("script");
    script.src = url.toString();
    script.async = true;
    script.addEventListener("error", () => {
      cargando = null;
      rechazar(new Error("No se pudo cargar Google Maps"));
    });
    document.head.append(script);
  });
  return cargando;
}

/** @param {[number, number] | Punto} p @returns {Punto} */
const aPunto = (p) => (Array.isArray(p) ? { lat: p[0], lng: p[1] } : { lat: p.lat, lng: p.lng });

/**
 * Mapa de Google que responde como un L.Map (el subconjunto que usa la app). Mientras carga la API, las órdenes se
 * guardan y se aplican al terminar.
 * @param {HTMLElement} contenedor
 * @param {{ interactivo?: boolean, centro: Punto, zoom: number }} opciones
 */
export function crearMapaGoogle(contenedor, opciones) {
  /** @type {any} */
  let mapa = null;
  /** @type {Array<(mapa: any) => void>} */
  let pendientes = [];
  let quitado = false;
  /** @type {Array<(e: { latlng: Punto }) => void>} */
  const alTocar = [];

  /** @param {(mapa: any) => void} orden */
  const cuandoEste = (orden) => {
    if (quitado) return;
    if (mapa) orden(mapa);
    else pendientes.push(orden);
  };

  cargarGoogleMaps()
    .then(async (maps) => {
      const { Map } = await maps.importLibrary("maps");
      if (quitado || !contenedor.isConnected) return;
      const interactivo = opciones.interactivo !== false;
      mapa = new Map(contenedor, {
        center: opciones.centro,
        zoom: opciones.zoom,
        mapId: GOOGLE_MAPS_MAP_ID || "DEMO_MAP_ID",
        disableDefaultUI: true,
        clickableIcons: false,
        keyboardShortcuts: interactivo,
        // Buscar ocupa toda la pantalla: un dedo mueve el mapa. Sin interacción (mapa chico de Inicio): quieto.
        gestureHandling: interactivo ? "greedy" : "none",
      });
      mapa.addListener("click", (/** @type {any} */ e) => {
        if (!e.latLng) return;
        const latlng = { lat: e.latLng.lat(), lng: e.latLng.lng() };
        alTocar.forEach((cb) => cb({ latlng }));
      });
      const ordenes = pendientes;
      pendientes = [];
      ordenes.forEach((orden) => orden(mapa));
    })
    .catch(() => {
      contenedor.replaceChildren(Object.assign(document.createElement("p"), { className: "estado-error", textContent: "No se pudo cargar el mapa." }));
    });

  let zoomActual = opciones.zoom;
  return {
    esGoogle: true,
    /** Orden interna: corre en cuanto el mapa existe (la usan los pines). @param {(mapa: any) => void} orden */
    cuandoEste,
    /** @param {[number, number] | Punto} centro @param {number} [zoom] */
    setView(centro, zoom) {
      if (zoom !== undefined) zoomActual = zoom;
      cuandoEste((m) => {
        m.setCenter(aPunto(centro));
        if (zoom !== undefined) m.setZoom(zoom);
      });
      return this;
    },
    /** @param {[number, number] | Punto} centro */
    panTo(centro) {
      cuandoEste((m) => m.panTo(aPunto(centro)));
      return this;
    },
    /**
     * @param {Array<[number, number]>} puntos
     * @param {{ paddingTopLeft?: [number, number], paddingBottomRight?: [number, number], maxZoom?: number }} [opc]
     */
    fitBounds(puntos, opc = {}) {
      cuandoEste((m) => {
        const maps = /** @type {any} */ (window).google.maps;
        const limites = new maps.LatLngBounds();
        puntos.forEach((p) => limites.extend(aPunto(p)));
        const [izq, arriba] = opc.paddingTopLeft ?? [40, 40];
        const [der, abajo] = opc.paddingBottomRight ?? [40, 40];
        m.fitBounds(limites, { top: arriba, left: izq, right: der, bottom: abajo });
        if (opc.maxZoom !== undefined) {
          maps.event.addListenerOnce(m, "idle", () => {
            if (m.getZoom() > /** @type {number} */ (opc.maxZoom)) m.setZoom(opc.maxZoom);
          });
        }
      });
      return this;
    },
    getZoom() {
      return mapa?.getZoom() ?? zoomActual;
    },
    /** @param {"click"} evento @param {(e: { latlng: Punto }) => void} cb */
    on(evento, cb) {
      if (evento === "click") alTocar.push(cb);
      return this;
    },
    invalidateSize() {
      return this;
    },
    stop() {
      return this;
    },
    remove() {
      quitado = true;
      pendientes = [];
      if (mapa) /** @type {any} */ (window).google?.maps?.event?.clearInstanceListeners(mapa);
      mapa = null;
      contenedor.replaceChildren();
    },
  };
}

/**
 * Pin con contenido HTML propio (el mismo `.pin` de la app) sobre un mapa de Google.
 * @param {any} mapaGoogle lo que devuelve crearMapaGoogle
 * @param {Punto} punto
 * @param {HTMLElement} contenido
 * @param {{ titulo?: string, alTocar?: () => void, centrado?: boolean, arrastrable?: boolean, alSoltar?: (punto: Punto) => void }} [opciones] `centrado`: el punto queda al centro del
 *   contenido (punto de "tu ubicación"); si no, en la punta de abajo (pin).
 * @returns {{ mover: (punto: Punto) => void, remove: () => void }}
 */
export function crearPinGoogle(mapaGoogle, punto, contenido, opciones = {}) {
  /** @type {any} */
  let marcador = null;
  let quitado = false;
  let posicion = punto;
  mapaGoogle.cuandoEste(async (/** @type {any} */ mapa) => {
    const { AdvancedMarkerElement } = await /** @type {any} */ (window).google.maps.importLibrary("marker");
    if (quitado) return;
    if (opciones.centrado) contenido.style.transform = "translateY(50%)";
    marcador = new AdvancedMarkerElement({
      map: mapa,
      position: posicion,
      content: contenido,
      title: opciones.titulo ?? "",
      gmpClickable: Boolean(opciones.alTocar),
      gmpDraggable: Boolean(opciones.arrastrable),
    });
    if (opciones.alTocar) marcador.addListener("click", () => opciones.alTocar?.());
    if (opciones.alSoltar) {
      marcador.addListener("dragend", () => {
        const p = marcador.position;
        const punto = typeof p?.lat === "function" ? { lat: p.lat(), lng: p.lng() } : { lat: p.lat, lng: p.lng };
        posicion = punto;
        opciones.alSoltar?.(punto);
      });
    }
  });
  return {
    mover(nuevo) {
      posicion = nuevo;
      if (marcador) marcador.position = nuevo;
    },
    remove() {
      quitado = true;
      if (marcador) marcador.map = null;
    },
  };
}

/**
 * Dirección de un resultado de Google en los campos del formulario del taller. No inventa datos.
 * @param {any} resultado GeocoderResult
 * @returns {{ direccion: string, colonia: string, codigoPostal: string } | null}
 */
export function direccionDeGoogle(resultado) {
  const partes = Array.isArray(resultado?.address_components) ? resultado.address_components : [];
  /** @param {string} tipo */
  const parte = (tipo) => partes.find((/** @type {any} */ p) => Array.isArray(p.types) && p.types.includes(tipo))?.long_name ?? "";
  const calle = parte("route");
  const numero = parte("street_number");
  const direccion = calle && numero ? `${calle} #${numero}` : calle;
  const colonia = parte("sublocality_level_1") || parte("sublocality") || parte("neighborhood");
  const codigoPostal = /(\d{5})/.exec(parte("postal_code"))?.[1] ?? "";
  if (!direccion && !colonia && !codigoPostal) return null;
  return { direccion, colonia, codigoPostal };
}

/**
 * Tipo de lugar en los términos que ya usa la pantalla del taller: "house" si Google ubicó el número exacto.
 * @param {any} resultado GeocoderResult
 * @returns {{ categoria: string, tipo: string }}
 */
export function categoriaDeGoogle(resultado) {
  const tipos = Array.isArray(resultado?.types) ? resultado.types : [];
  if (tipos.some((/** @type {string} */ t) => ["street_address", "premise", "subpremise"].includes(t))) return { categoria: "house", tipo: tipos[0] };
  if (tipos.includes("route")) return { categoria: "highway", tipo: "route" };
  return { categoria: "place", tipo: tipos[0] ?? "" };
}

/**
 * Geocodificación con Google (Geocoder de la API de JavaScript): `{ address }` o `{ location }`.
 * @param {Record<string, unknown>} peticion
 * @returns {Promise<{ resultados: any[], motivo: "encontrado" | "no_encontrado" | "error" }>}
 */
export async function geocodificarConGoogle(peticion) {
  try {
    const maps = await cargarGoogleMaps();
    const { Geocoder } = await maps.importLibrary("geocoding");
    const { results } = await new Geocoder().geocode({ ...peticion, language: "es", region: "mx" });
    return { resultados: results ?? [], motivo: results?.length ? "encontrado" : "no_encontrado" };
  } catch (error) {
    // ZERO_RESULTS llega como error: es "no encontrado", no una falla de red.
    const codigo = /** @type {{ code?: string } | null} */ (error)?.code;
    return { resultados: [], motivo: codigo === "ZERO_RESULTS" ? "no_encontrado" : "error" };
  }
}
