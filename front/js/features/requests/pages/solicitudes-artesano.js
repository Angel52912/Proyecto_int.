// 18 · Solicitudes (Artesano, CU-03): resumen (Nuevas, En taller, Calificación) y lista de solicitudes recibidas.
import { api as apiPedidos } from "../../orders/index.js";
import { ESTADO_SOLICITUD } from "../../orders/fases.js";
import { NOMBRE_SERVICIO } from "../../map/componentes.js";
import { api as apiTaller } from "../../workshop/index.js";
import { formatearHace } from "../../../lib/fechas.js";
import { alSalir } from "../../../ui/ciclo.js";
import { crear, enlace } from "../../../ui/dom.js";
import { cargarEn, crearVacio } from "../../../ui/estados.js";
import { crearFoto } from "../../../ui/foto.js";
import { icono } from "../../../ui/iconos.js";
import { crearInsignia, crearPantalla } from "../../../ui/layout.js";
import { crearCampana } from "../avisos.js";
import { api } from "../index.js";

/**
 * @param {string} etiqueta
 * @param {string} valor
 * @param {"cuero" | "cenote" | "miel"} tono
 */
const crearResumen = (etiqueta, valor, tono) =>
  crear("div", { clase: `resumen resumen--${tono}` }, [crear("p", { clase: "resumen__etiqueta", texto: etiqueta }), crear("p", { clase: "resumen__valor", texto: valor })]);

/** @param {any} detalle SolicitudDetalle */
function crearTarjetaSolicitud(detalle) {
  const estado = ESTADO_SOLICITUD[detalle.status] ?? ESTADO_SOLICITUD.open;
  const ruta = detalle.status === "open" || detalle.status === "quoted" ? `/artesano/solicitud/${detalle.id}` : `/artesano/chat/${detalle.id}`;
  return crear("li", {}, [
    enlace(ruta, { clase: "tarjeta tarjeta--enlace" }, [
      crearFoto(detalle.photos?.[0]?.url, "Foto del calzado"),
      crear("div", { clase: "tarjeta__cuerpo" }, [
        crear("div", { clase: "fila-entre" }, [
          crear("p", { clase: "tarjeta__titulo", texto: `${NOMBRE_SERVICIO[/** @type {"repair" | "cleaning"} */ (detalle.service_type)]} · ${detalle.counterpart?.full_name ?? "Cliente"}` }),
          crearInsignia(estado.texto, estado.tono),
        ]),
        crear("p", { clase: "tarjeta__detalle solicitud-artesano__descripcion", texto: detalle.description }),
        crear("p", { clase: "tarjeta__detalle", texto: formatearHace(detalle.submitted_at ?? detalle.created_at) }),
      ]),
    ]),
  ]);
}

/** @returns {Promise<Node>} */
export async function renderSolicitudesArtesano() {
  const resumen = crear("div", { clase: "resumenes" }, [crearResumen("Nuevas", "–", "cuero"), crearResumen("En taller", "–", "cenote"), crearResumen("Calificación", "–", "miel")]);
  const lista = crear("div", { clase: "seccion" });
  const campana = crearCampana("craftsman");

  const pantalla = crearPantalla({ rol: "craftsman", activa: "solicitudes", clase: "solicitudes-artesano" }, [
    crear("div", { clase: "fila-entre" }, [crear("h1", { clase: "pantalla__titulo", texto: "Solicitudes" }), campana]),
    resumen,
    lista,
  ]);

  const cargar = () =>
    cargarEn(
      lista,
      async () => {
        const [solicitudes, pedidos, taller] = await Promise.all([api.listMyRequests(), apiPedidos.listMyOrders(), apiTaller.getMyWorkshop().catch(() => null)]);
        const detalles = await Promise.all(solicitudes.map((s) => api.getRequest(s.id).catch(() => ({ ...s, photos: [], counterpart: null }))));
        return { detalles, pedidos, taller };
      },
      ({ detalles, pedidos, taller }) => {
        resumen.replaceChildren(
          crearResumen("Nuevas", String(detalles.filter((d) => d.status === "open").length), "cuero"),
          crearResumen("En taller", String(pedidos.filter((p) => p.status === "in_progress").length), "cenote"),
          crearResumen("Calificación", taller?.rating_avg === null || taller?.rating_avg === undefined ? "Nuevo" : taller.rating_avg.toFixed(1), "miel"),
        );
        const sinPublicar =
          taller === null || !taller.published
            ? enlace("/artesano/taller", { clase: "aviso aviso--miel" }, [icono("reparacion", { tam: 18 }), crear("p", { texto: "Configura y publica tu taller para aparecer en el mapa y recibir solicitudes." })])
            : null;
        // Primero las que esperan respuesta; las cerradas al final.
        const orden = { open: 0, quoted: 1, accepted: 2 };
        const visibles = [...detalles].sort((a, b) => (orden[a.status] ?? 3) - (orden[b.status] ?? 3));
        const contenido =
          visibles.length === 0
            ? crearVacio("Aún no tienes solicitudes. Te avisaremos cuando un cliente te escriba.")
            : crear("ul", { clase: "lista" }, visibles.map(crearTarjetaSolicitud));
        return sinPublicar ? [sinPublicar, contenido] : contenido;
      },
    );
  cargar();

  // Notificaciones en tiempo real: nuevas solicitudes, cancelaciones y presupuestos respondidos.
  let salio = false;
  /** @type {(() => void) | null} */
  let cancelar = null;
  alSalir(() => {
    salio = true;
    cancelar?.();
  });
  api
    .subscribeToNotifications((aviso) => {
      if (["request_received", "request_cancelled", "quote_accepted", "quote_rejected"].includes(aviso.type)) {
        cargar();
      }
    })
    .then((c) => {
      if (salio) c();
      else cancelar = c;
    })
    .catch(() => {});
  return pantalla;
}
