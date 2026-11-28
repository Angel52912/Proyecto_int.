// Avisos del sistema (los del teléfono o la PC, fuera de la app). Cuando llega una novedad en vivo y la persona no está
// viendo la app (otra pestaña o la app minimizada), se muestra un aviso del sistema; al tocarlo, la app se abre en la
// pantalla de esa novedad (sw.js, "notificationclick"). Con la app a la vista se sigue usando el aviso flotante.
// Con la app CERRADA hace falta push del servidor: ver docs/notificaciones-push.md (lo prepara el backend).
import { crear } from "./dom.js";
import { icono } from "./iconos.js";

/** @returns {boolean} si este navegador puede mostrar avisos del sistema */
export function soportaAvisosSistema() {
  return typeof window !== "undefined" && "Notification" in window && "serviceWorker" in navigator;
}

/** @returns {"default" | "granted" | "denied" | "sin-soporte"} */
export function permisoAvisos() {
  return soportaAvisosSistema() ? /** @type {"default" | "granted" | "denied"} */ (Notification.permission) : "sin-soporte";
}

/**
 * ¿Toca mostrar el aviso del sistema? Solo con permiso y si la persona no está viendo la app.
 * @param {"default" | "granted" | "denied" | "sin-soporte"} permiso
 * @param {DocumentVisibilityState} visibilidad
 * @returns {boolean}
 */
export function debeAvisarAlSistema(permiso, visibilidad) {
  return permiso === "granted" && visibilidad !== "visible";
}

/**
 * Muestra el aviso del sistema (si corresponde). `tag` evita repetir el mismo aviso.
 * @param {{ titulo: string, detalle: string, ruta: string | null, tag?: string }} aviso
 * @returns {Promise<boolean>} true si se mostró
 */
export async function mostrarAvisoSistema(aviso) {
  if (!debeAvisarAlSistema(permisoAvisos(), document.visibilityState)) return false;
  const opciones = { body: aviso.detalle, icon: "front/icons/icon-192.png", badge: "front/icons/icon-192.png", tag: aviso.tag, lang: "es", data: { ruta: aviso.ruta ?? "/" } };
  try {
    const registro = await navigator.serviceWorker.getRegistration();
    if (registro) {
      await registro.showNotification(aviso.titulo, opciones);
      return true;
    }
    // Sin service worker (en localhost se omite): el aviso abre la pantalla al tocarlo desde aquí mismo.
    const notificacion = new Notification(aviso.titulo, opciones);
    notificacion.addEventListener("click", () => {
      window.focus();
      window.location.hash = `#${aviso.ruta ?? "/"}`;
      notificacion.close();
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Tarjeta de la pantalla Avisos para activarlos en este dispositivo. El permiso se pide solo al tocar el botón.
 * @returns {HTMLElement | null} null si el navegador no los soporta
 */
export function crearActivarAvisos() {
  if (!soportaAvisosSistema()) return null;
  const tarjeta = crear("div", { clase: "avisos-dispositivo", attrs: { "aria-live": "polite" } });

  const pintar = () => {
    const permiso = permisoAvisos();
    if (permiso === "granted") {
      tarjeta.replaceChildren(
        icono("check", { tam: 18 }),
        crear("p", { texto: "Avisos activados en este dispositivo. Te avisamos aunque estés en otra app, mientras MiXanab siga abierta." }),
      );
      tarjeta.className = "avisos-dispositivo avisos-dispositivo--activo";
      return;
    }
    if (permiso === "denied") {
      tarjeta.replaceChildren(
        icono("campana", { tam: 18 }),
        crear("p", { texto: "Bloqueaste los avisos de MiXanab. Para recibirlos, actívalos en la configuración del navegador." }),
      );
      tarjeta.className = "avisos-dispositivo avisos-dispositivo--bloqueado";
      return;
    }
    const activar = crear("button", {
      clase: "boton boton--secundario",
      texto: "Activar",
      attrs: { type: "button" },
      on: {
        click: async () => {
          await Notification.requestPermission().catch(() => "default");
          pintar();
        },
      },
    });
    tarjeta.replaceChildren(
      icono("campana", { tam: 20 }),
      crear("div", { clase: "avisos-dispositivo__texto" }, [
        crear("p", { clase: "avisos-dispositivo__titulo", texto: "Recibe avisos en este dispositivo" }),
        crear("p", { texto: "Presupuestos, avances y entregas, aunque estés en otra app." }),
      ]),
      activar,
    );
    tarjeta.className = "avisos-dispositivo";
  };

  pintar();
  return tarjeta;
}
