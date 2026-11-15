// Fases del pedido (CU-05) y estados de la orden en pantalla.

/** @type {Readonly<Record<number, string>>} */
export const NOMBRE_FASE = Object.freeze({
  1: "Inspección",
  2: "Desinfección / pretratamiento",
  3: "Limpieza / reparación",
  4: "Secado / detallado",
});

/** Nombres cortos para las columnas del tablero. */
export const NOMBRE_FASE_CORTO = Object.freeze({ 1: "Inspección", 2: "Desinfección", 3: "Limpieza / Rep.", 4: "Secado" });

/** @type {Readonly<Record<string, { texto: string, tono: "miel" | "cenote" | "exito" | "cuero" | "error" | "neutra" }>>} */
export const ESTADO_ORDEN = Object.freeze({
  in_progress: { texto: "En proceso", tono: "miel" },
  ready: { texto: "Listo", tono: "exito" },
  delivered: { texto: "Entregado", tono: "exito" },
  cancelled: { texto: "Cancelado", tono: "error" },
});

/** @type {Readonly<Record<string, { texto: string, tono: "miel" | "cenote" | "exito" | "cuero" | "error" | "neutra" }>>} */
export const ESTADO_SOLICITUD = Object.freeze({
  draft: { texto: "Borrador", tono: "neutra" },
  open: { texto: "Nueva", tono: "miel" },
  quoted: { texto: "Cotizada", tono: "cenote" },
  accepted: { texto: "Aceptada", tono: "exito" },
  declined: { texto: "Rechazada", tono: "error" },
  cancelled: { texto: "Cancelada", tono: "error" },
});
