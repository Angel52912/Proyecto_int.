import { crearUsuarioConRol } from "./db.js";
import { crearOrden, crearPresupuesto } from "./presupuestos.js";
import { crearSolicitud, crearTallerPublicado } from "./solicitudes.js";

/**
 * Cliente, artesano, taller y solicitud en el estado indicado (como superusuario).
 * @param {import("pg").Client} c
 * @param {"draft" | "open" | "quoted" | "accepted" | "declined" | "cancelled"} [status]
 * @returns {Promise<{ cliente: string, artesano: string, taller: string, solicitud: string }>}
 */
export async function crearEscenarioSolicitud(c, status = "draft") {
  const cliente = await crearUsuarioConRol(c, "client");
  const artesano = await crearUsuarioConRol(c, "craftsman");
  const taller = await crearTallerPublicado(c, artesano);
  const solicitud = await crearSolicitud(c, cliente, taller, status);
  return { cliente, artesano, taller, solicitud };
}

/**
 * Solicitud aceptada, presupuesto aceptado y orden; opcionalmente en otra fase o estado.
 * @param {import("pg").Client} c
 * @param {{ statusOrden?: string, fase?: number, base?: { artesano: string, taller: string } }} [opciones]
 * @returns {Promise<{ cliente: string, artesano: string, taller: string, solicitud: string, quote: string, orden: string }>}
 */
export async function crearEscenarioPedido(c, opciones = {}) {
  const { statusOrden, fase, base } = opciones;
  let cliente;
  let artesano;
  let taller;
  let solicitud;

  if (base) {
    cliente = await crearUsuarioConRol(c, "client");
    ({ artesano, taller } = base);
    solicitud = await crearSolicitud(c, cliente, taller, "accepted");
  } else {
    ({ cliente, artesano, taller, solicitud } = await crearEscenarioSolicitud(c, "accepted"));
  }

  const quote = await crearPresupuesto(c, solicitud, "accepted");
  const orden = await crearOrden(c, { quote, request: solicitud, cliente, taller });
  if (fase !== undefined && fase !== 1) {
    await c.query("update public.orders set phase = $2 where id = $1", [orden, fase]);
  }
  if (statusOrden !== undefined) {
    await c.query("update public.orders set status = $2::public.order_status where id = $1", [orden, statusOrden]);
  }
  return { cliente, artesano, taller, solicitud, quote, orden };
}
