// 12 · Presupuesto recibido (CU-04): desglose, total, entrega, tiempo y Aceptar o Rechazar ("pagas al recoger").
import { api as apiMapa } from "../../map/index.js";
import { api as apiSolicitudes } from "../../requests/index.js";
import { diasHasta, formatearFecha } from "../../../lib/fechas.js";
import { formatearMxn } from "../../../lib/money.js";
import { crear, enlace, ir } from "../../../ui/dom.js";
import { cargarEn } from "../../../ui/estados.js";
import { crearFoto } from "../../../ui/foto.js";
import { icono } from "../../../ui/iconos.js";
import { crearBoton, crearEstrellas, crearInsignia, crearPantalla } from "../../../ui/layout.js";
import { mensajeDeError } from "../../../ui/mensajes.js";
import { api } from "../index.js";
import { ESTADO_PRESUPUESTO } from "../tarjeta.js";

/**
 * Conceptos del desglose. `detail` es libre (contrato): se aceptan `conceptos` o `items` como `[{ concepto, monto }]`.
 * @param {Record<string, unknown>} detalle
 * @returns {{ concepto: string, monto: number | null }[]}
 */
export function conceptosDelDetalle(detalle) {
  const lista = Array.isArray(detalle.conceptos) ? detalle.conceptos : Array.isArray(detalle.items) ? detalle.items : [];
  return lista
    .filter((c) => c && typeof c === "object")
    .map((c) => ({
      concepto: String(c.concepto ?? c.nombre ?? c.label ?? "Concepto"),
      monto: typeof c.monto === "number" ? c.monto : typeof c.amount === "number" ? c.amount : null,
    }));
}

/**
 * Texto descriptivo del trabajo dentro de `detail`.
 * @param {Record<string, unknown>} detalle
 * @returns {string}
 */
export function descripcionDelDetalle(detalle) {
  const texto = detalle.descripcion ?? detalle.description ?? detalle.detalle ?? detalle.nota;
  return typeof texto === "string" ? texto : "";
}

/**
 * @param {string} icon
 * @param {string} etiqueta
 * @param {string} valor
 */
const datoChico = (icon, etiqueta, valor) =>
  crear("div", { clase: "tarjeta dato-chico" }, [icono(icon, { tam: 18 }), crear("div", {}, [crear("p", { clase: "tarjeta__detalle", texto: etiqueta }), crear("p", { clase: "dato-chico__valor", texto: valor })])]);

