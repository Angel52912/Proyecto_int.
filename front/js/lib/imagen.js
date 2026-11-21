// Compresión de fotos en el navegador antes de subirlas (el contrato pide comprimir en el frontend).
const LADO_MAXIMO = 1600;
const CALIDAD = 0.82;

/**
 * Reduce la foto a un lado máximo de 1600 px en JPEG. Si el navegador no puede (o el resultado pesa más),
 * devuelve el archivo original; la validación de tipo y tamaño la hace `validarImagen` y la api.
 * @param {File} archivo
 * @returns {Promise<File>}
 */
export async function comprimirImagen(archivo) {
  if (typeof createImageBitmap !== "function" || typeof document === "undefined") return archivo;
  try {
    const mapa = await createImageBitmap(archivo);
    const escala = Math.min(1, LADO_MAXIMO / Math.max(mapa.width, mapa.height));
    const lienzo = document.createElement("canvas");
    lienzo.width = Math.round(mapa.width * escala);
    lienzo.height = Math.round(mapa.height * escala);
    const contexto = lienzo.getContext("2d");
    if (contexto === null) return archivo;
    contexto.drawImage(mapa, 0, 0, lienzo.width, lienzo.height);
    mapa.close();
    const blob = await new Promise((resolver) => lienzo.toBlob(resolver, "image/jpeg", CALIDAD));
    if (!(blob instanceof Blob) || blob.size >= archivo.size) return archivo;
    const nombre = archivo.name.replace(/\.[^.]+$/, "") || "foto";
    return new File([blob], `${nombre}.jpg`, { type: "image/jpeg" });
  } catch {
    return archivo;
  }
}
