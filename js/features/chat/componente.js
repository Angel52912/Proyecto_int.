// Componente de chat reutilizable (CU-03) para cliente y artesano: historial paginado, envío y tiempo real.
// Todo el texto de los mensajes se pinta con textContent (nunca HTML).
import { formatearFecha, formatearHora } from "../../lib/fechas.js";
import { crear } from "../../ui/dom.js";
import { crearCargando, crearError } from "../../ui/estados.js";
import { icono } from "../../ui/iconos.js";
import { mensajeDeError } from "../../ui/mensajes.js";
import { MAX_MENSAJE } from "../requests/validar.js";
import { api } from "./index.js";

const POR_PAGINA = 50;

/**
 * @typedef {{ id: string, request_id: string, sender_id: string | null, body: string, kind: "text" | "quote_card" | "system", quote_id: string | null, created_at: string }} Mensaje
 *
 * @typedef {object} OpcionesChat
 * @property {string} requestId
 * @property {(mensaje: Mensaje) => boolean} esPropio Decide si el mensaje es del usuario actual (va a la derecha).
 * @property {boolean} [puedeEscribir] La solicitud admite mensajes (open, quoted o accepted).
 * @property {(mensaje: Mensaje) => Node} [crearTarjeta] Contenido de los mensajes `quote_card`.
 *
 * @typedef {object} Chat
 * @property {HTMLElement} elemento
 * @property {(puede: boolean, motivo?: string) => void} permitirEscritura
 * @property {() => void} destruir Cancela la suscripción de tiempo real.
 */

/**
 * @param {OpcionesChat} opciones
 * @returns {Chat}
 */