/** @param {{ presupuesto: any, solicitud: any, taller: any | null }} datos */
function pintarPresupuesto({ presupuesto, solicitud, taller }) {
  const detalle = /** @type {Record<string, unknown>} */ (presupuesto.detail ?? {});
  const conceptos = conceptosDelDetalle(detalle);
  const descripcion = descripcionDelDetalle(detalle);
  const titulo = typeof detalle.titulo === "string" ? detalle.titulo : solicitud.service_type === "cleaning" ? "Limpieza" : "Reparación";
  const dias = diasHasta(presupuesto.delivery_date);
  const vigente = presupuesto.status === "sent";
  const estado = ESTADO_PRESUPUESTO[presupuesto.status];
  const aviso = crear("div", { attrs: { "aria-live": "assertive" } });

  /**
   * @param {boolean} aceptar
   * @param {HTMLButtonElement[]} botones
   */
  async function responder(aceptar, botones) {
    const pregunta = aceptar
      ? `¿Aceptar el presupuesto de ${formatearMxn(presupuesto.amount_mxn)}? Pagas al recoger tu calzado.`
      : "¿Rechazar este presupuesto? El taller podrá enviarte otro.";
    if (!window.confirm(pregunta)) return;
    botones.forEach((b) => (b.disabled = true));
    try {
      const resultado = await api.respondQuote(presupuesto.id, aceptar);
      ir(resultado.order_id ? `/pedido/${resultado.order_id}` : `/chat/${presupuesto.request_id}`);
    } catch (error) {
      aviso.replaceChildren(
        crear("p", { clase: "aviso aviso--error", attrs: { role: "alert" }, texto: mensajeDeError(error, { invalid_state: "Este presupuesto ya no está vigente o el taller no está disponible." }) }),
      );
      botones.forEach((b) => (b.disabled = false));
    }
  }

  const rechazar = crearBoton("Rechazar", { variante: "secundario" });
  const aceptar = crearBoton("Aceptar");
  rechazar.addEventListener("click", () => responder(false, [rechazar, aceptar]));
  aceptar.addEventListener("click", () => responder(true, [rechazar, aceptar]));

  return [
    crear("article", { clase: "tarjeta presupuesto__tarjeta" }, [
      crear("div", { clase: "tarjeta--enlace" }, [
        crearFoto(taller?.photos?.find((/** @type {any} */ f) => f.kind === "profile")?.url, "Foto del taller"),
        crear("div", { clase: "tarjeta__cuerpo" }, [
          crear("p", { clase: "tarjeta__titulo", texto: taller?.name ?? solicitud.counterpart?.full_name ?? "Taller" }),
          taller ? crear("p", { clase: "tarjeta__detalle linea-calificacion" }, [crearEstrellas(taller.rating_avg), crear("span", { texto: taller.rating_avg?.toFixed(1) ?? "Nuevo" })]) : null,
        ]),
        vigente ? null : crearInsignia(estado.texto, estado.tono),
      ]),
      crear("hr"),
      crear("h2", { clase: "presupuesto__titulo", texto: titulo }),
      descripcion ? crear("p", { clase: "tarjeta__detalle presupuesto__descripcion", texto: descripcion }) : null,
      conceptos.length > 0
        ? crear(
            "dl",
            { clase: "presupuesto__conceptos" },
            conceptos.flatMap((c) => [crear("dt", { texto: c.concepto }), crear("dd", { texto: c.monto === null ? "—" : formatearMxn(c.monto) })]),
          )
        : null,
      crear("div", { clase: "presupuesto__total" }, [crear("span", { texto: "Total" }), crear("strong", { texto: `${formatearMxn(presupuesto.amount_mxn)} MXN` })]),
    ]),
    crear("div", { clase: "presupuesto__datos" }, [
      datoChico("calendario", "Entrega", formatearFecha(presupuesto.delivery_date)),
      datoChico("reloj", "Tiempo", dias <= 0 ? "Hoy" : dias === 1 ? "1 día" : `${dias} días`),
    ]),
    crear("div", { clase: "aviso" }, [icono("escudo", { tam: 18 }), crear("p", { texto: "Pagas al recoger tu calzado, después de verificar la entrega. No hay pagos en la app." })]),
    aviso,
    vigente
      ? crear("div", { clase: "acciones" }, [rechazar, aceptar])
      : crear("div", { clase: "acciones" }, [enlace(`/chat/${presupuesto.request_id}`, { clase: "boton boton--secundario boton--bloque", texto: "Volver al chat" })]),
  ];
}

/** @param {import("../../../router.js").Contexto} contexto */
export async function renderPresupuesto({ params }) {
  const contenido = crear("div", { clase: "presupuesto__contenido" });
  const pantalla = crearPantalla({ titulo: "Presupuesto", volver: "/pedidos", clase: "presupuesto" }, [contenido]);
  cargarEn(
    contenido,
    async () => {
      const presupuesto = await api.getQuote(params.quoteId);
      const solicitud = await apiSolicitudes.getRequest(presupuesto.request_id);
      const taller = await apiMapa.getWorkshopProfile(solicitud.workshop_id).catch(() => null);
      pantalla.querySelector(".barra__volver")?.setAttribute("href", `#/chat/${presupuesto.request_id}`);
      return { presupuesto, solicitud, taller };
    },
    pintarPresupuesto,
    { not_found: "No encontramos este presupuesto.", invalid_input: "No encontramos este presupuesto." },
  );
  return pantalla;
}
