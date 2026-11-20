// Foto de perfil (propia o de la contraparte) con iniciales de respaldo. Las fotos son privadas: cada ruta
// (`avatar_path`) se convierte en una URL firmada que caduca en 1 hora, así que se guarda poco menos de ese tiempo.
import { crear } from "../../ui/dom.js";
import { iniciales } from "../../ui/layout.js";
import { api } from "./index.js";

const VIGENCIA_MS = 50 * 60 * 1000;

/** @type {Map<string, { url: Promise<string | null>, vence: number }>} */
const urls = new Map();

/**
 * URL firmada de una foto de perfil, o null si no se puede ver. Reutiliza la URL mientras siga vigente.
 * @param {string} avatarPath
 * @param {number} [ahora]
 * @returns {Promise<string | null>}
 */
export function urlDeAvatar(avatarPath, ahora = Date.now()) {
  const guardada = urls.get(avatarPath);
  if (guardada && guardada.vence > ahora) return guardada.url;
  const url = api.getAvatarUrl(avatarPath).catch(() => {
    urls.delete(avatarPath);
    return null;
  });
  urls.set(avatarPath, { url, vence: ahora + VIGENCIA_MS });
  return url;
}

/** Olvida las URLs guardadas (al cerrar sesión o en pruebas). */
export function olvidarAvatares() {
  urls.clear();
}

/**
 * Avatar circular: muestra las iniciales y, si hay foto, la cambia por la imagen cuando carga.
 * @param {{ nombre: string, avatarPath?: string | null, clase?: string }} opciones
 * @returns {HTMLElement}
 */
export function crearAvatar({ nombre, avatarPath = null, clase = "" }) {
  const avatar = crear("span", { clase: ["avatar", clase].filter(Boolean).join(" "), texto: iniciales(nombre), attrs: { "aria-hidden": "true" } });
  if (avatarPath) {
    urlDeAvatar(avatarPath).then((url) => {
      if (!url) return;
      const img = crear("img", { attrs: { src: url, alt: "" } });
      img.addEventListener("load", () => avatar.replaceChildren(img));
    });
  }
  return avatar;
}
