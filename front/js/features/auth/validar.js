// Validación compartida por api.js y api.mock.js (CU-01). Refleja la migración 0017.
const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const RUTA_AVATAR = new RegExp(`^${UUID}/${UUID}$`);

/**
 * ¿Es una ruta de foto de perfil válida (`{uid}/{uuid}`, en minúsculas)?
 * @param {unknown} ruta
 * @returns {boolean}
 */
export function esRutaAvatar(ruta) {
  return typeof ruta === "string" && RUTA_AVATAR.test(ruta);
}
