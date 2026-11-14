import { abrirTransaccion, actuarComo, asignarRol, cerrarTransaccion, crearUsuario, intentar } from "../helpers/db.js";

const PERMISO_DENEGADO = "42501";
const HORARIO = JSON.stringify({ mon: [{ open: "09:00", close: "18:00" }] });

/** CU-07: publish_my_workshop y unpublish_my_workshop (validar y publicar, A1). */
describe("publicar taller", () => {
  /** @type {import("pg").Client} */
  let c;
  let n = 0;
  const correo = () => `publicar-${Date.now()}-${n++}@prueba.test`;

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

  /** Artesano con taller completo (borrador). */
  async function artesanoConTallerCompleto() {
    const uid = await usuarioConRol("craftsman");
    await c.query(
      `insert into public.workshops (owner_id, name, address, colonia, lat, lng, services, hours, price_from)
       values ($1, 'Taller', 'Calle 60', 'Centro', 20.96, -89.59, '{repair}', $2::jsonb, 100)`,
      [uid, HORARIO],
    );
    return uid;
  }

  test("taller completo: se publica y el cliente lo ve", async () => {
    const uid = await artesanoConTallerCompleto();
    const cliente = await usuarioConRol("client");
    await actuarComo(c, uid);
    const r = await intentar(c, "select public.publish_my_workshop() as r");
    expect(r.rows[0].r).toEqual({ published: true, missing: [] });
    await actuarComo(c, cliente);
    expect((await intentar(c, "select id from public.workshops")).rows).toHaveLength(1);
  });

  test("A1: taller incompleto no se publica y devuelve los campos faltantes", async () => {
    const uid = await usuarioConRol("craftsman");
    await c.query("insert into public.workshops (owner_id, name) values ($1, 'Solo nombre')", [uid]);
    await actuarComo(c, uid);
    const r = await intentar(c, "select public.publish_my_workshop() as r");
    expect(r.error).toBeNull();
    expect(r.rows[0].r).toEqual({
      published: false,
      missing: ["address", "colonia", "location", "services", "hours", "price_from"],
    });
    const taller = await intentar(c, "select published from public.workshops");
    expect(taller.rows).toEqual([{ published: false }]);
  });

  test("un horario sin ningún rango cuenta como faltante", async () => {
    const uid = await artesanoConTallerCompleto();
    await c.query(`update public.workshops set hours = '{"mon":[]}'::jsonb where owner_id = $1`, [uid]);
    await actuarComo(c, uid);
    const r = await intentar(c, "select public.publish_my_workshop() as r");
    expect(r.rows[0].r).toEqual({ published: false, missing: ["hours"] });
  });

  test("el artesano puede retirar su taller del mapa", async () => {
    const uid = await artesanoConTallerCompleto();
    const cliente = await usuarioConRol("client");
    await actuarComo(c, uid);
    await intentar(c, "select public.publish_my_workshop()");
    const r = await intentar(c, "select public.unpublish_my_workshop() as r");
    expect(r.rows[0].r).toEqual({ published: false, missing: [] });
    await actuarComo(c, cliente);
    expect((await intentar(c, "select id from public.workshops")).rows).toEqual([]);
  });

  test("un taller suspendido no se puede publicar", async () => {
    const uid = await artesanoConTallerCompleto();
    await c.query("update public.workshops set suspended = true where owner_id = $1", [uid]);
    await actuarComo(c, uid);
    const r = await intentar(c, "select public.publish_my_workshop()");
    expect(r.error?.message).toContain("forbidden");
  });

  test("sin taller: not_found", async () => {
    const uid = await usuarioConRol("craftsman");
    await actuarComo(c, uid);
    expect((await intentar(c, "select public.publish_my_workshop()")).error?.message).toContain("not_found");
    expect((await intentar(c, "select public.unpublish_my_workshop()")).error?.message).toContain("not_found");
  });

  test.each([
    ["cliente", "client"],
    ["admin", "admin"],
    ["usuario sin rol", null],
  ])("%s no puede publicar ni retirar talleres", async (_nombre, rol) => {
    const uid = await usuarioConRol(/** @type {any} */ (rol));
    await actuarComo(c, uid);
    expect((await intentar(c, "select public.publish_my_workshop()")).error?.message).toContain("forbidden");
    expect((await intentar(c, "select public.unpublish_my_workshop()")).error?.message).toContain("forbidden");
  });

  test("un artesano desactivado: inactive_user", async () => {
    const uid = await artesanoConTallerCompleto();
    await c.query("update public.profiles set active = false where id = $1", [uid]);
    await actuarComo(c, uid);
    expect((await intentar(c, "select public.publish_my_workshop()")).error?.message).toContain("inactive_user");
  });

  test("un artesano no publica el taller de otro", async () => {
    await artesanoConTallerCompleto();
    const otro = await usuarioConRol("craftsman");
    await actuarComo(c, otro);
    expect((await intentar(c, "select public.publish_my_workshop()")).error?.message).toContain("not_found");
  });

  test("anónimo no puede ejecutar las funciones", async () => {
    await actuarComo(c, null);
    expect((await intentar(c, "select public.publish_my_workshop()")).error?.code).toBe(PERMISO_DENEGADO);
    expect((await intentar(c, "select public.unpublish_my_workshop()")).error?.code).toBe(PERMISO_DENEGADO);
  });

  test("sin sesión válida (auth.uid() nulo): not_authenticated", async () => {
    await c.query("reset role");
    await c.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ role: "authenticated" })]);
    await c.query("set local role authenticated");
    expect((await intentar(c, "select public.publish_my_workshop()")).error?.message).toContain("not_authenticated");
  });

  test("grants: execute solo para authenticated", async () => {
    await c.query("reset role");
    const { rows } = await c.query(
      `select p.proname,
              has_function_privilege('authenticated', p.oid, 'execute') as auth,
              has_function_privilege('anon', p.oid, 'execute') as anon,
              exists (select 1 from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
                       where a.grantee = 0 and a.privilege_type = 'EXECUTE') as publico
         from pg_proc p join pg_namespace s on s.oid = p.pronamespace
        where s.nspname = 'public' and p.proname in ('publish_my_workshop', 'unpublish_my_workshop')`,
    );
    expect(rows).toHaveLength(2);
    for (const fila of rows) expect({ auth: fila.auth, anon: fila.anon, publico: fila.publico }).toEqual({ auth: true, anon: false, publico: false });
  });
});
