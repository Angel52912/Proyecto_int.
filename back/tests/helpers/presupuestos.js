// Datos de apoyo para las pruebas RLS de CU-04 (presupuestos y órdenes). Todo se inserta como superusuario.

/**
 * Fecha futura en formato YYYY-MM-DD.
 * @param {number} [dias] días a partir de hoy
 * @returns {string}
 */
export function fechaFutura(dias = 7) {
  return new Date(Date.now() + dias * 86_400_000).toISOString().slice(0, 10);
}

/**
 * Inserta un presupuesto con el estado indicado (sin pasar por las funciones).
 * @param {import("pg").Client} c
 * @param {string} solicitud
 * @param {"sent" | "accepted" | "rejected" | "superseded"} [status]
 * @returns {Promise<string>} id del presupuesto
 */
export async function crearPresupuesto(c, solicitud, status = "sent") {
  await c.query("reset role");
  const { rows } = await c.query(
    `insert into public.quotes (request_id, amount_mxn, delivery_date, status)
     values ($1, 250, $2, $3::public.quote_status) returning id`,
    [solicitud, fechaFutura(), status],
  );
  return rows[0].id;
}

/**
 * Inserta una orden para un presupuesto aceptado (sin pasar por las funciones).
 * @param {import("pg").Client} c
 * @param {{ quote: string, request: string, cliente: string, taller: string }} datos
 * @returns {Promise<string>} id de la orden
 */
export async function crearOrden(c, { quote, request, cliente, taller }) {
  await c.query("reset role");
  const { rows } = await c.query(
    `insert into public.orders (quote_id, request_id, client_id, workshop_id, due_date)
     values ($1, $2, $3, $4, $5) returning id`,
    [quote, request, cliente, taller, fechaFutura()],
  );
  return rows[0].id;
}
