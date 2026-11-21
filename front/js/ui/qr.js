// Código QR como SVG (por DOM, sin HTML crudo) con qrcode-generator (js/vendor/qrcode.js, global `qrcode`).
const SVG = "http://www.w3.org/2000/svg";
const MARGEN = 4; // zona silenciosa en módulos

/**
 * Matriz de módulos del QR (true = oscuro). Nivel de corrección M.
 * @param {string} texto
 * @returns {boolean[][] | null} null si la librería no cargó.
 */
export function matrizQr(texto) {
  const generador = /** @type {any} */ (globalThis).qrcode;
  if (typeof generador !== "function") return null;
  const qr = generador(0, "M");
  qr.addData(texto);
  qr.make();
  const tam = qr.getModuleCount();
  return Array.from({ length: tam }, (_, fila) => Array.from({ length: tam }, (_, columna) => qr.isDark(fila, columna)));
}

/**
 * @param {string} texto Contenido del QR.
 * @param {string} etiqueta Texto alternativo.
 * @returns {SVGSVGElement | null}
 */
export function crearQr(texto, etiqueta) {
  const matriz = matrizQr(texto);
  if (matriz === null) return null;
  const lado = matriz.length + MARGEN * 2;
  const svg = /** @type {SVGSVGElement} */ (document.createElementNS(SVG, "svg"));
  svg.setAttribute("viewBox", `0 0 ${lado} ${lado}`);
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", etiqueta);
  svg.setAttribute("shape-rendering", "crispEdges");
  svg.setAttribute("class", "qr");
  const fondo = document.createElementNS(SVG, "rect");
  fondo.setAttribute("width", String(lado));
  fondo.setAttribute("height", String(lado));
  fondo.setAttribute("fill", "#fff");
  // Un solo path con un rectángulo por cada tramo horizontal de módulos oscuros.
  let trazo = "";
  matriz.forEach((fila, y) => {
    let x = 0;
    while (x < fila.length) {
      if (!fila[x]) {
        x += 1;
        continue;
      }
      const inicio = x;
      while (x < fila.length && fila[x]) x += 1;
      trazo += `M${inicio + MARGEN} ${y + MARGEN}h${x - inicio}v1h${inicio - x}z`;
    }
  });
  const modulos = document.createElementNS(SVG, "path");
  modulos.setAttribute("d", trazo);
  modulos.setAttribute("fill", "#2b211b");
  svg.append(fondo, modulos);
  return svg;
}
