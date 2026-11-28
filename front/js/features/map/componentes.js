// Piezas compartidas por las pantallas de búsqueda (CU-02): búsqueda "Todos", ubicación, tarjeta y mapa de talleres.
import { crear, enlace } from "../../ui/dom.js";
import { crearFoto } from "../../ui/foto.js";
import { icono } from "../../ui/iconos.js";
import { crearEstrellas, crearInsignia } from "../../ui/layout.js";
import { formatearMxn } from "../../lib/money.js";
import { crearMapaGoogle, crearPinGoogle } from "../../lib/mapa-google.js";
import { usaGoogleMaps } from "../../../../apis/config-mapa.js";
import { api } from "./index.js";

/** Nombre en pantalla de cada servicio. */
export const NOMBRE_SERVICIO = Object.freeze({ repair: "Reparación", cleaning: "Limpieza" });

/** Centro de Mérida (sin ubicación del cliente). */
export const CENTRO_MERIDA = Object.freeze({ lat: 20.9674, lng: -89.6237 });

/** @typedef {"all" | "repair" | "cleaning"} FiltroServicio */
/** @typedef {"cercanos" | "valorados" | "precio"} Orden */

/** Orden de la pantalla → `order` de `searchWorkshops`. */
export const ORDEN_SERVIDOR = Object.freeze({ cercanos: "distance", valorados: "rating", precio: "price" });

/**
 * Filtros de la pantalla → parámetros de `searchWorkshops`. "Todos" no manda servicio (el servidor une ambos sin
 * repetir) y "Más cercanos" sin ubicación cae a "Mejor valorados" (el servidor exige ubicación para ordenar por distancia).
 * @param {Omit<import("../../../../apis/api-mixanab/map/validar.js").FiltrosBusqueda, "service" | "order"> & { service: FiltroServicio, orden?: Orden }} filtros
 * @returns {import("../../../../apis/api-mixanab/map/validar.js").FiltrosBusqueda}
 */
export function parametrosDeBusqueda({ service, orden, ...resto }) {
  const conUbicacion = resto.lat !== undefined && resto.lng !== undefined;
  const elegido = orden === "cercanos" && !conUbicacion ? "valorados" : orden;
  return {
    ...resto,
    ...(service === "all" ? {} : { service }),
    ...(elegido ? { order: /** @type {"distance" | "rating" | "price"} */ (ORDEN_SERVIDOR[elegido]) } : {}),
  };
}

/**
 * Busca talleres en el servidor: filtra, ordena y une los servicios ahí, así no se pierden resultados al pasar del límite.
 * @param {Parameters<typeof parametrosDeBusqueda>[0]} filtros
 * @returns {Promise<any[]>}
 */
export async function buscarTalleres(filtros) {
  return api.searchWorkshops(parametrosDeBusqueda(filtros));
}

/** @type {{ lat: number, lng: number } | null} */
let ultimaUbicacion = null;

/**
 * Ubicación del cliente. Con `preguntar: false` solo la usa si el permiso ya estaba concedido (no muestra el aviso).
 * @param {{ preguntar?: boolean }} [opciones]
 * @returns {Promise<{ lat: number, lng: number } | null>}
 */
export async function obtenerUbicacion(opciones = {}) {
  if (ultimaUbicacion) return ultimaUbicacion;
  if (!("geolocation" in navigator)) return null;
  if (opciones.preguntar !== true) {
    try {
      const permiso = await navigator.permissions?.query({ name: "geolocation" });
      if (permiso?.state !== "granted") return null;
    } catch {
      return null;
    }
  }
  return new Promise((resolver) => {
    navigator.geolocation.getCurrentPosition(
      (posicion) => {
        ultimaUbicacion = { lat: Number(posicion.coords.latitude.toFixed(5)), lng: Number(posicion.coords.longitude.toFixed(5)) };
        resolver(ultimaUbicacion);
      },
      () => resolver(null),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300_000 },
    );
  });
}

/**
 * Texto corto de los servicios ("Reparación · Limpieza").
 * @param {string[]} servicios
 * @returns {string}
 */
export function textoServicios(servicios) {
  return servicios.map((s) => NOMBRE_SERVICIO[/** @type {"repair" | "cleaning"} */ (s)] ?? s).join(" · ");
}

/**
 * Línea de calificación: estrellas, promedio (o "Nuevo") y distancia.
 * @param {any} taller
 * @returns {HTMLElement}
 */
export function crearLineaCalificacion(taller) {
  const partes = [taller.rating_avg === null ? "Nuevo" : `${taller.rating_avg.toFixed(1)}`];
  if (taller.distance_km !== null && taller.distance_km !== undefined) partes.push(`${taller.distance_km.toFixed(1)} km`);
  return crear("p", { clase: "tarjeta__detalle linea-calificacion" }, [crearEstrellas(taller.rating_avg), crear("span", { texto: partes.join(" · ") })]);
}

