// Formato de fechas en español corto ("18 nov", "10:21", "Hace 10 min").
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const DIA_MS = 86_400_000;

/**
 * Convierte `YYYY-MM-DD` (fecha local, sin desfase de zona) o ISO 8601 en Date.
 * @param {string | Date} valor
 * @returns {Date}
 */
export function aFecha(valor) {
  if (valor instanceof Date) return valor;
  const soloDia = /^(\d{4})-(\d{2})-(\d{2})$/.exec(valor);
  if (soloDia) return new Date(Number(soloDia[1]), Number(soloDia[2]) - 1, Number(soloDia[3]));
  return new Date(valor);
}

/**
 * "18 nov" (agrega el año si no es el actual).
 * @param {string | Date} valor
 * @param {Date} [ahora]
 * @returns {string}
 */
export function formatearFecha(valor, ahora = new Date()) {
  const fecha = aFecha(valor);
  if (Number.isNaN(fecha.getTime())) return "";
  const base = `${fecha.getDate()} ${MESES[fecha.getMonth()]}`;
  return fecha.getFullYear() === ahora.getFullYear() ? base : `${base} ${fecha.getFullYear()}`;
}

/**
 * "10:21" (24 h, hora local).
 * @param {string | Date} valor
 * @returns {string}
 */
export function formatearHora(valor) {
  const fecha = aFecha(valor);
  if (Number.isNaN(fecha.getTime())) return "";
  return `${String(fecha.getHours()).padStart(2, "0")}:${String(fecha.getMinutes()).padStart(2, "0")}`;
}

/** @param {Date} fecha */
const inicioDelDia = (fecha) => new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate()).getTime();

/**
 * Días naturales desde hoy hasta la fecha (negativo si ya pasó).
 * @param {string | Date} valor
 * @param {Date} [ahora]
 * @returns {number}
 */
export function diasHasta(valor, ahora = new Date()) {
  return Math.round((inicioDelDia(aFecha(valor)) - inicioDelDia(ahora)) / DIA_MS);
}

/**
 * "Hace 10 min", "Hace 3 h", "Ayer" o la fecha corta.
 * @param {string | Date} valor
 * @param {Date} [ahora]
 * @returns {string}
 */
export function formatearHace(valor, ahora = new Date()) {
  const fecha = aFecha(valor);
  const minutos = Math.floor((ahora.getTime() - fecha.getTime()) / 60_000);
  if (minutos < 1) return "Ahora";
  if (minutos < 60) return `Hace ${minutos} min`;
  const dias = -diasHasta(fecha, ahora);
  if (dias === 0) return `Hace ${Math.floor(minutos / 60)} h`;
  if (dias === 1) return "Ayer";
  return formatearFecha(fecha, ahora);
}
