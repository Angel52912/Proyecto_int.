// Fotos del modo simulado (solo api.mock.js). Antes eran URLs falsas (https://simulado.local/…) que la
// política de seguridad (CSP: img-src 'self' data: blob: …) bloqueaba, y llenaban la consola de errores.
// - Una foto que la persona sube de verdad (un File o Blob) se muestra tal cual con una URL blob: local.
// - Las fotos de ejemplo (o las subidas en pruebas sin archivo real) son una ilustración SVG en data:.
// La URL siempre contiene `carpeta/path`, como la URL pública o firmada de Supabase.

/** @type {Map<string, string>} path → URL blob: de la foto subida */
const subidas = new Map();

/**
 * Recuerda la foto subida para mostrarla tal cual. Sin navegador (pruebas) no hace nada.
 * @param {string} path
 * @param {unknown} archivo
 */
export function guardarFotoSimulada(path, archivo) {
  if (typeof Blob === "undefined" || !(archivo instanceof Blob) || typeof URL?.createObjectURL !== "function") return;
  try {
    subidas.set(path, URL.createObjectURL(archivo));
  } catch {
    // Sin URL local se usa la ilustración.
  }
}

/**
 * @param {string} carpeta bucket simulado, por ejemplo "request-photos"
 * @param {string} path ruta dentro del bucket
 * @returns {string} URL que el navegador puede mostrar con la CSP de la app
 */
export function urlFotoSimulada(carpeta, path) {
  const subida = subidas.get(path);
  if (subida) return subida;
  // Ilustración: fondo Arena, marco de foto y montaña en cuero claro. El título lleva carpeta/path.
  const antes =
    "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 120'><title>";
  const despues =
    "</title><rect width='120' height='120' fill='#e7ded3'/><rect x='30' y='34' width='60' height='52' rx='6' fill='none' stroke='#b08a6e' stroke-width='4'/><circle cx='48' cy='52' r='6' fill='#b08a6e'/><path d='M34 82l18-18 12 12 8-8 14 14' fill='none' stroke='#b08a6e' stroke-width='4' stroke-linejoin='round'/></svg>";
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(antes)}${carpeta}/${path}${encodeURIComponent(despues)}`;
}
