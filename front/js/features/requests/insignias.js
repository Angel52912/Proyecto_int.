// Notificaciones a la vista (revisión: "poco intuitivo"): contador de avisos sin leer en la pestaña que
// corresponde de la barra (Pedidos, Chats, Solicitudes…) y un aviso flotante, que se puede tocar, cuando
// llega una novedad mientras la persona usa la app. La campana y la pantalla Avisos siguen igual.
import { obtenerPerfilActual } from "../auth/guardia.js";
import { mostrarAvisoFlotante } from "../../ui/aviso-flotante.js";
import { crear } from "../../ui/dom.js";
import { textoContador, textoDelAviso } from "./avisos.js";
import { api } from "./index.js";

/** Pestaña de la barra donde cuenta cada tipo de aviso, por rol (ids de NAVEGACION en ui/layout.js). */
export const PESTANA_DEL_AVISO = Object.freeze({
  client: Object.freeze({
    quote_received: "chats",
    order_created: "pedidos",
    order_phase_changed: "pedidos",
    order_ready: "pedidos",
    order_delivered: "pedidos",
  }),
  craftsman: Object.freeze({
    request_received: "solicitudes",
    request_cancelled: "solicitudes",
    quote_rejected: "solicitudes",
    quote_accepted: "tablero",
    review_received: "perfil",
    workshop_suspended: "perfil",
    workshop_reactivated: "perfil",
  }),
});

/**
 * Cuántos avisos sin leer hay en cada pestaña.
 * @param {"client" | "craftsman"} rol
 * @param {{ type: string }[]} avisos
 * @returns {Record<string, number>}
 */
export function contarPorPestana(rol, avisos) {
  const mapa = /** @type {Record<string, string>} */ (PESTANA_DEL_AVISO[rol]);
  /** @type {Record<string, number>} */
  const conteo = {};
  for (const aviso of avisos) {
    const pestana = mapa[aviso.type];
    if (pestana) conteo[pestana] = (conteo[pestana] ?? 0) + 1;
  }
  return conteo;
}

/**
 * Pone (o quita) el contador en cada pestaña de la barra y en el avatar del perfil que estén en pantalla.
 * @param {Record<string, number>} conteo
 */
export function pintarContadores(conteo) {
  document.querySelectorAll(".nav-inferior__enlace[data-pestana], .barra__perfil[data-pestana]").forEach((enlace) => {
    const cantidad = conteo[/** @type {HTMLElement} */ (enlace).dataset.pestana ?? ""] ?? 0;
    let contador = enlace.querySelector(".nav-inferior__contador");
    if (cantidad === 0) {
      contador?.remove();
      return;
    }
    if (!contador) {
      contador = crear("span", { clase: "nav-inferior__contador" });
      enlace.append(contador);
    }
    // El número se ve; para el lector de pantalla se lee "Pedidos, 2 sin leer".
    contador.replaceChildren(crear("span", { texto: textoContador(cantidad), attrs: { "aria-hidden": "true" } }), crear("span", { clase: "oculto-visual", texto: `, ${cantidad} sin leer` }));
  });
}

/** @type {string | null} rol con el que se está escuchando */
let rolEscuchado = null;
/** @type {(() => void) | null} */
let dejarDeEscuchar = null;
/** @type {Promise<void> | null} */
let enCurso = null;

/** Lee los avisos sin leer y actualiza los contadores; (re)abre la escucha en vivo si cambió el rol. */
async function actualizar() {
  const perfil = await obtenerPerfilActual().catch(() => null);
  const rol = perfil?.role === "client" || perfil?.role === "craftsman" ? perfil.role : null;
  if (rol !== rolEscuchado) {
    dejarDeEscuchar?.();
    dejarDeEscuchar = null;
    rolEscuchado = rol;
    if (rol) {
      dejarDeEscuchar = await api
        .subscribeToNotifications((/** @type {any} */ aviso) => {
          const texto = textoDelAviso(aviso);
          mostrarAvisoFlotante(texto.titulo, { tono: "info", detalle: texto.detalle, ruta: texto.ruta, duracion: 6000 });
          void refrescar();
        })
        .catch(() => null);
    }
  }
  if (!rol) {
    pintarContadores({});
    return;
  }
  const avisos = await api.listMyNotifications({ unreadOnly: true }).catch(() => []);
  pintarContadores(contarPorPestana(rol, avisos));
}

/** Evita lecturas encimadas cuando se cambia rápido de pantalla. */
function refrescar() {
  enCurso ??= actualizar().finally(() => {
    enCurso = null;
  });
  return enCurso;
}

/** Se instala una vez: actualiza los contadores cada vez que el router termina de pintar una pantalla. */
export function instalarInsignias() {
  window.addEventListener("mixanab:pantalla", () => void refrescar());
}
