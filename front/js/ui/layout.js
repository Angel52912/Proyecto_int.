// Estructura común de las pantallas: barra superior (volver + título), cuerpo y navegación inferior por rol.
import { crear, enlace } from "./dom.js";
import { icono } from "./iconos.js";

/** @typedef {"client" | "craftsman" | "admin"} RolNavegacion */

/** Navegación inferior según docs/diseno.md. */
export const NAVEGACION = Object.freeze({
  client: [
    { id: "principal", ruta: "/principal", texto: "Principal", icono: "inicio" },
    { id: "mapa", ruta: "/mapa", texto: "Mapa", icono: "mapa" },
    { id: "pedidos", ruta: "/pedidos", texto: "Pedidos", icono: "pedidos" },
    { id: "perfil", ruta: "/perfil", texto: "Perfil", icono: "perfil" },
  ],
  craftsman: [
    { id: "solicitudes", ruta: "/artesano/solicitudes", texto: "Solicitudes", icono: "solicitudes" },
    { id: "tablero", ruta: "/artesano/tablero", texto: "Tablero", icono: "tablero" },
    { id: "chats", ruta: "/artesano/chats", texto: "Chats", icono: "chat" },
    { id: "perfil", ruta: "/artesano/perfil", texto: "Perfil", icono: "perfil" },
  ],
  // Panel de administración (CU-08): no viene en el Figma; sigue el mismo patrón de 4 pestañas.
  admin: [
    { id: "panel", ruta: "/admin", texto: "Panel", icono: "tablero" },
    { id: "usuarios", ruta: "/admin/usuarios", texto: "Usuarios", icono: "perfil" },
    { id: "talleres", ruta: "/admin/talleres", texto: "Talleres", icono: "reparacion" },
    { id: "resenas", ruta: "/admin/resenas", texto: "Reseñas", icono: "estrella" },
  ],
});

/**
 * @param {RolNavegacion} rol
 * @param {string | undefined} activa
 * @returns {HTMLElement}
 */
export function crearNavegacion(rol, activa) {
  const elementos = NAVEGACION[rol].map((item) =>
    crear("li", {}, [
      enlace(item.ruta, { clase: "nav-inferior__enlace", attrs: { "aria-current": item.id === activa ? "page" : null } }, [
        icono(item.icono, { tam: 22 }),
        crear("span", { texto: item.texto }),
      ]),
    ]),
  );
  // Logo de la marca: solo se ve en la barra lateral de escritorio (layout.css); decorativo.
  const marca = crear("span", { clase: "nav-inferior__marca", attrs: { "aria-hidden": "true" } }, [icono("destello", { tam: 22 })]);
  return crear("nav", { clase: "nav-inferior", attrs: { "aria-label": "Navegación principal" } }, [marca, crear("ul", {}, elementos)]);
}

/**
 * @typedef {object} OpcionesPantalla
 * @property {RolNavegacion} [rol] Muestra la navegación inferior de ese rol.
 * @property {string} [activa] Id de la pestaña activa.
 * @property {string} [titulo] Título de la barra superior (h1).
 * @property {string} [volver] Ruta del botón Volver.
 * @property {Node | null} [accion] Botón a la derecha de la barra.
 * @property {string} [clase] Clase extra de la pantalla (para su hoja CSS).
 * @property {boolean} [oscura] Variante oscura (Verificar entrega).
 */

/**
 * @param {OpcionesPantalla} opciones
 * @param {Array<Node | null | undefined | false>} contenido
 * @returns {HTMLElement}
 */
