// 15 · Califica tu experiencia (CU-06): estrellas, etiquetas, reseña opcional y Enviar calificación (sin edición posterior).
import { api as apiMapa } from "../../map/index.js";
import { validarCalificacion } from "../../../../../apis/lib/validate.js";
import { crear, enlace } from "../../../ui/dom.js";
import { cargarEn } from "../../../ui/estados.js";
import { icono } from "../../../ui/iconos.js";
import { crearBoton, crearEstrellas, crearPantalla } from "../../../ui/layout.js";
import { mensajeDeError } from "../../../ui/mensajes.js";
import { api } from "../index.js";
import { MAX_COMENTARIO, MAX_ETIQUETAS } from "../../../../../apis/api-mixanab/orders/validar.js";

export const ETIQUETAS = Object.freeze(["Puntual", "Buen acabado", "Buen trato", "Buen precio", "Como nuevo"]);
export const TEXTO_CALIFICACION = Object.freeze({ 1: "Malo", 2: "Regular", 3: "Bien", 4: "Muy bien", 5: "Excelente" });

/** @param {{ nombre: string }} datos */
function crearGracias({ nombre }) {
  return crear("div", { clase: "calificar__gracias" }, [
    crear("span", { clase: "calificar__check" }, [icono("check", { tam: 32 })]),
    crear("h2", { texto: "¡Gracias por calificar!" }),
    crear("p", { clase: "texto-secundario", texto: `Tu opinión ayuda a ${nombre} y a otros clientes.` }),
    enlace("/pedidos", { clase: "boton boton--bloque", texto: "Ir a mis pedidos" }),
  ]);
}

