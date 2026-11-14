import { abrirTransaccion, actuarComo, asignarRol, cerrarTransaccion, crearUsuario, intentar } from "../helpers/db.js";

const PERMISO_DENEGADO = "42501";
const HORARIO = JSON.stringify({ mon: [{ open: "09:00", close: "18:00" }] });

/** CU-07: tabla workshops. Solo el artesano dueño escribe; el cliente ve publicados y no suspendidos. */
describe("workshops", () => {
  /** @type {import("pg").Client} */
  let c;
  let n = 0;
  const correo = () => `taller-${Date.now()}-${n++}@prueba.test`;

  beforeAll(async () => {
    c = await abrirTransaccion();
  });

  afterAll(async () => {
    await cerrarTransaccion(c);
  });

  /** @param {"client" | "craftsman" | "admin" | null} rol */
  async function usuarioConRol(rol) {
    const uid = await crearUsuario(c, correo());
    if (rol) await asignarRol(c, uid, rol);
    return uid;
  }

  /**
   * Crea un taller como superusuario.
   * @param {string} owner
   * @param {{ published?: boolean, suspended?: boolean }} [opciones]
   * @returns {Promise<string>} id del taller
   */
  async function crearTaller(owner, { published = false, suspended = false } = {}) {
    await c.query("reset role");
    const { rows } = await c.query(
      `insert into public.workshops (owner_id, name, address, colonia, lat, lng, services, hours, price_from, published, suspended)
       values ($1, 'Taller', 'Calle 60', 'Centro', 20.96, -89.59, '{repair}', $2::jsonb, 100, $3, $4) returning id`,
      [owner, HORARIO, published, suspended],
    );
    return rows[0].id;
  }

  test("el artesano crea su taller en borrador y lo lee", async () => {
    const uid = await usuarioConRol("craftsman");
    await actuarComo(c, uid);
    const ins = await intentar(c, "insert into public.workshops (owner_id, name) values ($1, 'Mi taller') returning published, services", [uid]);
    expect(ins.rows).toEqual([{ published: false, services: [] }]);
    const sel = await intentar(c, "select name from public.workshops");
    expect(sel.rows).toEqual([{ name: "Mi taller" }]);
  });

  test("el artesano edita sus campos, pero no published, suspended, rating ni owner_id", async () => {
    const uid = await usuarioConRol("craftsman");
    const otro = await usuarioConRol("craftsman");
    await crearTaller(uid);
    await actuarComo(c, uid);
    const ok = await intentar(c, "update public.workshops set name = 'Nuevo', price_from = 200 where owner_id = $1 returning name", [uid]);
    expect(ok.rows).toEqual([{ name: "Nuevo" }]);
    for (const columna of ["published = true", "suspended = true", "rating_avg = 5", "rating_count = 9", `owner_id = '${otro}'`]) {
      const r = await intentar(c, `update public.workshops set ${columna} where owner_id = $1`, [uid]);
      expect({ columna, codigo: r.error?.code }).toEqual({ columna, codigo: PERMISO_DENEGADO });
    }
  });

  test("el artesano no puede insertar published, suspended ni rating", async () => {
    const uid = await usuarioConRol("craftsman");
    await actuarComo(c, uid);
    const r = await intentar(c, "insert into public.workshops (owner_id, name, published) values ($1, 'X', true)", [uid]);
    expect(r.error?.code).toBe(PERMISO_DENEGADO);
  });

  test("un artesano tiene un solo taller", async () => {
    const uid = await usuarioConRol("craftsman");
    await actuarComo(c, uid);
    await intentar(c, "insert into public.workshops (owner_id, name) values ($1, 'Uno')", [uid]);
    const r = await intentar(c, "insert into public.workshops (owner_id, name) values ($1, 'Dos')", [uid]);
    expect(r.error?.code).toBe("23505");
  });

  test("el artesano no crea talleres a nombre de otro", async () => {
    const a = await usuarioConRol("craftsman");
    const b = await usuarioConRol("craftsman");
    await actuarComo(c, a);
    const r = await intentar(c, "insert into public.workshops (owner_id, name) values ($1, 'X')", [b]);
    expect(r.error?.code).toBe(PERMISO_DENEGADO);
  });

  test("el artesano no ve ni modifica el taller de otro artesano, ni siquiera publicado", async () => {
    const a = await usuarioConRol("craftsman");
    const b = await usuarioConRol("craftsman");
    const tallerB = await crearTaller(b, { published: true });
    await actuarComo(c, a);
    const sel = await intentar(c, "select id from public.workshops");
    const upd = await intentar(c, "update public.workshops set name = 'Robado' where id = $1", [tallerB]);
    expect(sel.rows).toEqual([]);
    expect(upd.rowCount).toBe(0);
  });

  test("nadie puede borrar talleres desde la API", async () => {
    const uid = await usuarioConRol("craftsman");
    await crearTaller(uid);
    await actuarComo(c, uid);
    const r = await intentar(c, "delete from public.workshops where owner_id = $1", [uid]);
    expect(r.error?.code).toBe(PERMISO_DENEGADO);
  });

  test("el cliente ve solo talleres publicados y no suspendidos", async () => {
    const cliente = await usuarioConRol("client");
    const visible = await crearTaller(await usuarioConRol("craftsman"), { published: true });
    await crearTaller(await usuarioConRol("craftsman")); // borrador
    await crearTaller(await usuarioConRol("craftsman"), { published: true, suspended: true });
    await actuarComo(c, cliente);
    const sel = await intentar(c, "select id from public.workshops");
    expect(sel.rows).toEqual([{ id: visible }]);
  });

  test("el cliente no crea, edita ni borra talleres", async () => {
    const cliente = await usuarioConRol("client");
    const taller = await crearTaller(await usuarioConRol("craftsman"), { published: true });
    await actuarComo(c, cliente);
    const ins = await intentar(c, "insert into public.workshops (owner_id, name) values ($1, 'X')", [cliente]);
    const upd = await intentar(c, "update public.workshops set name = 'X' where id = $1", [taller]);
    const del = await intentar(c, "delete from public.workshops where id = $1", [taller]);
    expect(ins.error?.code).toBe(PERMISO_DENEGADO);
    expect(upd.rowCount).toBe(0);
    expect(del.error?.code).toBe(PERMISO_DENEGADO);
  });

  test.each([
    ["admin", "admin"],
    ["usuario sin rol", null],
  ])("%s no ve ni crea talleres", async (_nombre, rol) => {
    const uid = await usuarioConRol(/** @type {any} */ (rol));
    await crearTaller(await usuarioConRol("craftsman"), { published: true });
    await actuarComo(c, uid);
    const sel = await intentar(c, "select * from public.workshops");
    const ins = await intentar(c, "insert into public.workshops (owner_id, name) values ($1, 'X')", [uid]);
    expect(sel.rows).toEqual([]);
    expect(ins.error?.code).toBe(PERMISO_DENEGADO);
  });

  test("anónimo no tiene acceso", async () => {
    await actuarComo(c, null);
    const r = await intentar(c, "select * from public.workshops");
    expect(r.error?.code).toBe(PERMISO_DENEGADO);
  });

  test("un cliente desactivado no ve talleres y un artesano desactivado no escribe", async () => {
    const cliente = await usuarioConRol("client");
    const artesano = await usuarioConRol("craftsman");
    await crearTaller(artesano, { published: true });
    await c.query("update public.profiles set active = false where id = any($1)", [[cliente, artesano]]);
    await actuarComo(c, cliente);
    expect((await intentar(c, "select * from public.workshops")).rows).toEqual([]);
    await actuarComo(c, artesano);
    const upd = await intentar(c, "update public.workshops set name = 'X' where owner_id = $1", [artesano]);
    expect(upd.rowCount).toBe(0);
  });

  test("rechaza datos inválidos por restricción CHECK", async () => {
    const uid = await usuarioConRol("craftsman");
    await actuarComo(c, uid);
    const casos = [
      "name = ''",
      "postal_code = '977'",
      "price_from = 0",
      "lat = 91, lng = 0",
      "lat = 20",
      `hours = '[]'::jsonb`,
      `hours = '{"lunes":[]}'::jsonb`,
      `hours = '{"mon":[{"open":"18:00","close":"09:00"}]}'::jsonb`,
      `hours = '{"mon":[{"open":"9:00","close":"18:00"}]}'::jsonb`,
      `hours = '{"mon":[{"open":"01:00","close":"02:00"},{"open":"03:00","close":"04:00"},{"open":"05:00","close":"06:00"}]}'::jsonb`,
    ];
    await intentar(c, "insert into public.workshops (owner_id, name) values ($1, 'Base')", [uid]);
    for (const set of casos) {
      const r = await intentar(c, `update public.workshops set ${set} where owner_id = $1`, [uid]);
      expect({ set, codigo: r.error?.code }).toEqual({ set, codigo: "23514" });
    }
  });

  test("un horario válido se guarda", async () => {
    const uid = await usuarioConRol("craftsman");
    await actuarComo(c, uid);
    await intentar(c, "insert into public.workshops (owner_id, name) values ($1, 'Base')", [uid]);
    const r = await intentar(c, "update public.workshops set hours = $2::jsonb where owner_id = $1 returning hours", [uid, HORARIO]);
    expect(r.error).toBeNull();
    expect(r.rows[0].hours.mon).toHaveLength(1);
  });

  test("la base impide un taller publicado e incompleto", async () => {
    const uid = await usuarioConRol("craftsman");
    await c.query("reset role");
    const r = await intentar(c, "insert into public.workshops (owner_id, name, published) values ($1, 'X', true)", [uid]);
    expect(r.error?.code).toBe("23514");
  });
});
