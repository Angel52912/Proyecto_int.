// Simulado en memoria de api.js de órdenes (CU-04, solo lectura). Comparte estado con requests/simulacion.js.
import { ApiError } from "../../lib/apiError.js";
import { exigirUuid } from "../requests/validar.js";
import { UID_CLIENTE, estado, exigirSesion } from "../requests/simulacion.js";

export { fijarSesionSimulada, reiniciarSimulacion } from "../requests/simulacion.js";

/**
 * ¿Participa el usuario simulado en la orden? Cliente de la orden o artesano dueño del taller (activos).
 * @param {import("../requests/simulacion.js").OrdenSim} orden
 */
function ordenVisible(orden) {
  if (!estado.activo) return false;
  if (estado.rol === "client") return orden.client_id === UID_CLIENTE;
  if (estado.rol === "craftsman") return orden.workshop_id === estado.taller.id;
  return false;
}

export async function listMyOrders() {
  exigirSesion();
  return estado.ordenes
    .filter(ordenVisible)
    .reverse()
    .map((o) => ({ ...o }));
}

/** @param {string} orderId */
export async function getOrder(orderId) {
  exigirUuid(orderId);
  exigirSesion();
  const orden = estado.ordenes.find((o) => o.id === orderId);
  if (!orden || !ordenVisible(orden)) throw new ApiError("not_found");
  return { ...orden };
}