/** @param {{ pedido: any, resena: any | null, taller: any | null }} datos */
function pintarCalificar({ pedido, resena, taller }) {
  const nombre = taller?.name ?? "el taller";
  if (resena) {
    return crear("div", { clase: "calificar__gracias" }, [
      crear("h2", { texto: "Ya calificaste este pedido" }),
      crearEstrellas(resena.rating),
      resena.comment ? crear("p", { clase: "tarjeta__detalle", texto: resena.comment }) : null,
      enlace("/pedidos", { clase: "boton boton--secundario boton--bloque", texto: "Volver a mis pedidos" }),
    ]);
  }
  if (pedido.status !== "delivered") {
    return crear("div", { clase: "estado-vacio" }, [
      crear("p", { texto: "Podrás calificar cuando el taller confirme la entrega." }),
      enlace(`/pedido/${pedido.id}`, { clase: "boton boton--secundario", texto: "Ver seguimiento" }),
    ]);
  }

  let calificacion = 0;
  /** @type {Set<string>} */
  const elegidas = new Set();
  const textoEstrellas = crear("p", { clase: "calificar__texto", attrs: { "aria-live": "polite" } });

  /** @type {HTMLInputElement[]} */
  const radios = [];
  const estrellas = crear(
    "fieldset",
    { clase: "calificar__estrellas" },
    [
      crear("legend", { clase: "oculto-visual", texto: "Calificación de 1 a 5 estrellas" }),
      ...[1, 2, 3, 4, 5].map((n) => {
        const radio = /** @type {HTMLInputElement} */ (crear("input", { clase: "oculto-visual", attrs: { type: "radio", name: "rating", value: n, id: `estrella-${n}` } }));
        radio.addEventListener("change", () => {
          calificacion = n;
          pintarEstrellas();
        });
        radios.push(radio);
        return crear("span", {}, [
          radio,
          crear("label", { attrs: { for: `estrella-${n}`, title: TEXTO_CALIFICACION[/** @type {1|2|3|4|5} */ (n)] } }, [
            icono("estrella", { tam: 36, relleno: true }),
            crear("span", { clase: "oculto-visual", texto: `${n} ${n === 1 ? "estrella" : "estrellas"}` }),
          ]),
        ]);
      }),
    ],
  );
  function pintarEstrellas() {
    estrellas.querySelectorAll("label").forEach((etiqueta, i) => etiqueta.classList.toggle("activa", i < calificacion));
    textoEstrellas.textContent = calificacion ? TEXTO_CALIFICACION[/** @type {1|2|3|4|5} */ (calificacion)] : "Toca las estrellas";
  }
  pintarEstrellas();

  const etiquetas = crear(
    "div",
    { clase: "chips chips--envolver", attrs: { role: "group", "aria-label": `Etiquetas (máximo ${MAX_ETIQUETAS})` } },
    ETIQUETAS.map((texto) =>
      crear("button", {
        clase: "chip",
        texto,
        attrs: { type: "button", "aria-pressed": "false" },
        on: {
          click: (evento) => {
            const chip = /** @type {HTMLButtonElement} */ (evento.currentTarget);
            if (elegidas.has(texto)) elegidas.delete(texto);
            else if (elegidas.size < MAX_ETIQUETAS) elegidas.add(texto);
            chip.setAttribute("aria-pressed", String(elegidas.has(texto)));
          },
        },
      }),
    ),
  );

  const comentario = /** @type {HTMLTextAreaElement} */ (
    crear("textarea", { attrs: { rows: 4, maxlength: MAX_COMENTARIO, placeholder: "Escribe una reseña (opcional)", "aria-label": "Reseña (opcional)" } })
  );
  const aviso = crear("div", { attrs: { "aria-live": "assertive" } });
  const enviar = crearBoton("Enviar calificación", { tipo: "submit" });

  const formulario = crear(
    "form",
    {
      clase: "calificar__formulario",
      on: {
        submit: async (evento) => {
          evento.preventDefault();
          aviso.replaceChildren();
          if (!validarCalificacion(calificacion)) {
            aviso.replaceChildren(crear("p", { clase: "aviso aviso--error", texto: "Elige de 1 a 5 estrellas." }));
            radios[0].focus();
            return;
          }
          enviar.disabled = true;
          try {
            await api.createReview(pedido.id, { rating: calificacion, tags: [...elegidas], comment: comentario.value.trim() });
            formulario.replaceWith(crearGracias({ nombre }));
          } catch (error) {
            aviso.replaceChildren(crear("p", { clase: "aviso aviso--error", attrs: { role: "alert" }, texto: mensajeDeError(error, { invalid_state: "Este pedido ya fue calificado." }) }));
            enviar.disabled = false;
          }
        },
      },
    },
    [
      crear("span", { clase: "calificar__check" }, [icono("check", { tam: 32 })]),
      crear("h2", { clase: "calificar__titulo", texto: "Entrega confirmada" }),
      crear("p", { clase: "texto-secundario", texto: `¿Cómo te fue con ${nombre}?` }),
      estrellas,
      textoEstrellas,
      etiquetas,
      comentario,
      aviso,
      crear("div", { clase: "acciones" }, [enviar]),
    ],
  );
  return formulario;
}

/** @param {import("../../../router.js").Contexto} contexto */
export async function renderCalificar({ params }) {
  const contenido = crear("div", { clase: "calificar__contenido" });
  const cerrar = enlace("/pedidos", { clase: "barra__volver", attrs: { "aria-label": "Cerrar" } }, [icono("cerrar")]);
  const pantalla = crearPantalla({ titulo: "Califica tu experiencia", accion: cerrar, clase: "calificar" }, [contenido]);
  cargarEn(
    contenido,
    async () => {
      const pedido = await api.getOrder(params.orderId);
      const [resena, taller] = await Promise.all([api.getOrderReview(pedido.id), apiMapa.getWorkshopProfile(pedido.workshop_id).catch(() => null)]);
      return { pedido, resena, taller };
    },
    pintarCalificar,
    { not_found: "No encontramos este pedido.", invalid_input: "No encontramos este pedido." },
  );
  return pantalla;
}
