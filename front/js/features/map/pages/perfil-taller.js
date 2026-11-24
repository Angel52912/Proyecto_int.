// 09 · Perfil del taller (CU-02): calificación, servicios, horario, precio "desde", trabajos recientes y Solicitar cotización.
import { api as apiSolicitudes } from "../../requests/index.js";
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

/** @param {any} taller */
function pintarPerfil(taller) {
  const portada = taller.photos.find((/** @type {any} */ f) => f.kind === "profile");
  const trabajos = taller.photos.filter((/** @type {any} */ f) => f.kind === "work");
  const resenas = taller.rating_count === 1 ? "1 reseña" : `${taller.rating_count} reseñas`;
  const distancia = taller.distance_km === null ? "" : ` · ${taller.distance_km.toFixed(1)} km`;

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
      crear("h1", { clase: "perfil-taller__nombre", texto: taller.name }),
      crear("p", { clase: "tarjeta__detalle linea-calificacion" }, [
        crearEstrellas(taller.rating_avg),
        crear("span", { texto: taller.rating_avg === null ? `Nuevo${distancia}` : `${taller.rating_avg.toFixed(1)} (${resenas})${distancia}` }),
      ]),
      crear("p", { clase: "tarjeta__detalle linea-icono" }, [icono("mapa", { tam: 14 }), crear("span", { texto: `${taller.address}, ${taller.colonia}, Mérida` })]),
      crear("div", { clase: "chips" }, [
        ...taller.services.map((/** @type {"repair" | "cleaning"} */ s) => crearInsignia(NOMBRE_SERVICIO[s], s === "cleaning" ? "cenote" : "cuero")),
        crearInsignia(taller.is_open ? "Abierto ahora" : "Cerrado ahora", taller.is_open ? "exito" : "neutra"),
      ]),
      crear("p", { clase: "perfil-taller__precio" }, [crear("span", { texto: "Precio desde " }), crear("strong", { texto: formatearMxn(taller.price_from) })]),
      crear("section", { clase: "seccion" }, [
        crear("h2", { clase: "seccion__titulo", texto: "Trabajos recientes" }),
        trabajos.length === 0
          ? crear("p", { clase: "texto-secundario", texto: "Este taller aún no sube fotos de sus trabajos." })
          : crear(
              "div",
              { clase: "galeria" },
              trabajos.slice(0, 6).map((/** @type {any} */ f, /** @type {number} */ i) => crearFoto(f.url, `Trabajo ${i + 1} de ${taller.name}`)),
            ),
      ]),
      crear("details", { clase: "seccion perfil-taller__horario" }, [
        crear("summary", { clase: "seccion__titulo", texto: "Horario" }),
        crear(
          "dl",
          { clase: "horario" },
          filasHorario(taller.hours).flatMap(({ dia, texto }) => [crear("dt", { texto: dia }), crear("dd", { texto })]),
        ),
      ]),
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

