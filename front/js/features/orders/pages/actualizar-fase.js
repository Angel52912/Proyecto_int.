// 21 · Actualizar fase (Artesano, CU-05): foto de avance obligatoria, selector de fase, nota y Guardar y notificar.
// Un salto o retroceso de fase (A1) pide confirmación y una nota para el cliente.
import { NOMBRE_SERVICIO } from "../../map/componentes.js";
import { api as apiSolicitudes } from "../../requests/index.js";
import { folio } from "../../chat/pages/chat.js";
import { comprimirImagen } from "../../../lib/imagen.js";
import { TIPOS_IMAGEN, validarImagen } from "../../../../../apis/lib/validate.js";
import { alSalir } from "../../../ui/ciclo.js";
import { crear, enlace } from "../../../ui/dom.js";
import { cargarEn } from "../../../ui/estados.js";
import { icono } from "../../../ui/iconos.js";
import { agregarChatEnBarra, crearBoton, crearInsignia, crearPantalla } from "../../../ui/layout.js";
import { mensajeDeError } from "../../../ui/mensajes.js";
import { ESTADO_ORDEN, NOMBRE_FASE } from "../fases.js";
import { api } from "../index.js";
import { mostrarAvisoFlotante } from "../../../ui/aviso-flotante.js";

/**
 * ¿El cambio de fase es un salto o retroceso (A1)?
 * @param {number} actual
 * @param {number} nueva
 * @returns {boolean}
 */
export function esCorreccion(actual, nueva) {
  return nueva !== actual + 1;
}

