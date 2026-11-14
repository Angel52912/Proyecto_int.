import { existsSync, readFileSync } from "node:fs";
import pg from "pg";

/**
 * Lee `TEST_DATABASE_URL` del entorno o de `.env.test` (ignorado por Git). Nunca la imprime.
 * @returns {string}
 */
function leerUrlDePruebas() {
  const deEntorno = process.env.TEST_DATABASE_URL;
  if (deEntorno) return deEntorno;
  if (existsSync(".env.test")) {
    for (const linea of readFileSync(".env.test", "utf8").split(/\r?\n/)) {
      const coincidencia = /^\s*TEST_DATABASE_URL\s*=\s*(.+?)\s*$/.exec(linea);
      if (coincidencia) return coincidencia[1].replace(/^["']|["']$/g, "");
    }
  }
  throw new Error("Falta TEST_DATABASE_URL (ver tests/rls/ejemplo-env-pruebas.txt). Debe apuntar al proyecto de PRUEBAS.");
}

/**
 * Abre una conexión y una transacción. Todo lo que hagan las pruebas se revierte al cerrar.
 * @returns {Promise<pg.Client>}
 */
export async function abrirTransaccion() {
  const cliente = new pg.Client({ connectionString: leerUrlDePruebas(), ssl: { rejectUnauthorized: false } });
  await cliente.connect();
  await cliente.query("begin");
  return cliente;
}

/**
 * Revierte la transacción y cierra la conexión.
 * @param {pg.Client} cliente
 * @returns {Promise<void>}
 */
export async function cerrarTransaccion(cliente) {
  try {
    await cliente.query("rollback");
  } finally {
    await cliente.end();
  }
}

/**
 * Crea un usuario en auth.users (el trigger crea su perfil) y devuelve su id.
 * @param {pg.Client} cliente
 * @param {string} correo
 * @param {object} [metadata] raw_user_meta_data (para probar que se ignora)
 * @returns {Promise<string>}
 */
export async function crearUsuario(cliente, correo, metadata = {}) {
  await cliente.query("reset role");
  const { rows } = await cliente.query(
    "insert into auth.users (id, email, raw_user_meta_data) values (gen_random_uuid(), $1, $2::jsonb) returning id",
    [correo, JSON.stringify(metadata)],
  );
  return rows[0].id;
}

/**
 * Asigna el rol como superusuario (simula la creación manual del admin o un rol ya elegido).
 * @param {pg.Client} cliente
 * @param {string} uid
 * @param {"client" | "craftsman" | "admin"} rol
 * @returns {Promise<void>}
 */
export async function asignarRol(cliente, uid, rol) {
  await cliente.query("reset role");
  await cliente.query("update public.profiles set role = $2::public.user_role where id = $1", [uid, rol]);
}

/**
 * Actúa como un usuario autenticado (uid) o como anónimo (uid nulo) hasta el siguiente cambio.
 * @param {pg.Client} cliente
 * @param {string | null} uid
 * @returns {Promise<void>}
 */
export async function actuarComo(cliente, uid) {
  await cliente.query("reset role");
  if (uid === null) {
    await cliente.query("select set_config('request.jwt.claims', '', true)");
    await cliente.query("set local role anon");
    return;
  }
  const claims = JSON.stringify({ sub: uid, role: "authenticated" });
  await cliente.query("select set_config('request.jwt.claims', $1, true)", [claims]);
  await cliente.query("set local role authenticated");
}

/**
 * Autenticado pero sin `sub` (token sin usuario): auth.uid() es nulo.
 * @param {pg.Client} cliente
 * @returns {Promise<void>}
 */
export async function actuarSinUsuario(cliente) {
  await cliente.query("reset role");
  await cliente.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ role: "authenticated" })]);
  await cliente.query("set local role authenticated");
}

/**
 * Ejecuta una consulta que puede fallar sin abortar la transacción (usa un savepoint).
 * @param {pg.Client} cliente
 * @param {string} sql
 * @param {unknown[]} [parametros]
 * @returns {Promise<{ rows: any[], rowCount: number, error: (Error & { code?: string }) | null }>}
 */
export async function intentar(cliente, sql, parametros = []) {
  await cliente.query("savepoint intento");
  try {
    const resultado = await cliente.query(sql, parametros);
    await cliente.query("release savepoint intento");
    return { rows: resultado.rows, rowCount: resultado.rowCount ?? 0, error: null };
  } catch (error) {
    await cliente.query("rollback to savepoint intento");
    return { rows: [], rowCount: 0, error: /** @type {Error & { code?: string }} */ (error) };
  }
}
