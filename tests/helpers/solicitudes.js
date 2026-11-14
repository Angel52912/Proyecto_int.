// Datos de apoyo para las pruebas RLS de CU-03 (solicitudes, fotos, chat). Todo se inserta como superusuario.
export const UUID_A = "11111111-1111-4111-8111-111111111111";
export const UUID_B = "22222222-2222-4222-8222-222222222222";
export const PERMISO_DENEGADO = "42501";

/**
 * Crea un taller completo para el artesano.
 * @param {import("pg").Client} c
 * @param {string} dueno id del artesano
 * @param {{ published?: boolean, suspended?: boolean, services?: string }} [opciones] `services` como literal de arreglo, p. ej. "{repair}"
 * @returns {Promise<string>} id del taller
 */
export async function crearTallerPublicado(c, dueno, opciones = {}) {
  await c.query("reset role");
  const { published = true, suspended = false, services = "{repair,cleaning}" } = opciones;
  const { rows } = await c.query(
    `insert into public.workshops (owner_id, name, address, colonia, lat, lng, services, hours, price_from, published, suspended)
     values ($1, 'Taller', 'Calle 60', 'Centro', 20.96, -89.59, $2::public.service_type[], '{"mon":[{"open":"09:00","close":"18:00"}]}', 100, $3, $4)
     returning id`,
    [dueno, services, published, suspended],
  );
  return rows[0].id;
}

/**
 * Crea una solicitud con el estado indicado (como superusuario, sin pasar por las funciones).
 * @param {import("pg").Client} c
 * @param {string} cliente id del cliente
 * @param {string} taller id del taller
 * @param {"draft" | "open" | "quoted" | "accepted" | "declined" | "cancelled"} [status]
 * @returns {Promise<string>} id de la solicitud
 */
export async function crearSolicitud(c, cliente, taller, status = "draft") {
  await c.query("reset role");
  const { rows } = await c.query(
    `insert into public.service_requests (client_id, workshop_id, service_type, description, status, submitted_at)
     values ($1, $2, 'repair', 'Se despegó la suela', $3::public.request_status, case when $3 = 'draft' then null else now() end)
     returning id`,
    [cliente, taller, status],
  );
  return rows[0].id;
}

/**
 * Registra una foto de la solicitud (como superusuario).
 * @param {import("pg").Client} c
 * @param {string} solicitud
 * @param {string} [uuid]
 * @returns {Promise<string>} ruta de la foto
 */
export async function agregarFoto(c, solicitud, uuid = UUID_A) {
  await c.query("reset role");
  const path = `${solicitud}/${uuid}`;
  await c.query("insert into public.request_photos (request_id, path) values ($1, $2)", [solicitud, path]);
  return path;
}