/**
 * Tarjeta de taller que lleva a su perfil: foto, nombre, servicios, calificación y distancia,
 * y abajo el precio "desde" junto al estado Abierto/Cerrado.
 * @param {any} taller ResultadoBusqueda
 * @param {{ mostrarHorario?: boolean }} [opciones] `mostrarHorario: false` oculta la etiqueta Abierto/Cerrado.
 * @returns {HTMLElement}
 */
export function crearTarjetaTaller(taller, opciones = {}) {
  const mostrarHorario = opciones.mostrarHorario !== false;
  return enlace(`/taller/${taller.id}`, { clase: "tarjeta tarjeta--enlace tarjeta-taller" }, [
    crearFoto(taller.profile_photo_url, `Foto de ${taller.name}`, undefined, taller.name),
    crear("div", { clase: "tarjeta__cuerpo" }, [
      crear("p", { clase: "tarjeta__titulo", texto: taller.name }),
      crear("p", { clase: "tarjeta__detalle tarjeta-taller__servicios", texto: textoServicios(taller.services) }),
      crearLineaCalificacion(taller),
      crear("div", { clase: "tarjeta-taller__pie" }, [
        crear("p", { clase: "tarjeta-taller__precio" }, [crear("span", { texto: "desde " }), crear("strong", { texto: formatearMxn(taller.price_from) })]),
        mostrarHorario ? crearInsignia(taller.is_open ? "Abierto" : "Cerrado", taller.is_open ? "exito" : "neutra") : null,
      ]),
    ]),
    icono("adelante", { clase: "tarjeta__flecha" }),
  ]);
}

/**
 * Pin del mapa con ícono del servicio (reparación en el acento, limpieza en azul marino).
 * @param {any} taller
 * @param {boolean} seleccionado
 * @returns {HTMLElement}
 */
function elementoPin(taller, seleccionado) {
  const soloLimpieza = taller.services.length === 1 && taller.services[0] === "cleaning";
  return crear("span", { clase: `pin${soloLimpieza ? " pin--cenote" : ""}${seleccionado ? " pin--seleccionado" : ""}` }, [
    icono(soloLimpieza ? "limpieza" : "reparacion", { tam: 16 }),
  ]);
}

/**
 * Pone un pin HTML en el mapa, con Leaflet o con Google según apis/config-mapa.js.
 * @param {any} mapa lo que devuelve crearMapaLeaflet
 * @param {{ lat: number, lng: number }} punto
 * @param {HTMLElement} elemento contenido del pin (`.pin` o el punto de tu ubicación)
 * @param {{ titulo?: string, alTocar?: () => void, centrado?: boolean }} [opciones]
 * @returns {{ mover: (punto: { lat: number, lng: number }) => void, remove: () => void }}
 */
export function ponerPin(mapa, punto, elemento, opciones = {}) {
  if (mapa.esGoogle) return crearPinGoogle(mapa, punto, elemento, opciones);
  const tam = opciones.centrado ? 16 : 36;
  const marcador = L.marker([punto.lat, punto.lng], {
    icon: L.divIcon({ html: elemento, className: "pin-contenedor", iconSize: [tam, tam], iconAnchor: opciones.centrado ? [tam / 2, tam / 2] : [18, 36] }),
    title: opciones.titulo ?? "",
    alt: opciones.titulo ?? "",
    keyboard: Boolean(opciones.alTocar),
  });
  if (opciones.alTocar) marcador.on("click", () => opciones.alTocar?.());
  marcador.addTo(mapa);
  return {
    mover: (nuevo) => marcador.setLatLng([nuevo.lat, nuevo.lng]),
    remove: () => marcador.remove(),
  };
}

/** @returns {HTMLElement} punto azul de "tu ubicación" */
const elementoUbicacion = () => crear("span", { clase: "pin-ubicacion", attrs: { "aria-hidden": "true" } });

/**
 * Crea un mapa de Leaflet con OpenStreetMap. Devuelve null si Leaflet no cargó (la pantalla sigue funcionando con la lista).
 * @param {HTMLElement} contenedor Debe estar en el documento.
 * @param {{ interactivo?: boolean, centro?: { lat: number, lng: number }, zoom?: number }} [opciones]
 * @returns {any | null} L.Map
 */