/** @param {{ pedido: any, solicitud: any | null }} datos */
function pintar({ pedido, solicitud }) {
  const raiz = crear("div", { clase: "actualizar-fase__formulario" });
  const estado = ESTADO_ORDEN[pedido.status];

  if (pedido.status !== "in_progress") {
    raiz.append(
      crear("div", { clase: "tarjeta" }, [
        crearInsignia(estado.texto, estado.tono),
        crear("p", { texto: pedido.status === "ready" ? "El pedido está listo. Verifica el código del cliente para entregarlo." : "Este pedido ya no está en proceso." }),
      ]),
      pedido.status === "ready" ? enlace(`/artesano/pedido/${pedido.id}/entrega`, { clase: "boton boton--miel boton--bloque", texto: "Verificar entrega" }) : null,
      enlace(`/artesano/chat/${pedido.request_id}`, { clase: "boton boton--secundario boton--bloque", texto: "Abrir chat" }),
    );
    return raiz;
  }

  /** @type {File | null} */
  let foto = null;
  /** @type {string | null} */
  let vista = null;
  // En la fase 4 no hay siguiente: solo se puede corregir hacia atrás (A1) o marcar listo.
  let fase = pedido.phase < 4 ? pedido.phase + 1 : 0;
  alSalir(() => vista && URL.revokeObjectURL(vista));

  const entradaFoto = /** @type {HTMLInputElement} */ (
    crear("input", { clase: "oculto-visual", attrs: { type: "file", accept: TIPOS_IMAGEN.join(","), capture: "environment", id: "foto-avance" } })
  );
  const marco = crear("label", { clase: "camara", attrs: { for: "foto-avance" } });
  const errorFoto = crear("p", { clase: "campo__error", attrs: { "aria-live": "polite" } });
  function pintarMarco() {
    const texto = crear("span", { clase: "camara__texto" }, [icono("camara", { tam: 26 }), crear("span", { texto: vista ? "Cambiar foto" : "Tomar foto de avance" })]);
    if (vista) marco.replaceChildren(crear("img", { clase: "camara__vista", attrs: { src: vista, alt: "Foto de avance elegida" } }), texto);
    else marco.replaceChildren(texto, crear("span", { clase: "camara__obturador", attrs: { "aria-hidden": "true" } }));
  }
  pintarMarco();
  entradaFoto.addEventListener("change", () => {
    const archivo = entradaFoto.files?.[0];
    if (!archivo) return;
    const { valido, error } = validarImagen(archivo);
    errorFoto.textContent = valido ? "" : error ?? "";
    if (!valido) return;
    if (vista) URL.revokeObjectURL(vista);
    foto = archivo;
    vista = URL.createObjectURL(archivo);
    pintarMarco();
  });

  const opciones = crear(
    "fieldset",
    { clase: "fases" },
    [
      crear("legend", { clase: "seccion__titulo", texto: "Mover a la fase" }),
      ...[1, 2, 3, 4].map((n) => {
        const radio = /** @type {HTMLInputElement} */ (crear("input", { attrs: { type: "radio", name: "fase", value: n, checked: n === fase, disabled: n === pedido.phase } }));
        radio.addEventListener("change", () => {
          fase = n;
        });
        return crear("label", { clase: `fase-opcion${n < pedido.phase ? " fase-opcion--hecha" : ""}${n === pedido.phase ? " fase-opcion--actual" : ""}` }, [
          radio,
          n < pedido.phase ? icono("check", { tam: 16 }) : null,
          crear("span", { texto: NOMBRE_FASE[n] }),
          n === pedido.phase ? crear("span", { clase: "texto-secundario", texto: "(actual)" }) : null,
        ]);
      }),
    ],
  );

  const nota = /** @type {HTMLTextAreaElement} */ (crear("textarea", { attrs: { rows: 2, maxlength: 500, placeholder: "Nota para el cliente (opcional)", "aria-label": "Nota para el cliente" } }));
  const aviso = crear("div", { attrs: { "aria-live": "assertive" } });
  const guardar = crearBoton("Guardar y notificar", { tipo: "submit", icono: "subir" });

  const listo =
    pedido.phase === 4
      ? crearBoton("Marcar listo para entrega", {
          variante: "cenote",
          icono: "check",
          alHacerClic: async () => {
            if (!window.confirm("¿Avisar al cliente que su pedido está listo para recoger?")) return;
            try {
              await api.markOrderReady(pedido.id);
              raiz.replaceWith(pintar({ pedido: await api.getOrder(pedido.id), solicitud }));
              mostrarAvisoFlotante("Avisamos al cliente que su pedido está listo.");
            } catch (error) {
              aviso.replaceChildren(crear("p", { clase: "aviso aviso--error", texto: mensajeDeError(error) }));
            }
          },
        })
      : null;

  const formulario = crear(
    "form",
    {
      clase: "actualizar-fase__campos",
      on: {
        submit: async (evento) => {
          evento.preventDefault();
          aviso.replaceChildren();
          if (fase === 0) {
            aviso.replaceChildren(crear("p", { clase: "aviso aviso--miel", texto: "Elige la fase a la que quieres mover el pedido." }));
            return;
          }
          if (foto === null) {
            errorFoto.textContent = "La foto de avance es obligatoria.";
            marco.focus();
            return;
          }
          const texto = nota.value.trim();
          const correccion = esCorreccion(pedido.phase, fase);
          if (correccion) {
            if (texto === "") {
              aviso.replaceChildren(crear("p", { clase: "aviso aviso--miel", texto: "Saltar o regresar de fase necesita una nota que explique el cambio al cliente." }));
              nota.focus();
              return;
            }
            if (!window.confirm(`El pedido pasará de "${NOMBRE_FASE[pedido.phase]}" a "${NOMBRE_FASE[fase]}". ¿Confirmas la corrección?`)) return;
          }
          guardar.disabled = true;
          try {
            await api.advanceOrderPhase(pedido.id, { phase: fase, photo: await comprimirImagen(foto), ...(texto ? { note: texto } : {}), ...(correccion ? { confirm: true } : {}) });
            raiz.replaceWith(pintar({ pedido: await api.getOrder(pedido.id), solicitud }));
            mostrarAvisoFlotante("Fase actualizada. Avisamos al cliente.");
          } catch (error) {
            aviso.replaceChildren(crear("p", { clase: "aviso aviso--error", attrs: { role: "alert" }, texto: mensajeDeError(error, { photo_required: "La foto de avance es obligatoria." }) }));
            guardar.disabled = false;
          }
        },
      },
    },
    [entradaFoto, marco, errorFoto, opciones, nota, aviso, crear("div", { clase: "acciones acciones--columna" }, [listo, guardar])],
  );

  raiz.append(
    crear("p", { clase: "texto-secundario", texto: `${NOMBRE_SERVICIO[/** @type {"repair" | "cleaning"} */ (solicitud?.service_type)] ?? "Pedido"} de ${solicitud?.counterpart?.full_name ?? "cliente"} · Fase ${pedido.phase} de 4` }),
    formulario,
  );
  return raiz;
}

/** @param {import("../../../router.js").Contexto} contexto */
export async function renderActualizarFase({ params }) {
  const contenido = crear("div", { clase: "actualizar-fase__contenido" });
  const pantalla = crearPantalla({ titulo: `Pedido ${folio(params.orderId)}`, volver: "/artesano/tablero", clase: "actualizar-fase" }, [contenido]);
  cargarEn(
    contenido,
    async () => {
      const pedido = await api.getOrder(params.orderId);
      agregarChatEnBarra(pantalla, `/artesano/chat/${pedido.request_id}`, "Escribir al cliente");
      return { pedido, solicitud: await apiSolicitudes.getRequest(pedido.request_id).catch(() => null) };
    },
    pintar,
    { not_found: "No encontramos este pedido.", invalid_input: "No encontramos este pedido." },
  );
  return pantalla;
}
