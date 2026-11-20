// Piezas compartidas por las pantallas de búsqueda (CU-02): búsqueda "Todos", ubicación, tarjeta y mapa de talleres.
import { crear, enlace } from "../../ui/dom.js";
import { crearFoto } from "../../ui/foto.js";
import { icono } from "../../ui/iconos.js";
import { crearEstrellas, crearInsignia } from "../../ui/layout.js";
import { formatearMxn } from "../../lib/money.js";
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
 * @param {Omit<import("./validar.js").FiltrosBusqueda, "service" | "order"> & { service: FiltroServicio, orden?: Orden }} filtros
 * @returns {import("./validar.js").FiltrosBusqueda}
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
 * Tarjeta de taller que lleva a su perfil.
 * @param {any} taller ResultadoBusqueda
 * @param {{ mostrarHorario?: boolean }} [opciones]
 * @returns {HTMLElement}
 */
export function crearTarjetaTaller(taller, opciones = {}) {
  return enlace(`/taller/${taller.id}`, { clase: "tarjeta tarjeta--enlace tarjeta-taller" }, [
    crearFoto(taller.profile_photo_url, `Foto de ${taller.name}`),
    crear("div", { clase: "tarjeta__cuerpo" }, [
      crear("p", { clase: "tarjeta__titulo", texto: taller.name }),
      crear("p", { clase: "tarjeta__detalle", texto: `${textoServicios(taller.services)} · desde ${formatearMxn(taller.price_from)}` }),
      crearLineaCalificacion(taller),
      opciones.mostrarHorario ? crearInsignia(taller.is_open ? "Abierto ahora" : "Cerrado", taller.is_open ? "exito" : "neutra") : null,
    ]),
    icono("adelante", { clase: "tarjeta__flecha" }),
  ]);
}

/**
 * Pin del mapa con ícono del servicio (reparación en Cuero, limpieza en Cenote).
 * @param {any} taller
 * @param {boolean} seleccionado
 * @returns {any} L.DivIcon
 */
function crearPin(taller, seleccionado) {
  const soloLimpieza = taller.services.length === 1 && taller.services[0] === "cleaning";
  const elemento = crear("span", { clase: `pin${soloLimpieza ? " pin--cenote" : ""}${seleccionado ? " pin--seleccionado" : ""}` }, [
    icono(soloLimpieza ? "limpieza" : "reparacion", { tam: 16 }),
  ]);
  return L.divIcon({ html: elemento, className: "pin-contenedor", iconSize: [36, 36], iconAnchor: [18, 36] });
}

/**
 * Crea un mapa de Leaflet con OpenStreetMap. Devuelve null si Leaflet no cargó (la pantalla sigue funcionando con la lista).
 * @param {HTMLElement} contenedor Debe estar en el documento.
 * @param {{ interactivo?: boolean, centro?: { lat: number, lng: number }, zoom?: number }} [opciones]
 * @returns {any | null} L.Map
 */
export function crearMapaLeaflet(contenedor, opciones = {}) {
  if (typeof L === "undefined") return null;
  const interactivo = opciones.interactivo !== false;
  const centro = opciones.centro ?? CENTRO_MERIDA;
  const mapa = L.map(contenedor, {
    zoomControl: false,
    attributionControl: true,
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
  return mapa;
}

/**
 * Pinta los pines de los talleres y ajusta la vista. `alElegir` recibe el taller tocado.
 * @param {any} mapa L.Map
 * @param {any[]} talleres
 * @param {{ ubicacion?: { lat: number, lng: number } | null, alElegir?: (taller: any) => void, seleccionado?: string | null }} [opciones]
 * @returns {any} L.LayerGroup
 */
export function pintarPines(mapa, talleres, opciones = {}) {
  const capa = L.layerGroup().addTo(mapa);
  const puntos = [];
  for (const taller of talleres) {
    const marcador = L.marker([taller.lat, taller.lng], {
      icon: crearPin(taller, taller.id === opciones.seleccionado),
      title: taller.name,
      alt: taller.name,
      keyboard: true,
    });
    if (opciones.alElegir) marcador.on("click", () => opciones.alElegir?.(taller));
    marcador.addTo(capa);
    puntos.push([taller.lat, taller.lng]);
  }
  if (opciones.ubicacion) {
    L.circleMarker([opciones.ubicacion.lat, opciones.ubicacion.lng], { radius: 8, color: "#fff", weight: 3, fillColor: "#1f7a7a", fillOpacity: 1 }).addTo(capa);
    puntos.push([opciones.ubicacion.lat, opciones.ubicacion.lng]);
  }
  if (puntos.length > 1) mapa.fitBounds(puntos, { padding: [40, 40], maxZoom: 15 });
  else if (puntos.length === 1) mapa.setView(puntos[0], 15);
  return capa;
}
