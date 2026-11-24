// 14 · Recoger pedido (CU-06): código QR y PIN de entrega, datos del taller y Cómo llegar.
import { api as apiMapa } from "../../map/index.js";
import { api as apiSolicitudes } from "../../requests/index.js";
import { alSalir } from "../../../ui/ciclo.js";
import { crear, enlace, ir } from "../../../ui/dom.js";
import { cargarEn, crearError } from "../../../ui/estados.js";
import { icono } from "../../../ui/iconos.js";
import { crearBoton, crearInsignia, crearPantalla } from "../../../ui/layout.js";
import { mensajeDeError } from "../../../ui/mensajes.js";
import { crearQr } from "../../../ui/qr.js";
import { api } from "../index.js";

const CLAVES_DIA = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

/**
 * "Abierto hasta 19:00", "Cerrado ahora" o "Cerrado hoy" con el horario del taller (hora local).
 * @param {Record<string, { open: string, close: string }[]> | null} horario
 * @param {Date} [ahora]
 * @returns {string}
 */
export function textoHorarioHoy(horario, ahora = new Date()) {
  const rangos = horario?.[CLAVES_DIA[ahora.getDay()]] ?? [];
  if (rangos.length === 0) return "Cerrado hoy";
  const hora = `${String(ahora.getHours()).padStart(2, "0")}:${String(ahora.getMinutes()).padStart(2, "0")}`;
  const actual = rangos.find((r) => r.open <= hora && hora < r.close);
  if (actual) return `Abierto hasta ${actual.close}`;
  const siguiente = rangos.find((r) => hora < r.open);
  return siguiente ? `Abre a las ${siguiente.open}` : "Cerrado ahora";
}

/**
 * Etiqueta de estado del taller. `is_open` (del servidor, hora de Mérida) decide si está abierto;
 * el horario solo agrega detalle ("Abierto hasta 19:00", "Abre a las 16:00").
 * @param {{ is_open: boolean, hours: Record<string, { open: string, close: string }[]> | null }} taller
 * @param {Date} [ahora]
 * @returns {{ texto: string, tono: "exito" | "miel" | "neutra" }}
 */
export function estadoDeHoy(taller, ahora = new Date()) {
  const hoy = textoHorarioHoy(taller.hours, ahora);
  const diceAbierto = hoy.startsWith("Abierto");
  if (taller.is_open) return { texto: diceAbierto ? hoy : "Abierto ahora", tono: "exito" };
  if (diceAbierto) return { texto: "Cerrado ahora", tono: "neutra" };
  return { texto: hoy, tono: hoy.startsWith("Abre") ? "miel" : "neutra" };
}

/**
 * Enlace de indicaciones en Google Maps (abre la app de mapas del teléfono).
 * @param {number} lat
 * @param {number} lng
 * @returns {string}
 */
export function urlComoLlegar(lat, lng) {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}

/** @param {{ pedido: any, taller: any | null }} datos */
function pintarRecoger({ pedido, taller }) {
  if (pedido.status === "delivered") {
    return crear("div", { clase: "estado-vacio" }, [
      icono("check", { tam: 32 }),
      crear("p", { texto: "Este pedido ya fue entregado." }),
      enlace(`/pedido/${pedido.id}/calificar`, { clase: "boton", texto: "Calificar al taller" }),
    ]);
  }
  if (pedido.status !== "ready") {
    return crear("div", { clase: "estado-vacio" }, [
      icono("reloj", { tam: 32 }),
      crear("p", { texto: "Tu pedido aún no está listo. Te avisaremos cuando puedas recogerlo." }),
      enlace(`/pedido/${pedido.id}`, { clase: "boton boton--secundario", texto: "Ver seguimiento" }),
    ]);
  }

  const codigo = crear("div", { clase: "recoger__codigo", attrs: { "aria-live": "polite" } });

  async function mostrarCodigo() {
    codigo.replaceChildren(crear("p", { clase: "estado-cargando", texto: "Generando código…" }));
    try {
      // Cada llamada genera un PIN nuevo: el anterior deja de servir.
      const { pin } = await api.revealDeliveryPin(pedido.id);
      const qr = crearQr(`${pedido.id}:${pin}`, `Código QR de entrega. PIN ${pin.split("").join(" ")}`);
      codigo.replaceChildren(
        crear("div", { clase: "recoger__qr" }, [qr ?? crear("p", { clase: "texto-secundario", texto: "No se pudo dibujar el QR. Dicta el PIN." })]),
        crear("p", { clase: "texto-secundario recoger__o", texto: "o dicta el PIN de entrega" }),
        crear(
          "p",
          { clase: "recoger__pin", attrs: { "aria-label": `PIN ${pin.split("").join(" ")}` } },
          pin.split("").map((d) => crear("span", { texto: d, attrs: { "aria-hidden": "true" } })),
        ),
        crearBoton("Generar otro código", { variante: "secundario", bloque: false, alHacerClic: () => mostrarCodigo() }),
      );
    } catch (error) {
      codigo.replaceChildren(crearError(mensajeDeError(error, { invalid_state: "Tu pedido ya no está listo para entrega." }), mostrarCodigo));
    }
  }
  mostrarCodigo();

  return [
    crear("div", { clase: "recoger__encabezado" }, [crearInsignia("¡Tu calzado está listo!", "exito"), crear("h2", { clase: "recoger__titulo", texto: "Muestra este código en el taller" })]),
    codigo,
    taller
      ? crear("div", { clase: "tarjeta tarjeta--enlace" }, [
          icono("mapa", { clase: "recoger__pin-icono" }),
          crear("div", { clase: "tarjeta__cuerpo recoger__taller" }, [
            crear("p", { clase: "tarjeta__titulo", texto: taller.name }),
            crear("p", { clase: "tarjeta__detalle", texto: `${taller.address}, ${taller.colonia}` }),
            crearInsignia(estadoDeHoy(taller).texto, estadoDeHoy(taller).tono),
          ]),
        ])
      : null,
    crear("div", { clase: "acciones" }, [
      taller
        ? crear("a", { clase: "boton boton--cenote boton--bloque", attrs: { href: urlComoLlegar(taller.lat, taller.lng), target: "_blank", rel: "noopener noreferrer" } }, [
            icono("navegar", { tam: 18 }),
            crear("span", { texto: "Cómo llegar" }),
          ])
        : null,
    ]),
  ];
}

/** @param {import("../../../router.js").Contexto} contexto */
export async function renderRecoger({ params }) {
  const contenido = crear("div", { clase: "recoger__contenido" });
  const pantalla = crearPantalla({ titulo: "Recoger pedido", volver: `/pedido/${params.orderId}`, clase: "recoger" }, [contenido]);
  cargarEn(
    contenido,
    async () => {
      const pedido = await api.getOrder(params.orderId);
      const taller = await apiMapa.getWorkshopProfile(pedido.workshop_id).catch(() => null);
      return { pedido, taller };
    },
    pintarRecoger,
    { not_found: "No encontramos este pedido.", invalid_input: "No encontramos este pedido." },
  );

  // Cuando el artesano confirma la entrega, pasa directo a calificar.
  let salio = false;
  /** @type {(() => void) | null} */
  let cancelar = null;
  alSalir(() => {
    salio = true;
    cancelar?.();
  });
  apiSolicitudes
    .subscribeToNotifications((aviso) => {
      if (aviso.type === "order_delivered" && aviso.payload?.order_id === params.orderId) ir(`/pedido/${params.orderId}/calificar`);
    })
    .then((c) => {
      if (salio) c();
      else cancelar = c;
    })
    .catch(() => {});
  return pantalla;
}
