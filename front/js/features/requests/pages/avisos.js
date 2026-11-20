// Avisos de cliente y artesano: lista de notificaciones, marcar una o todas como leídas y abrir su pantalla.
import { formatearHace } from "../../../lib/fechas.js";
import { alSalir } from "../../../ui/ciclo.js";
import { crear, ir } from "../../../ui/dom.js";
import { cargarEn, crearVacio } from "../../../ui/estados.js";
import { icono } from "../../../ui/iconos.js";
import { crearPantalla } from "../../../ui/layout.js";
import { mensajeDeError } from "../../../ui/mensajes.js";
import { textoDelAviso } from "../avisos.js";
import { api } from "../index.js";

/**
 * @param {any} aviso Notificacion
 * @returns {HTMLLIElement}
 */
function crearFila(aviso) {
  const { titulo, detalle, ruta, icono: nombreIcono } = textoDelAviso(aviso);
  const sinLeer = aviso.read_at === null;
  const contenido = [
    crear("span", { clase: "aviso-fila__icono", attrs: { "aria-hidden": "true" } }, [icono(nombreIcono, { tam: 20 })]),
    crear("span", { clase: "aviso-fila__cuerpo" }, [
      crear("span", { clase: "aviso-fila__titulo", texto: titulo }),
      crear("span", { clase: "aviso-fila__detalle", texto: detalle }),
      crear("span", { clase: "aviso-fila__fecha", texto: formatearHace(new Date(aviso.created_at)) }),
    ]),
    sinLeer ? crear("span", { clase: "aviso-fila__punto" }, [crear("span", { clase: "oculto-visual", texto: "Sin leer" })]) : null,
  ];
  const boton = crear(
    "button",
    {
      clase: `aviso-fila${sinLeer ? " aviso-fila--nueva" : ""}`,
      attrs: { type: "button", "data-id": aviso.id },
      on: {
        click: async () => {
          // Se marca como leído aunque no tenga pantalla a la cual ir; si falla, igual se navega.
          if (sinLeer) await api.markNotificationRead(aviso.id).catch(() => null);
          if (ruta) ir(ruta);
          else {
            boton.classList.remove("aviso-fila--nueva");
            boton.querySelector(".aviso-fila__punto")?.remove();
          }
        },
      },
    },
    contenido,
  );
  return /** @type {HTMLLIElement} */ (crear("li", {}, [boton]));
}

/**
 * @param {"client" | "craftsman"} rol
 * @returns {() => Node}
 */
export function renderAvisos(rol) {
  return () => {
    const contenido = crear("div", { clase: "avisos__contenido" });
    const aviso = crear("p", { clase: "campo__error", attrs: { "aria-live": "polite" } });
    const marcarTodas = /** @type {HTMLButtonElement} */ (
      crear("button", {
        clase: "boton-texto",
        texto: "Marcar todas como leídas",
        attrs: { type: "button", hidden: true },
        on: {
          click: async () => {
            marcarTodas.disabled = true;
            aviso.textContent = "";
            try {
              await api.markAllNotificationsRead();
              contenido.querySelectorAll(".aviso-fila--nueva").forEach((fila) => fila.classList.remove("aviso-fila--nueva"));
              contenido.querySelectorAll(".aviso-fila__punto").forEach((punto) => punto.remove());
              marcarTodas.hidden = true;
            } catch (error) {
              aviso.textContent = mensajeDeError(error);
            } finally {
              marcarTodas.disabled = false;
            }
          },
        },
      })
    );

    /** @type {HTMLUListElement | null} */
    let lista = null;
    const pintar = (/** @type {any[]} */ avisos) => {
      if (avisos.length === 0) return crearVacio("No tienes avisos todavía. Aquí verás presupuestos, avances y entregas.");
      marcarTodas.hidden = !avisos.some((a) => a.read_at === null);
      lista = /** @type {HTMLUListElement} */ (crear("ul", { clase: "lista avisos__lista" }, avisos.map(crearFila)));
      return lista;
    };
    cargarEn(contenido, () => api.listMyNotifications(), pintar);

    // Los avisos nuevos aparecen arriba sin recargar.
    let salio = false;
    /** @type {(() => void) | null} */
    let cancelar = null;
    alSalir(() => {
      salio = true;
      cancelar?.();
    });
    api
      .subscribeToNotifications((nuevo) => {
        if (lista === null) {
          cargarEn(contenido, () => api.listMyNotifications(), pintar);
          return;
        }
        lista.prepend(crearFila(nuevo));
        marcarTodas.hidden = false;
      })
      .then((c) => {
        if (salio) c();
        else cancelar = c;
      })
      .catch(() => {});

    return crearPantalla({ titulo: "Avisos", volver: rol === "client" ? "/" : "/artesano/solicitudes", clase: "avisos" }, [
      crear("div", { clase: "avisos__acciones" }, [marcarTodas]),
      aviso,
      contenido,
    ]);
  };
}
