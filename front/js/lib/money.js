const formato = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" });

/**
 * Formatea un monto como pesos mexicanos (`$1,234.50`).
 * @param {number} monto
 * @returns {string}
 */
export function formatearMxn(monto) {
  if (!Number.isFinite(monto)) throw new RangeError("El monto debe ser un número finito.");
  return formato.format(monto);
}