export function crearPantalla(opciones, contenido) {
  const barra =
    opciones.titulo !== undefined || opciones.volver !== undefined
      ? crear("header", { clase: "barra" }, [
          opciones.volver !== undefined
            ? enlace(opciones.volver, { clase: "barra__volver", attrs: { "aria-label": "Volver" } }, [icono("atras", { tam: 22 })])
            : null,
          crear("h1", { clase: "barra__titulo", texto: opciones.titulo ?? "" }),
          opciones.accion ?? null,
        ])
      : null;
  const clases = ["pantalla", opciones.clase, opciones.rol ? "pantalla--con-nav" : "", opciones.oscura ? "pantalla--oscura" : ""];
  return crear("div", { clase: clases.filter(Boolean).join(" ") }, [
    barra,
    crear("div", { clase: "pantalla__cuerpo" }, contenido),
    opciones.rol ? crearNavegacion(opciones.rol, opciones.activa) : null,
  ]);
}

/**
 * Botón de acción con ícono opcional.
 * @param {string} texto
 * @param {{ variante?: "principal" | "secundario" | "cenote" | "miel", icono?: string, tipo?: "button" | "submit", alHacerClic?: EventListener, bloque?: boolean }} [opciones]
 * @returns {HTMLButtonElement}
 */
export function crearBoton(texto, opciones = {}) {
  const variante = opciones.variante ?? "principal";
  const clases = ["boton", variante === "principal" ? "" : `boton--${variante}`, opciones.bloque === false ? "" : "boton--bloque"];
  return /** @type {HTMLButtonElement} */ (
    crear(
      "button",
      {
        clase: clases.filter(Boolean).join(" "),
        attrs: { type: opciones.tipo ?? "button" },
        on: opciones.alHacerClic ? { click: opciones.alHacerClic } : {},
      },
      [opciones.icono ? icono(opciones.icono, { tam: 18 }) : null, crear("span", { texto })],
    )
  );
}

/**
 * Etiqueta de estado ("Nueva", "En proceso").
 * @param {string} texto
 * @param {"miel" | "cenote" | "exito" | "cuero" | "error" | "neutra"} [tono]
 * @returns {HTMLElement}
 */
export function crearInsignia(texto, tono = "neutra") {
  return crear("span", { clase: `insignia insignia--${tono}`, texto });
}

/**
 * Barra de progreso accesible (0 a 1).
 * @param {number} valor
 * @param {string} etiqueta
 * @returns {HTMLElement}
 */
export function crearProgreso(valor, etiqueta) {
  const porcentaje = Math.round(Math.max(0, Math.min(1, valor)) * 100);
  const relleno = crear("div", { clase: "progreso__relleno" });
  relleno.style.width = `${porcentaje}%`;
  return crear(
    "div",
    { clase: "progreso", attrs: { role: "progressbar", "aria-valuemin": 0, "aria-valuemax": 100, "aria-valuenow": porcentaje, "aria-label": etiqueta } },
    [relleno],
  );
}

/**
 * Estrellas de calificación (solo lectura).
 * @param {number | null} calificacion
 * @returns {HTMLElement}
 */
export function crearEstrellas(calificacion) {
  const valor = calificacion ?? 0;
  const estrellas = [1, 2, 3, 4, 5].map((n) => icono("estrella", { tam: 14, relleno: n <= Math.round(valor), clase: n <= Math.round(valor) ? "estrella--llena" : "estrella--vacia" }));
  return crear("span", { clase: "estrellas", attrs: { role: "img", "aria-label": calificacion === null ? "Sin calificaciones" : `${valor} de 5 estrellas` } }, estrellas);
}

/** Palabras de enlace que no cuentan para las iniciales ("Limpieza de Tenis" → "LT"). */
const CONECTORES = new Set(["de", "del", "la", "las", "los", "el", "y"]);

/**
 * Iniciales para avatares ("José Cámara" → "JC").
 * @param {string | null | undefined} nombre
 * @returns {string}
 */
export function iniciales(nombre) {
  const partes = String(nombre ?? "").trim().split(/\s+/).filter(Boolean);
  const utiles = partes.filter((p) => !CONECTORES.has(p.toLowerCase()));
  return (utiles.length > 0 ? utiles : partes).slice(0, 2).map((p) => p[0].toUpperCase()).join("") || "?";
}
