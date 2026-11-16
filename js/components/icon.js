// Iconos SVG propios (el proyecto no tiene librería de iconos).
// Trazo 1.75, viewBox 24×24, fill none y currentColor.

/** @type {Record<string, Array<[string, Record<string, string>]>>} */
const TRAZOS = {
  home: [
    ["path", { d: "M3 10.5 12 3l9 7.5V21a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z" }],
  ],
  "map-pin": [
    ["path", { d: "M12 21s7-6.1 7-11a7 7 0 1 0-14 0c0 4.9 7 11 7 11z" }],
    ["circle", { cx: "12", cy: "10", r: "2.5" }],
  ],
  clipboard: [
    ["rect", { x: "5", y: "4", width: "14", height: "17", rx: "2" }],
    ["path", { d: "M9 4V3h6v1M9 9h6M9 13h6M9 17h4" }],
  ],
  user: [
    ["circle", { cx: "12", cy: "8", r: "4" }],
    ["path", { d: "M4 21c0-4 3.6-7 8-7s8 3 8 7" }],
  ],
  bell: [
    ["path", { d: "M18 8a6 6 0 1 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" }],
    ["path", { d: "M10 21h4" }],
  ],
  search: [
    ["circle", { cx: "11", cy: "11", r: "7" }],
    ["path", { d: "m20 20-4.3-4.3" }],
  ],
  filter: [["path", { d: "M4 5h16M7 12h10M10 19h4" }]],
  wrench: [
    [
      "path",
      {
        d: "M14.7 6.3a4 4 0 0 0-5.4 5.4L4 17l3 3 5.3-5.3a4 4 0 0 0 5.4-5.4l-2.3 2.3-2-2z",
      },
    ],
  ],
  sparkle: [
    ["path", { d: "M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" }],
    ["path", { d: "M19 16l.7 2.3L22 19l-2.3.7L19 22l-.7-2.3L16 19l2.3-.7z" }],
  ],
  "chevron-right": [["path", { d: "m9 6 6 6-6 6" }]],
  "chevron-left": [["path", { d: "m15 6-6 6 6 6" }]],
  star: [
    [
      "path",
      { d: "M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.8-5.2 2.8 1-5.8L3.5 9.7l5.9-.9z" },
    ],
  ],
  "star-outline": [
    [
      "path",
      { d: "M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.8-5.2 2.8 1-5.8L3.5 9.7l5.9-.9z" },
    ],
  ],
  camera: [
    ["path", { d: "M4 8h3l1.5-2h7L17 8h3v11H4z" }],
    ["circle", { cx: "12", cy: "13", r: "3.5" }],
  ],
  image: [
    ["rect", { x: "3", y: "4", width: "18", height: "16", rx: "2" }],
    ["circle", { cx: "8.5", cy: "9", r: "1.5" }],
    ["path", { d: "m21 15-5-5L5 20" }],
  ],
  send: [
    ["path", { d: "M22 2 11 13" }],
    ["path", { d: "M22 2 15 22l-4-9-9-4z" }],
  ],
  message: [
    ["path", { d: "M21 12a8 8 0 0 1-8 8H5l-2 2V12a8 8 0 0 1 8-8h2a8 8 0 0 1 8 8z" }],
  ],
  calendar: [
    ["rect", { x: "3", y: "5", width: "18", height: "16", rx: "2" }],
    ["path", { d: "M8 3v4M16 3v4M3 10h18" }],
  ],
  clock: [
    ["circle", { cx: "12", cy: "12", r: "9" }],
    ["path", { d: "M12 7v5l3 2" }],
  ],
  "shield-check": [
    ["path", { d: "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" }],
    ["path", { d: "m9 12 2 2 4-4" }],
  ],
  check: [["path", { d: "m5 12 4 4L19 6" }]],
  x: [["path", { d: "M6 6l12 12M18 6 6 18" }]],
  navigation: [["path", { d: "M3 11l18-8-8 18-2-8z" }]],
};

const SVG = "http://www.w3.org/2000/svg";

/**
 * Crea un icono SVG.
 * @param {{ name: string, size?: number, color?: string }} props
 * @returns {SVGSVGElement}
 */
export function Icon({ name, size = 20, color } = { name: "" }) {
  const svg = document.createElementNS(SVG, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("width", String(size));
  svg.setAttribute("height", String(size));
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "1.75");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.setAttribute("aria-hidden", "true");
  svg.classList.add("ui-icono");
  if (color !== undefined) svg.style.color = color;

  for (const [etiqueta, atributos] of TRAZOS[name] ?? []) {
    const hijo = document.createElementNS(SVG, etiqueta);
    for (const [clave, valor] of Object.entries(atributos)) {
      hijo.setAttribute(clave, valor);
    }
    svg.append(hijo);
  }

  return svg;
}