export function crearChat(opciones) {
  /** @type {Map<string, Mensaje>} */
  const mensajes = new Map();
  /** @type {(() => void) | null} */
  let cancelarSuscripcion = null;
  let destruido = false;
  let hayAnteriores = false;

  const lista = crear("ol", { clase: "chat__lista", attrs: { role: "log", "aria-live": "polite", "aria-label": "Mensajes" } });
  const botonAnteriores = crear("button", {
    clase: "boton-texto chat__anteriores",
    texto: "Ver mensajes anteriores",
    attrs: { type: "button", hidden: true },
    on: { click: () => cargarAnteriores() },
  });
  const zona = crear("div", { clase: "chat__zona" }, [botonAnteriores, lista]);

  const entrada = /** @type {HTMLTextAreaElement} */ (
    crear("textarea", { clase: "chat__entrada", attrs: { rows: 1, maxlength: MAX_MENSAJE, placeholder: "Escribe un mensaje", "aria-label": "Mensaje" } })
  );
  const enviar = /** @type {HTMLButtonElement} */ (crear("button", { clase: "chat__enviar", attrs: { type: "submit", "aria-label": "Enviar mensaje" } }, [icono("enviar", { tam: 18 })]));
  const avisoEnvio = crear("p", { clase: "campo__error chat__aviso", attrs: { "aria-live": "polite" } });
  const formulario = crear("form", { clase: "chat__composer" }, [entrada, enviar]);
  const cerrado = crear("p", { clase: "chat__cerrado texto-secundario", attrs: { hidden: true } });

  const elemento = crear("section", { clase: "chat", attrs: { "aria-label": "Conversación" } }, [zona, avisoEnvio, formulario, cerrado]);

  /** @param {boolean} puede @param {string} [motivo] */
  function permitirEscritura(puede, motivo = "Esta conversación ya no admite mensajes.") {
    formulario.hidden = !puede;
    cerrado.hidden = puede;
    cerrado.textContent = motivo;
  }
  permitirEscritura(opciones.puedeEscribir !== false);

  /** @param {Mensaje} mensaje */
  function crearBurbuja(mensaje) {
    if (mensaje.kind === "system") {
      return crear("li", { clase: "chat__sistema", attrs: { "data-id": mensaje.id } }, [crear("span", { texto: mensaje.body })]);
    }
    const propio = opciones.esPropio(mensaje);
    const contenido =
      mensaje.kind === "quote_card" && opciones.crearTarjeta
        ? opciones.crearTarjeta(mensaje)
        : crear("p", { clase: "chat__texto", texto: mensaje.body });
    return crear("li", { clase: `chat__mensaje${propio ? " chat__mensaje--propio" : ""}${mensaje.kind === "quote_card" ? " chat__mensaje--tarjeta" : ""}`, attrs: { "data-id": mensaje.id } }, [
      crear("span", { clase: "oculto-visual", texto: propio ? "Tú dijiste:" : "Mensaje recibido:" }),
      contenido,
      crear("time", { clase: "chat__hora", texto: formatearHora(mensaje.created_at), attrs: { datetime: mensaje.created_at, title: formatearFecha(mensaje.created_at) } }),
    ]);
  }

  function pintar() {
    const ordenados = [...mensajes.values()].sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id));
    if (ordenados.length === 0) {
      lista.replaceChildren(crear("li", { clase: "chat__vacio texto-secundario", texto: "Aún no hay mensajes. Escribe el primero." }));
      return;
    }
    lista.replaceChildren(...ordenados.map(crearBurbuja));
  }

  function alFinal() {
    zona.scrollTop = zona.scrollHeight;
  }

  function cercaDelFinal() {
    return zona.scrollHeight - zona.scrollTop - zona.clientHeight < 120;
  }

  /** @param {Mensaje} mensaje */
  function agregar(mensaje) {
    if (destruido || mensajes.has(mensaje.id)) return; // Realtime también envía los propios: se evita duplicar por id.
    const seguir = cercaDelFinal();
    mensajes.set(mensaje.id, mensaje);
    pintar();
    if (seguir || opciones.esPropio(mensaje)) alFinal();
  }

  async function cargarAnteriores() {
    const primero = [...mensajes.values()].sort((a, b) => a.created_at.localeCompare(b.created_at))[0];
    if (!primero) return;
    const alturaAntes = zona.scrollHeight;
    try {
      const anteriores = await api.listMessages(opciones.requestId, { limit: POR_PAGINA, before: primero.created_at });
      anteriores.forEach((/** @type {Mensaje} */ m) => mensajes.set(m.id, m));
      hayAnteriores = anteriores.length === POR_PAGINA;
      botonAnteriores.hidden = !hayAnteriores;
      pintar();
      zona.scrollTop = zona.scrollHeight - alturaAntes;
    } catch (error) {
      avisoEnvio.textContent = mensajeDeError(error);
    }
  }

  async function iniciar() {
    lista.replaceChildren(crear("li", {}, [crearCargando("Cargando mensajes…")]));
    try {
      const iniciales = await api.listMessages(opciones.requestId, { limit: POR_PAGINA });
      iniciales.forEach((/** @type {Mensaje} */ m) => mensajes.set(m.id, m));
      hayAnteriores = iniciales.length === POR_PAGINA;
      botonAnteriores.hidden = !hayAnteriores;
      pintar();
      requestAnimationFrame(alFinal);
    } catch (error) {
      lista.replaceChildren(crear("li", {}, [crearError(mensajeDeError(error, { not_found: "No encontramos esta conversación." }), iniciar)]));
      return;
    }
    try {
      const cancelar = await api.subscribeToMessages(opciones.requestId, agregar);
      if (destruido) cancelar();
      else cancelarSuscripcion = cancelar;
    } catch {
      avisoEnvio.textContent = "No pudimos conectar el chat en tiempo real. Recarga para ver mensajes nuevos.";
    }
  }

  async function alEnviar(/** @type {Event} */ evento) {
    evento.preventDefault();
    const texto = entrada.value.trim();
    if (texto === "") return;
    enviar.disabled = true;
    avisoEnvio.textContent = "";
    try {
      const mensaje = await api.sendMessage(opciones.requestId, texto);
      entrada.value = "";
      ajustarAltura();
      agregar(mensaje);
    } catch (error) {
      avisoEnvio.textContent = mensajeDeError(error, { forbidden: "Esta conversación ya no admite mensajes." });
    } finally {
      enviar.disabled = false;
      entrada.focus();
    }
  }

  function ajustarAltura() {
    entrada.style.height = "auto";
    entrada.style.height = `${Math.min(entrada.scrollHeight, 120)}px`;
  }

  formulario.addEventListener("submit", alEnviar);
  entrada.addEventListener("input", ajustarAltura);
  entrada.addEventListener("keydown", (evento) => {
    // Enter envía; Shift+Enter hace salto de línea.
    if (evento.key === "Enter" && !evento.shiftKey && !evento.isComposing) {
      evento.preventDefault();
      formulario.requestSubmit();
    }
  });

  iniciar();

  return {
    elemento,
    permitirEscritura,
    destruir() {
      destruido = true;
      cancelarSuscripcion?.();
      cancelarSuscripcion = null;
    },
  };
}
