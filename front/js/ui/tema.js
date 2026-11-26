// Tema de color: Automático (sigue al sistema), Claro u Oscuro. Se guarda en este dispositivo.
// El script front/js/antes-de-pintar.js aplica la preferencia antes de pintar para que no parpadee.
import { crear } from "./dom.js";

export const CLAVE_TEMA = "mixanab-tema";

/** @typedef {"auto" | "claro" | "oscuro"} Tema */

const OPCIONES = /** @type {ReadonlyArray<{ valor: Tema, texto: string }>} */ ([
  { valor: "auto", texto: "Automático" },
  { valor: "claro", texto: "Claro" },
  { valor: "oscuro", texto: "Oscuro" },
]);

/** @returns {Tema} */
export function obtenerTema() {
  try {
    const guardado = globalThis.localStorage?.getItem(CLAVE_TEMA);
    return guardado === "claro" || guardado === "oscuro" ? guardado : "auto";
  } catch {
    return "auto";
  }
}

/**
 * Aplica y guarda el tema: `<html data-tema>` solo existe cuando se fuerza Claro u Oscuro.
 * @param {Tema} tema
 */
export function aplicarTema(tema) {
  const raiz = document.documentElement;
  if (tema === "auto") delete raiz.dataset.tema;
  else raiz.dataset.tema = tema;
  try {
    if (tema === "auto") globalThis.localStorage?.removeItem(CLAVE_TEMA);
    else globalThis.localStorage?.setItem(CLAVE_TEMA, tema);
  } catch {
    // Sin almacenamiento (modo privado): el tema dura solo esta visita.
  }
}

/**
 * Selector de tema (tres botones, uno marcado) para las pantallas de perfil.
 * @returns {HTMLElement}
 */
export function crearSelectorTema() {
  const actual = obtenerTema();
  const botones = OPCIONES.map((opcion) =>
    crear("button", {
      clase: "selector-tema__opcion",
      texto: opcion.texto,
      attrs: { type: "button", "aria-pressed": String(opcion.valor === actual), "data-tema": opcion.valor },
      on: {
        click: () => {
          aplicarTema(opcion.valor);
          for (const boton of botones) boton.setAttribute("aria-pressed", String(boton === botonDe(opcion.valor)));
        },
      },
    }),
  );
  const botonDe = (/** @type {Tema} */ valor) => botones[OPCIONES.findIndex((o) => o.valor === valor)];
  return crear("div", { clase: "selector-tema" }, [
    crear("p", { clase: "selector-tema__titulo", texto: "Tema de color", attrs: { id: "selector-tema-titulo" } }),
    crear("div", { clase: "selector-tema__opciones", attrs: { role: "group", "aria-labelledby": "selector-tema-titulo" } }, botones),
  ]);
}
