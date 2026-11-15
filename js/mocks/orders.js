// Datos de muestra del pedido en curso y del usuario (Nivel 2).
// TODO(BACKEND): reemplazar por las consultas reales de pedidos y perfil.

/** Pedido en curso que se muestra en Inicio (ids del diseño). */
export const currentOrder = {
  id: "1042",
  item: "Botas café",
  workshopId: "don-chucho",
  workshopName: "Talabartería Don Chucho",
  serviceLabel: "Limpieza",
  progress: 72,
};

/**
 * Detalle del pedido en curso para el seguimiento (CU-05).
 * Los campos de contrato (id, request_id, workshop_id, phase, status, due_date)
 * siguen docs/contrato-api.md; `item`, `workshopName`, `statusLabel`,
 * `totalPhases`, `progress`, `steps` y `progressPhotos` son presentación.
 */
export const orderDetail = {
  id: "1042",
  request_id: "1042",
  workshop_id: "don-chucho",
  phase: 3,
  status: "in_progress",
  due_date: "2026-11-17",
  item: "Botas café",
  workshopName: "Talabartería Don Chucho",
  statusLabel: "En proceso",
  totalPhases: 4,
  progress: 72,
  steps: [
    { title: "Inspección", meta: "12 nov · 10:30", state: "done" },
    { title: "Desinfección / pretratamiento", meta: "13 nov · 16:05", state: "done" },
    { title: "Limpieza / reparación", meta: "En curso · fotos nuevas", state: "current" },
    { title: "Secado / detallado", meta: "Estimado 17 nov", state: "pending" },
  ],
  progressPhotos: 3,
};

/** Usuario de muestra mientras no hay sesión (modo simulado). */
export const currentUser = {
  firstName: "José",
};
