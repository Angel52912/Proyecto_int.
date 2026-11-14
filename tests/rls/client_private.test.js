import { abrirTransaccion, actuarComo, asignarRol, cerrarTransaccion, crearUsuario, intentar } from "../helpers/db.js";

const PERMISO_DENEGADO = "42501";

/** CU-01: datos personales del cliente. El artesano y el admin no los ven. */
describe("client_private", () => {
  /** @type {import("pg").Client} */
  let c;
  let n = 0;
  const correo = () => `privado-${Date.now()}-${n++}@prueba.test`;

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

  test("el cliente hace CRUD de sus propios datos", async () => {
    const uid = await usuarioConRol("client");
    await actuarComo(c, uid);
    const ins = await intentar(c, "insert into public.client_private (user_id, age, address) values ($1, 30, 'Calle 60') returning age", [uid]);
    expect(ins.rows).toEqual([{ age: 30 }]);
    const upd = await intentar(c, "update public.client_private set age = 31 where user_id = $1 returning age", [uid]);
    expect(upd.rows).toEqual([{ age: 31 }]);
    const sel = await intentar(c, "select address from public.client_private");
    expect(sel.rows).toEqual([{ address: "Calle 60" }]);
    const del = await intentar(c, "delete from public.client_private where user_id = $1", [uid]);
    expect(del.rowCount).toBe(1);
  });

  test("el cliente no puede insertar datos a nombre de otro", async () => {
    const a = await usuarioConRol("client");
    const b = await usuarioConRol("client");
    await actuarComo(c, a);
    const r = await intentar(c, "insert into public.client_private (user_id, age, address) values ($1, 20, 'X')", [b]);
    expect(r.error?.code).toBe(PERMISO_DENEGADO);
  });

  test("un cliente no ve ni modifica los datos de otro cliente", async () => {
    const a = await usuarioConRol("client");
    const b = await usuarioConRol("client");
    await c.query("reset role");
    await c.query("insert into public.client_private (user_id, age, address) values ($1, 40, 'Privada')", [b]);
    await actuarComo(c, a);
    const sel = await intentar(c, "select * from public.client_private");
    const upd = await intentar(c, "update public.client_private set age = 1 where user_id = $1", [b]);
    const del = await intentar(c, "delete from public.client_private where user_id = $1", [b]);
    expect(sel.rows).toEqual([]);
    expect(upd.rowCount).toBe(0);
    expect(del.rowCount).toBe(0);
  });

  test("el cliente no puede cambiar user_id (sin UPDATE en esa columna)", async () => {
    const a = await usuarioConRol("client");
    const b = await usuarioConRol("client");
    await actuarComo(c, a);
    await intentar(c, "insert into public.client_private (user_id, age, address) values ($1, 20, 'X')", [a]);
    const r = await intentar(c, "update public.client_private set user_id = $2 where user_id = $1", [a, b]);
    expect(r.error?.code).toBe(PERMISO_DENEGADO);
  });

  test.each([
    ["artesano", "craftsman"],
    ["admin", "admin"],
    ["usuario sin rol", null],
  ])("%s no puede insertar ni leer", async (_nombre, rol) => {
    const uid = await usuarioConRol(/** @type {any} */ (rol));
    await c.query("reset role");
    await actuarComo(c, uid);
    const ins = await intentar(c, "insert into public.client_private (user_id, age, address) values ($1, 20, 'X')", [uid]);
    const sel = await intentar(c, "select * from public.client_private");
    expect(ins.error?.code).toBe(PERMISO_DENEGADO);
    expect(sel.rows).toEqual([]);
  });

  test("el artesano no lee los datos de un cliente", async () => {
    const cliente = await usuarioConRol("client");
    const artesano = await usuarioConRol("craftsman");
    await c.query("reset role");
    await c.query("insert into public.client_private (user_id, age, address) values ($1, 40, 'Privada')", [cliente]);
    await actuarComo(c, artesano);
    const sel = await intentar(c, "select * from public.client_private");
    expect(sel.rows).toEqual([]);
  });

  test("un cliente desactivado no puede escribir", async () => {
    const uid = await usuarioConRol("client");
    await c.query("reset role");
    await c.query("update public.profiles set active = false where id = $1", [uid]);
    await actuarComo(c, uid);
    const r = await intentar(c, "insert into public.client_private (user_id, age, address) values ($1, 20, 'X')", [uid]);
    expect(r.error?.code).toBe(PERMISO_DENEGADO);
  });

  test.each([
    ["edad 0", "0", "'X'"],
    ["edad 121", "121", "'X'"],
    ["dirección vacía", "20", "''"],
  ])("rechaza %s por restricción CHECK", async (_nombre, edad, direccion) => {
    const uid = await usuarioConRol("client");
    await actuarComo(c, uid);
    const r = await intentar(c, `insert into public.client_private (user_id, age, address) values ($1, ${edad}, ${direccion})`, [uid]);
    expect(r.error?.code).toBe("23514");
  });

  test("anónimo no tiene acceso", async () => {
    await actuarComo(c, null);
    const r = await intentar(c, "select * from public.client_private");
    expect(r.error?.code).toBe(PERMISO_DENEGADO);
  });
});
