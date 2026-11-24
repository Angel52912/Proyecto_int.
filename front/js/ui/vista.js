// Fase 4: alternador visible solo para admin. Fuerza la vista Android o PC sin tocar las rutas.
import { obtenerPerfilActual } from "../features/auth/guardia.js";
import { crear } from "./dom.js";
import { icono } from "./iconos.js";

const CLAVE = "mixanab-vista";

/** @param {"auto" | "movil" | "pc"} vista */
function aplicar(vista) {
  if (vista === "auto") delete document.documentElement.dataset.vista;
  else document.documentElement.dataset.vista = vista;
}

/** @returns {"auto" | "movil" | "pc"} */
function leerPreferencia() {
  try {
    const valor = localStorage.getItem(CLAVE);
    return valor === "pc" || valor === "movil" ? valor : "auto";
  } catch {
    return "auto";
  }
}

/** @param {"movil" | "pc"} vista */
function guardar(vista) {
  try {
    localStorage.setItem(CLAVE, vista);
  } catch {
    // Sin almacenamiento el alternador sigue funcionando durante la sesión.
  }
}

export async function instalarAlternadorVista() {
  /** @type {HTMLButtonElement | null} */
  let boton = null;

  const sincronizar = async () => {
    const perfil = await obtenerPerfilActual().catch(() => null);
    if (perfil?.role !== "admin") {
      boton?.remove();
      boton = null;
      aplicar("auto");
      return;
    }
    if (boton !== null) return;

    let vista = leerPreferencia();
    aplicar(vista);
    const texto = crear("span", { texto: vista === "movil" ? "Vista PC" : "Vista Android" });
    boton = crear(
      "button",
      {
        clase: "alternador-vista",
        attrs: { type: "button", "aria-label": "Alternar entre vista Android y PC", "aria-pressed": String(vista === "pc") },
        on: {
          click: () => {
            const forzada = document.documentElement.dataset.vista;
            const enPc = forzada === "pc" || (forzada === undefined && window.matchMedia?.("(min-width: 1024px)").matches === true);
            vista = enPc ? "movil" : "pc";
            aplicar(vista);
            guardar(vista);
            texto.textContent = vista === "pc" ? "Vista Android" : "Vista PC";
            boton?.setAttribute("aria-pressed", String(vista === "pc"));
          },
        },
      },
      [icono(vista === "pc" ? "movil" : "escritorio"), texto],
    );
    document.body.append(boton);
  };

  // En modo simulado el rol puede cambiar al entrar como admin desde la pantalla de simulación.
  window.addEventListener("hashchange", () => void sincronizar());
  await sincronizar();
}
