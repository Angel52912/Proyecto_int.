// 19 · Enviar presupuesto (Artesano, CU-04): fotos y descripción de la solicitud, costo, entrega y detalle.
// Si ya hay un presupuesto vigente, el mismo formulario lo rectifica (A2).
import { crearAvatar } from "../../auth/avatar.js";
import { NOMBRE_SERVICIO } from "../../map/componentes.js";
import { api as apiSolicitudes } from "../../requests/index.js";
import { folio } from "../../chat/pages/chat.js";
import { ESTADO_SOLICITUD } from "../../orders/fases.js";
import { formatearMxn } from "../../../lib/money.js";
import { crear, enlace, ir } from "../../../ui/dom.js";
import { cargarEn } from "../../../ui/estados.js";
import { crearFoto } from "../../../ui/foto.js";
import { icono } from "../../../ui/iconos.js";
import { crearBoton, crearInsignia, crearPantalla } from "../../../ui/layout.js";
import { mensajeDeError } from "../../../ui/mensajes.js";
import { api } from "../index.js";
import { MAX_MONTO_MXN, fechaDeHoy } from "../../../../../apis/api-mixanab/quotes/validar.js";
import { descripcionDelDetalle } from "./presupuesto.js";
import { mostrarAvisoFlotante } from "../../../ui/aviso-flotante.js";

/**
 * Valida el formulario antes de llamar a la api (la api vuelve a validar).
 * @param {{ monto: string, fecha: string, detalle: string }} valores
 * @param {Date} [ahora]
 * @returns {{ errores: Record<string, string>, datos: { amount_mxn: number, delivery_date: string, detail: Record<string, string> } | null }}
 */
export function validarFormularioPresupuesto(valores, ahora = new Date()) {
  /** @type {Record<string, string>} */
  const errores = {};
  const monto = Number(valores.monto);
  if (!Number.isFinite(monto) || monto <= 0 || monto > MAX_MONTO_MXN || Math.abs(Math.round(monto * 100) - monto * 100) > 1e-6) {
    errores.monto = "Escribe un costo mayor a $0 (máximo 2 decimales).";
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valores.fecha) || valores.fecha < fechaDeHoy(ahora)) errores.fecha = "Elige una fecha de hoy en adelante.";
  if (valores.detalle.length > 1500) errores.detalle = "El detalle es demasiado largo.";
  if (Object.keys(errores).length > 0) return { errores, datos: null };
  const detalle = valores.detalle.trim();
  return { errores, datos: { amount_mxn: monto, delivery_date: valores.fecha, detail: detalle ? { descripcion: detalle } : {} } };
}

/**
 * @param {string} id
 * @param {string} etiqueta
 * @param {HTMLElement} control
 * @param {string} [iconoNombre]
 */
function crearCampo(id, etiqueta, control, iconoNombre) {
  control.id = id;
  const error = crear("span", { clase: "campo__error", attrs: { id: `${id}-error`, "aria-live": "polite" } });
  control.setAttribute("aria-describedby", `${id}-error`);
  return crear("div", { clase: `campo${iconoNombre ? " campo--icono" : ""}` }, [crear("label", { texto: etiqueta, attrs: { for: id } }), iconoNombre ? icono(iconoNombre, { tam: 18 }) : null, control, error]);
}

