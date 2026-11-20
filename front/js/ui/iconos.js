// Íconos de línea (24×24, trazo de 2) dibujados con SVG por DOM. Sin fuentes ni archivos externos.
const SVG = "http://www.w3.org/2000/svg";

/** Círculo como trazo de path. */
const circulo = (/** @type {number} */ cx, /** @type {number} */ cy, /** @type {number} */ r) =>
  `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`;

/** @type {Record<string, string[]>} */
const TRAZOS = {
  inicio: ["M3 10.5 12 3l9 7.5", "M5 9.5V21h14V9.5", "M10 21v-6h4v6"],
  mapa: ["M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z", circulo(12, 9.5, 2.5)],
  pedidos: ["M9 3h6v3H9z", "M9 4.5H6a1 1 0 0 0-1 1V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V5.5a1 1 0 0 0-1-1h-3"],
  perfil: [circulo(12, 8, 4), "M4 21a8 8 0 0 1 16 0"],
  solicitudes: ["M3 13l3-8h12l3 8", "M3 13v6h18v-6h-5l-1.5 2h-5L8 13z"],
  tablero: ["M4 4h16v16H4z", "M9.3 4v16", "M14.7 4v16"],
  chat: ["M4 5h16v11H9l-5 4z"],
  buscar: [circulo(11, 11, 7), "M20 20l-4-4"],
  filtro: ["M3 5h18l-7 8v6l-4 2v-8z"],
  campana: ["M6 16v-5a6 6 0 0 1 12 0v5l2 2H4z", "M10 21h4"],
  reparacion: ["M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.4-.6-.6-2.4z"],
  limpieza: ["M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z", "M19 15l.6 1.4 1.4.6-1.4.6L19 19l-.6-1.4L17 17l1.4-.6z"],
  atras: ["M15 18l-6-6 6-6"],
  adelante: ["M9 18l6-6-6-6"],
  imagen: ["M4 5h16v14H4z", circulo(9, 10, 1.5), "M20 16l-5-5-8 8"],
  camara: ["M4 8h3l2-3h6l2 3h3v11H4z", circulo(12, 13, 3.5)],
  enviar: ["M22 2 11 13", "M22 2l-7 20-4-9-9-4z"],
  estrella: ["M12 3l2.8 5.8 6.2.9-4.5 4.4 1.1 6.2L12 17.4l-5.6 2.9 1.1-6.2L3 9.7l6.2-.9z"],
  check: ["M5 12.5l4.5 4.5L19 7.5"],
  reloj: [circulo(12, 12, 9), "M12 7v5l3 2"],
  calendario: ["M4 6h16v15H4z", "M4 10h16", "M8 3v4", "M16 3v4"],
  escudo: ["M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z", "M8.5 12l2.5 2.5 4.5-4.5"],
  navegar: ["M3 11l18-8-8 18-2-8z"],
  mas: ["M12 5v14", "M5 12h14"],
  cerrar: ["M6 6l12 12", "M18 6 6 18"],
  ajustes: [circulo(12, 12, 3), "M12 2v3", "M12 19v3", "M2 12h3", "M19 12h3", "M4.9 4.9 7 7", "M17 17l2.1 2.1", "M4.9 19.1 7 17", "M17 7l2.1-2.1"],
  qr: ["M4 4h6v6H4z", "M14 4h6v6h-6z", "M4 14h6v6H4z", "M14 14h2v2h-2z", "M18 18h2v2h-2z", "M14 18h2", "M18 14h2"],
  subir: ["M12 16V4", "M7 9l5-5 5 5", "M4 20h16"],
  dinero: ["M3 6h18v12H3z", circulo(12, 12, 2.5), "M6 9v.01", "M18 15v.01"],
  correo: ["M3 6h18v12H3z", "M3 7l9 6 9-6"],
};

/**
 * Crea un ícono SVG decorativo (aria-hidden). Para botones solo con ícono, pon `aria-label` en el botón.
 * @param {keyof typeof TRAZOS | string} nombre
 * @param {{ tam?: number, clase?: string, relleno?: boolean }} [opciones]
 * @returns {SVGSVGElement}
 */
export function icono(nombre, opciones = {}) {
  const tam = opciones.tam ?? 20;
  const svg = /** @type {SVGSVGElement} */ (document.createElementNS(SVG, "svg"));
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("width", String(tam));
  svg.setAttribute("height", String(tam));
  svg.setAttribute("fill", opciones.relleno ? "currentColor" : "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "2");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  svg.setAttribute("class", `icono${opciones.clase ? ` ${opciones.clase}` : ""}`);
  for (const d of TRAZOS[nombre] ?? []) {
    const trazo = document.createElementNS(SVG, "path");
    trazo.setAttribute("d", d);
    svg.append(trazo);
  }
  return svg;
}
