// 09 · Perfil del taller (CU-02): calificación, servicios, horario, precio "desde", trabajos recientes y Solicitar cotización.
import { api as apiSolicitudes } from "../../requests/index.js";
import { estadoDeHoy, urlComoLlegar } from "../../orders/pages/recoger.js";
import { crear, enlace } from "../../../ui/dom.js";
import { cargarEn } from "../../../ui/estados.js";
import { crearFoto } from "../../../ui/foto.js";
import { icono } from "../../../ui/iconos.js";
import { crearEstrellas, crearInsignia, crearPantalla } from "../../../ui/layout.js";
import { formatearMxn } from "../../../lib/money.js";
import { NOMBRE_SERVICIO, obtenerUbicacion } from "../componentes.js";
import { api } from "../index.js";

const DIAS = /** @type {const} */ ([
  ["mon", "Lunes"],
  ["tue", "Martes"],
  ["wed", "Miércoles"],
  ["thu", "Jueves"],
  ["fri", "Viernes"],
  ["sat", "Sábado"],
  ["sun", "Domingo"],
]);

/** Qué incluye cada servicio (mismos textos que las categorías de Inicio). */
const DETALLE_SERVICIO = Object.freeze({ repair: "Suelas, costuras, tacones", cleaning: "Lavado, desinfección, tinte" });

/**
 * Filas del horario ("Lunes · 09:00–18:00" o "Cerrado").
 * @param {Record<string, { open: string, close: string }[]> | null} horario
 * @returns {{ dia: string, texto: string }[]}
 */
export function filasHorario(horario) {
  return DIAS.map(([clave, dia]) => {
    const rangos = horario?.[clave] ?? [];
    return { dia, texto: rangos.length === 0 ? "Cerrado" : rangos.map((r) => `${r.open}–${r.close}`).join(", ") };
  });
}

/**
 * Índice de hoy en `filasHorario` (lunes = 0).
 * @param {Date} [ahora]
 * @returns {number}
 */
export function indiceDeHoy(ahora = new Date()) {
  return (ahora.getDay() + 6) % 7;
}

// Vive en recoger.js junto a textoHorarioHoy; se reexporta para las pruebas y otros usos.
export { estadoDeHoy };

/** @param {"repair" | "cleaning"} servicio */
function crearServicio(servicio) {
  return crear("li", { clase: `servicio servicio--${servicio}` }, [
    crear("span", { clase: "servicio__icono", attrs: { "aria-hidden": "true" } }, [icono(servicio === "cleaning" ? "limpieza" : "reparacion", { tam: 20 })]),
    crear("div", { clase: "servicio__texto" }, [
      crear("p", { clase: "servicio__nombre", texto: NOMBRE_SERVICIO[servicio] }),
      crear("p", { clase: "tarjeta__detalle", texto: DETALLE_SERVICIO[servicio] }),
    ]),
  ]);
}

/** @param {any} taller */
function crearAccionesRapidas(taller) {
  const botones = [];
  if (taller.lat !== null && taller.lng !== null) {
    botones.push(
      crear("a", { clase: "accion-rapida", attrs: { href: urlComoLlegar(taller.lat, taller.lng), target: "_blank", rel: "noopener noreferrer" } }, [
        icono("navegar", { tam: 18 }),
        crear("span", { texto: "Cómo llegar" }),
      ]),
    );
  }
  if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
    const compartir = () => navigator.share({ title: taller.name, text: `${taller.name} en MiXanab`, url: location.href }).catch(() => {});
    botones.push(
      crear("button", { clase: "accion-rapida", attrs: { type: "button" }, on: { click: compartir } }, [icono("subir", { tam: 18 }), crear("span", { texto: "Compartir" })]),
    );
  }
  return botones.length === 0 ? null : crear("div", { clase: "acciones-rapidas" }, botones);
}

/** @param {any} taller */
function crearHorario(taller) {
  const hoy = indiceDeHoy();
  const filas = filasHorario(taller.hours);
  return crear("details", { clase: "seccion perfil-taller__horario" }, [
    crear("summary", {}, [
      crear("span", { clase: "seccion__titulo", texto: "Horario" }),
      crear("span", { clase: "perfil-taller__hoy", texto: `Hoy · ${filas[hoy].texto}` }),
      icono("adelante", { tam: 18, clase: "perfil-taller__chevron" }),
    ]),
    crear(
      "dl",
      { clase: "horario" },
      filas.flatMap(({ dia, texto }, i) => {
        const clase = i === hoy ? "horario__hoy" : "";
        return [crear("dt", { clase, texto: i === hoy ? `${dia} (hoy)` : dia }), crear("dd", { clase, texto })];
      }),
    ),
  ]);
}