export function crearMapaLeaflet(contenedor, opciones = {}) {
  // Con llave de Google (apis/config-mapa.js) el mapa es de Google, con la misma forma que el de Leaflet.
  if (usaGoogleMaps()) return crearMapaGoogle(contenedor, { interactivo: opciones.interactivo, centro: opciones.centro ?? CENTRO_MERIDA, zoom: opciones.zoom ?? 13 });
  if (typeof L === "undefined") return null;
  const estilos = cargarEstilosLeaflet();
  const interactivo = opciones.interactivo !== false;
  const centro = opciones.centro ?? CENTRO_MERIDA;
  const mapa = L.map(contenedor, {
    zoomControl: false,
    attributionControl: true,
    // Sin desvanecido de mosaicos: la animación podía quedarse a medias (mapa deslavado) y en 3G no aporta.
    fadeAnimation: false,
    dragging: interactivo,
    scrollWheelZoom: interactivo,
    doubleClickZoom: interactivo,
    touchZoom: interactivo,
    keyboard: interactivo,
  }).setView([centro.lat, centro.lng], opciones.zoom ?? 13);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "© OpenStreetMap",
  }).addTo(mapa);
  // El contenedor puede cambiar de tamaño al terminar de pintarse la pantalla (fuentes, tarjetas):
  // se recalcula para que los mosaicos llenen todo el recuadro.
  requestAnimationFrame(() => {
    if (contenedor.isConnected) mapa.invalidateSize();
  });
  // Si la persona ya cambió de pantalla cuando llegan los estilos, el mapa ya no existe: no se toca.
  void estilos.then(() => {
    if (contenedor.isConnected) mapa.invalidateSize();
  });
  return mapa;
}

/**
 * Quita un mapa al salir de la pantalla. Si la persona se va a media animación de zoom, Leaflet la terminaría después
 * sobre un mapa ya quitado (error "_leaflet_pos" en la consola): se termina antes de quitarlo.
 * @param {any} mapa L.Map
 */
export function quitarMapa(mapa) {
  try {
    if (mapa._animatingZoom) mapa._onZoomTransitionEnd();
    mapa.stop();
    mapa.remove();
  } catch {
    // El mapa ya no estaba en la pantalla.
  }
}

/** @type {Promise<void> | null} */
let estilosLeaflet = null;

/**
 * Carga leaflet.css la primera vez que se abre un mapa (no en el arranque: así no retrasa la primera
 * pantalla). Va al final de <head>, el mismo lugar que tenía antes en index.html.
 * @returns {Promise<void>} se resuelve al cargar (o al fallar: el mapa funciona igual, solo sin estilos).
 */
export function cargarEstilosLeaflet() {
  estilosLeaflet ??= new Promise((resolver) => {
    const enlace = document.createElement("link");
    enlace.rel = "stylesheet";
    enlace.href = "front/js/vendor/leaflet.css";
    enlace.addEventListener("load", () => resolver(), { once: true });
    enlace.addEventListener("error", () => resolver(), { once: true });
    document.head.append(enlace);
  });
  return estilosLeaflet;
}

/**
 * Pinta los pines de los talleres y ajusta la vista. `alElegir` recibe el taller tocado.
 * @param {any} mapa L.Map
 * @param {any[]} talleres
 * @param {{ ubicacion?: { lat: number, lng: number } | null, alElegir?: (taller: any) => void, seleccionado?: string | null, margen?: { arriba: number, abajo: number }, ajustar?: boolean }} [opciones]
 *   `margen`: px que tapan otros elementos arriba y abajo (buscador, tarjeta), para que ningún pin quede debajo.
 *   `ajustar: false`: no mueve la vista (al elegir un pin).
 * @returns {any} L.LayerGroup
 */
export function pintarPines(mapa, talleres, opciones = {}) {
  /** @type {Array<{ remove: () => void }>} */
  const pines = [];
  // Capa con la misma forma que un L.LayerGroup para quien la quita (capa.remove()).
  const capa = { remove: () => pines.forEach((p) => p.remove()) };
  /** @type {Array<[number, number]>} */
  const puntos = [];
  for (const taller of talleres) {
    pines.push(
      ponerPin(mapa, { lat: taller.lat, lng: taller.lng }, elementoPin(taller, taller.id === opciones.seleccionado), {
        titulo: taller.name,
        alTocar: opciones.alElegir ? () => opciones.alElegir?.(taller) : undefined,
      }),
    );
    puntos.push([taller.lat, taller.lng]);
  }
  if (opciones.ubicacion) {
    pines.push(ponerPin(mapa, opciones.ubicacion, elementoUbicacion(), { titulo: "Tu ubicación", centrado: true }));
    puntos.push([opciones.ubicacion.lat, opciones.ubicacion.lng]);
  }
  const margen = opciones.margen ?? { arriba: 0, abajo: 0 };
  if (opciones.ajustar === false) return capa;
  if (puntos.length > 1) mapa.fitBounds(puntos, { paddingTopLeft: [40, 40 + margen.arriba], paddingBottomRight: [40, 40 + margen.abajo], maxZoom: 15 });
  else if (puntos.length === 1) mapa.setView(puntos[0], 15);
  return capa;
}