/** @param {{ solicitud: any, vigente: any | null }} datos */
function pintar({ solicitud, vigente }) {
  const estado = ESTADO_SOLICITUD[solicitud.status] ?? ESTADO_SOLICITUD.open;
  const editable = solicitud.status === "open" || solicitud.status === "quoted";
  const cliente = solicitud.counterpart?.full_name ?? "Cliente";

  const cabecera = [
    crear(
      "div",
      { clase: "galeria" },
      solicitud.photos.length === 0 ? [crearFoto(null, "Sin fotos")] : solicitud.photos.map((/** @type {any} */ f, /** @type {number} */ i) => crearFoto(f.url, `Foto ${i + 1} del calzado`)),
    ),
    crear("div", { clase: "tarjeta" }, [
      crear("div", { clase: "fila-entre" }, [
        crear("div", { clase: "chat-contraparte" }, [crearAvatar({ nombre: cliente, avatarPath: solicitud.counterpart?.avatar_path, clase: "avatar--chico" }), crear("strong", { texto: cliente })]),
        crearInsignia(NOMBRE_SERVICIO[/** @type {"repair" | "cleaning"} */ (solicitud.service_type)], "cuero"),
      ]),
      crear("p", { clase: "tarjeta__detalle enviar-presupuesto__descripcion", texto: solicitud.description }),
    ]),
  ];

  if (!editable) {
    return [
      ...cabecera,
      crear("div", { clase: "aviso aviso--miel" }, [crear("p", { texto: `Esta solicitud está ${estado.texto.toLowerCase()}. Ya no admite presupuestos.` })]),
      enlace(`/artesano/chat/${solicitud.id}`, { clase: "boton boton--secundario boton--bloque", texto: "Abrir chat" }),
    ];
  }

  const monto = /** @type {HTMLInputElement} */ (crear("input", { attrs: { type: "number", min: "1", step: "0.01", inputmode: "decimal", placeholder: "450", required: true } }));
  const fecha = /** @type {HTMLInputElement} */ (crear("input", { attrs: { type: "date", min: fechaDeHoy(), required: true } }));
  const detalle = /** @type {HTMLTextAreaElement} */ (crear("textarea", { attrs: { rows: 4, maxlength: 1500, placeholder: "Ej. Cambio de suela de cuero, costura reforzada y limpieza con nutrición." } }));
  if (vigente) {
    monto.value = String(vigente.amount_mxn);
    fecha.value = vigente.delivery_date;
    detalle.value = descripcionDelDetalle(vigente.detail ?? {});
  }
  const aviso = crear("div", { attrs: { "aria-live": "assertive" } });
  const enviar = crearBoton(vigente ? "Rectificar presupuesto" : "Enviar presupuesto", { tipo: "submit", icono: "enviar" });

  const campos = { monto: crearCampo("monto", "Costo (MXN)", monto, "dinero"), fecha: crearCampo("fecha", "Entrega", fecha, "calendario"), detalle: crearCampo("detalle", "Detalle del trabajo", detalle) };

  const formulario = crear(
    "form",
    {
      clase: "enviar-presupuesto__formulario",
      attrs: { novalidate: true },
      on: {
        submit: async (evento) => {
          evento.preventDefault();
          aviso.replaceChildren();
          const { errores, datos } = validarFormularioPresupuesto({ monto: monto.value, fecha: fecha.value, detalle: detalle.value });
          for (const [nombre, contenedor] of Object.entries(campos)) {
            contenedor.classList.toggle("campo--error", nombre in errores);
            const salida = contenedor.querySelector(".campo__error");
            if (salida) salida.textContent = errores[nombre] ?? "";
          }
          if (datos === null) return;
          if (vigente && !window.confirm(`Se reemplazará el presupuesto de ${formatearMxn(vigente.amount_mxn)}. ¿Continuar?`)) return;
          enviar.disabled = true;
          try {
            await api.sendQuote(solicitud.id, datos);
            mostrarAvisoFlotante("Presupuesto enviado al cliente.");
            ir(`/artesano/chat/${solicitud.id}`);
          } catch (error) {
            aviso.replaceChildren(
              crear("p", {
                clase: "aviso aviso--error",
                attrs: { role: "alert" },
                texto: mensajeDeError(error, { invalid_state: "Esta solicitud ya no admite presupuestos.", forbidden: "Tu taller está suspendido. No puedes enviar presupuestos." }),
              }),
            );
            enviar.disabled = false;
          }
        },
      },
    },
    [
      crear("h2", { clase: "seccion__titulo", texto: vigente ? "Rectificar presupuesto" : "Tu presupuesto" }),
      vigente ? crear("p", { clase: "texto-secundario", texto: `Vigente: ${formatearMxn(vigente.amount_mxn)}. Al enviar uno nuevo, el anterior queda reemplazado.` }) : null,
      crear("div", { clase: "filtros__fila" }, [campos.monto, campos.fecha]),
      campos.detalle,
      aviso,
      crear("div", { clase: "acciones" }, [
        enlace(`/artesano/chat/${solicitud.id}`, { clase: "boton boton--secundario boton--icono", attrs: { "aria-label": "Abrir el chat con el cliente" } }, [icono("chat")]),
        enviar,
      ]),
    ],
  );
  return [...cabecera, formulario];
}

/** @param {import("../../../router.js").Contexto} contexto */
export async function renderEnviarPresupuesto({ params }) {
  const contenido = crear("div", { clase: "enviar-presupuesto__contenido" });
  const pantalla = crearPantalla({ titulo: `Solicitud ${folio(params.requestId)}`, volver: "/artesano/solicitudes", clase: "enviar-presupuesto" }, [contenido]);
  cargarEn(
    contenido,
    async () => {
      const [solicitud, presupuestos] = await Promise.all([apiSolicitudes.getRequest(params.requestId), api.listQuotes(params.requestId)]);
      return { solicitud, vigente: presupuestos.find((p) => p.status === "sent") ?? null };
    },
    pintar,
    { not_found: "No encontramos esta solicitud.", invalid_input: "No encontramos esta solicitud." },
  );
  return pantalla;
}