/** @param {any} taller */
function pintarPerfil(taller) {
  const portada = taller.photos.find((/** @type {any} */ f) => f.kind === "profile");
  const trabajos = taller.photos.filter((/** @type {any} */ f) => f.kind === "work");
  const resenas = taller.rating_count === 1 ? "1 reseña" : `${taller.rating_count} reseñas`;
  const distancia = taller.distance_km === null ? "" : ` · ${taller.distance_km.toFixed(1)} km`;
  const estado = estadoDeHoy(taller);

  const acciones = crear("div", { clase: "acciones perfil-taller__acciones" }, [
    enlace(`/solicitar/${taller.id}`, { clase: "boton boton--bloque" }, [crear("span", { texto: "Solicitar cotización" })]),
  ]);
  // Si ya hay una solicitud viva con este taller, el botón de chat lleva a esa conversación.
  apiSolicitudes
    .listMyRequests()
    .then((solicitudes) => {
      const viva = solicitudes.find((s) => s.workshop_id === taller.id && ["open", "quoted", "accepted"].includes(s.status));
      if (viva) acciones.prepend(enlace(`/chat/${viva.id}`, { clase: "boton boton--secundario boton--icono", attrs: { "aria-label": "Abrir el chat con el taller" } }, [icono("chat")]));
    })
    .catch(() => {});

  return [
    crear("div", { clase: "perfil-taller__portada" }, [crearFoto(portada?.url, `Foto de ${taller.name}`, "perfil-taller__foto", taller.name)]),
    crear("article", { clase: "perfil-taller__hoja" }, [
      crear("header", { clase: "perfil-taller__encabezado" }, [
        crear("h1", { clase: "perfil-taller__nombre", texto: taller.name }),
        crear("p", { clase: "tarjeta__detalle linea-calificacion" }, [
          crearEstrellas(taller.rating_avg),
          crear("span", { texto: taller.rating_avg === null ? `Nuevo${distancia}` : `${taller.rating_avg.toFixed(1)} (${resenas})${distancia}` }),
        ]),
        crear("p", { clase: "tarjeta__detalle linea-icono" }, [icono("mapa", { tam: 14 }), crear("span", { texto: `${taller.address}, ${taller.colonia}, Mérida` })]),
        crear("div", { clase: "perfil-taller__estado" }, [crearInsignia(estado.texto, estado.tono)]),
      ]),
      crearAccionesRapidas(taller),
      crear("section", { clase: "seccion perfil-taller__seccion perfil-taller__servicios" }, [
        crear("h2", { clase: "seccion__titulo", texto: "Servicios" }),
        crear("ul", { clase: "lista servicios" }, taller.services.map(crearServicio)),
        crear("div", { clase: "precio-desde" }, [
          crear("div", {}, [crear("p", { clase: "precio-desde__etiqueta", texto: "Precio desde" }), crear("p", { clase: "precio-desde__monto", texto: formatearMxn(taller.price_from) })]),
          crear("p", { clase: "precio-desde__nota", texto: "El precio final viene en el presupuesto. Pagas al recoger." }),
        ]),
      ]),
      crear("section", { clase: "seccion perfil-taller__seccion perfil-taller__trabajos" }, [
        crear("div", { clase: "seccion__encabezado" }, [
          crear("h2", { clase: "seccion__titulo", texto: "Trabajos recientes" }),
          trabajos.length > 0 ? crear("span", { clase: "tarjeta__detalle", texto: trabajos.length === 1 ? "1 foto" : `${trabajos.length} fotos` }) : null,
        ]),
        trabajos.length === 0
          ? crear("p", { clase: "texto-secundario", texto: "Este taller aún no sube fotos de sus trabajos." })
          : crear(
              "div",
              { clase: "carrusel", attrs: { role: "list", "aria-label": `Trabajos de ${taller.name}` } },
              trabajos.slice(0, 10).map((/** @type {any} */ f, /** @type {number} */ i) =>
                crear("div", { clase: "carrusel__item", attrs: { role: "listitem" } }, [crearFoto(f.url, `Trabajo ${i + 1} de ${taller.name}`)]),
              ),
            ),
      ]),
      crearHorario(taller),
    ]),
    acciones,
  ];
}

/** @param {import("../../../router.js").Contexto} contexto */
export async function renderPerfilTaller({ params }) {
  const contenido = crear("div", { clase: "perfil-taller__contenido" });
  const pantalla = crearPantalla({ rol: "client", activa: "mapa", volver: "/mapa", clase: "perfil-taller" }, [contenido]);
  cargarEn(
    contenido,
    async () => api.getWorkshopProfile(params.id, (await obtenerUbicacion()) ?? undefined),
    pintarPerfil,
    { not_found: "Este taller ya no está disponible.", invalid_input: "Este taller ya no está disponible." },
  );
  return pantalla;
}
