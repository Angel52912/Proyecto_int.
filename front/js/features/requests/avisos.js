// Avisos (notificaciones) de cliente y artesano: texto y destino de cada tipo, y la campana con contador en vivo.
import { NOMBRE_FASE } from "../orders/fases.js";
import { alSalir } from "../../ui/ciclo.js";
import { crear, enlace } from "../../ui/dom.js";
import { icono } from "../../ui/iconos.js";
import { api } from "./index.js";

/** @typedef {"client" | "craftsman"} RolAvisos */
/** @typedef {{ titulo: string, detalle: string, ruta: string | null, icono: string }} TextoAviso */

/** Pantalla de avisos de cada rol. */
export const RUTA_AVISOS = Object.freeze({ client: "/avisos", craftsman: "/artesano/avisos" });

/**
 * Texto y destino de un aviso según su `type` y `payload` (docs/contrato-api.md). Los tipos desconocidos se muestran
 * con un texto genérico y sin destino.
 * @param {{ type: string, payload: Record<string, any> }} aviso
 * @returns {TextoAviso}
 */
export function textoDelAviso({ type, payload }) {
  const p = payload ?? {};
  switch (type) {
    case "request_received":
      return { titulo: "Nueva solicitud", detalle: "Un cliente te pidió una cotización.", ruta: p.request_id ? `/artesano/chat/${p.request_id}` : null, icono: "solicitudes" };
    case "request_cancelled":
      return { titulo: "Solicitud cancelada", detalle: "El cliente canceló su solicitud.", ruta: p.request_id ? `/artesano/chat/${p.request_id}` : null, icono: "cerrar" };
    case "quote_received":
      return { titulo: "Te enviaron un presupuesto", detalle: "Revísalo y decide si lo aceptas.", ruta: p.quote_id ? `/presupuesto/${p.quote_id}` : null, icono: "dinero" };
    case "quote_accepted":
      return { titulo: "Presupuesto aceptado", detalle: "El cliente aceptó; ya puedes empezar el pedido.", ruta: p.order_id ? `/artesano/pedido/${p.order_id}` : null, icono: "check" };
    case "quote_rejected":
      return { titulo: "Presupuesto rechazado", detalle: "Puedes enviar uno nuevo desde el chat.", ruta: p.request_id ? `/artesano/chat/${p.request_id}` : null, icono: "dinero" };
    case "order_created":
      return { titulo: "Pedido confirmado", detalle: "El taller empezará a trabajar en tu calzado.", ruta: p.order_id ? `/pedido/${p.order_id}` : null, icono: "pedidos" };
    case "order_phase_changed": {
      const fase = NOMBRE_FASE[/** @type {number} */ (p.phase)];
      const detalle = fase ? `${p.corrected ? "Se corrigió la fase: ahora" : "Ahora"} está en ${fase}.` : "Hay un avance en tu pedido.";
      return { titulo: "Tu pedido avanzó", detalle, ruta: p.order_id ? `/pedido/${p.order_id}` : null, icono: "reparacion" };
    }
    case "order_ready":
      return { titulo: "¡Tu pedido está listo!", detalle: "Pasa a recogerlo con tu código QR o PIN.", ruta: p.order_id ? `/pedido/${p.order_id}/recoger` : null, icono: "qr" };
    case "order_delivered":
      return { titulo: "Pedido entregado", detalle: "Cuéntanos cómo te fue y califica al taller.", ruta: p.order_id ? `/pedido/${p.order_id}/calificar` : null, icono: "estrella" };
    case "review_received": {
      const estrellas = Number(p.rating);
      const detalle = Number.isInteger(estrellas) ? `Te calificaron con ${estrellas} ${estrellas === 1 ? "estrella" : "estrellas"}.` : "Un cliente calificó tu trabajo.";
      return { titulo: "Nueva calificación", detalle, ruta: "/artesano/perfil", icono: "estrella" };
    }
    case "workshop_suspended":
      return { titulo: "Tu taller fue suspendido", detalle: "No aparece en las búsquedas. Escríbenos si crees que es un error.", ruta: "/artesano/taller", icono: "escudo" };
    case "workshop_reactivated":
      return { titulo: "Tu taller está activo de nuevo", detalle: "Ya aparece en las búsquedas.", ruta: "/artesano/taller", icono: "escudo" };
    default:
      return { titulo: "Aviso", detalle: "Tienes una novedad.", ruta: null, icono: "campana" };
  }
}

/**
 * Texto del contador de la campana ("9+" a partir de 10). Vacío si no hay avisos sin leer.
 * @param {number} sinLeer
 * @returns {string}
 */
export function textoContador(sinLeer) {
  if (!Number.isFinite(sinLeer) || sinLeer <= 0) return "";
  return sinLeer > 9 ? "9+" : String(sinLeer);
}

/**
 * Campana que abre la pantalla de avisos, con el número de avisos sin leer al día (Realtime).
 * La suscripción se cancela al salir de la pantalla.
 * @param {RolAvisos} rol
 * @returns {HTMLAnchorElement}
 */
export function crearCampana(rol) {
  const contador = crear("span", { clase: "contador-avisos", attrs: { "aria-hidden": "true", hidden: true } });
  const campana = enlace(RUTA_AVISOS[rol], { clase: "boton-circular", attrs: { "aria-label": "Avisos" } }, [icono("campana"), contador]);
  let sinLeer = 0;
  const pintar = () => {
    const texto = textoContador(sinLeer);
    contador.textContent = texto;
    contador.hidden = texto === "";
    campana.setAttribute("aria-label", texto === "" ? "Avisos" : `Avisos, ${sinLeer} sin leer`);
  };

  let salio = false;
  /** @type {(() => void) | null} */
  let cancelar = null;
  alSalir(() => {
    salio = true;
    cancelar?.();
  });
  api
    .countUnreadNotifications()
    .then((n) => {
      sinLeer = n;
      pintar();
    })
    .catch(() => {});
  api
    .subscribeToNotifications(() => {
      sinLeer += 1;
      pintar();
    })
    .then((c) => {
      if (salio) c();
      else cancelar = c;
    })
    .catch(() => {});
  return campana;
}
