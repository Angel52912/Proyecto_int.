import { abrirTransaccion, actuarComo, cerrarTransaccion, crearUsuario, intentar } from "../helpers/db.js";

/** Verifica los grants del esquema private (D2, sección 5 de 0001-arquitectura.md). */
describe("grants del esquema private", () => {
  /** @type {import("pg").Client} */
  let c;

  beforeAll(async () => {
    c = await abrirTransaccion();
  });

  afterAll(async () => {
    await cerrarTransaccion(c);
  });

  test("authenticated tiene USAGE en private y anon no", async () => {
    await c.query("reset role");
    const { rows } = await c.query(
      "select has_schema_privilege('authenticated','private','usage') as auth, has_schema_privilege('anon','private','usage') as anon",
    );
    expect(rows[0]).toEqual({ auth: true, anon: false });
  });

  test("public no tiene USAGE en private", async () => {
    await c.query("reset role");
    const { rows } = await c.query(
      `select exists (
         select 1 from pg_namespace n, aclexplode(coalesce(n.nspacl, acldefault('n', n.nspowner))) a
         where n.nspname = 'private' and a.grantee = 0 and a.privilege_type = 'USAGE'
       ) as publico`,
    );
    expect(rows[0].publico).toBe(false);
  });

  test("cada función de private: EXECUTE para authenticated y no para anon ni public", async () => {
    await c.query("reset role");
    const { rows } = await c.query(
      `select p.oid::regprocedure::text as funcion,
              has_function_privilege('authenticated', p.oid, 'execute') as auth,
              has_function_privilege('anon', p.oid, 'execute') as anon,
              exists (
                select 1 from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
                where a.grantee = 0 and a.privilege_type = 'EXECUTE'
              ) as publico
         from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'private'`,
    );
    expect(rows.length).toBeGreaterThan(0);
    for (const fila of rows) {
      expect({ funcion: fila.funcion, auth: fila.auth, anon: fila.anon, publico: fila.publico }).toEqual({
        funcion: fila.funcion,
        auth: true,
        anon: false,
        publico: false,
      });
    }
  });

  test("cada función expuesta en public: sin EXECUTE para public ni anon", async () => {
    await c.query("reset role");
    const { rows } = await c.query(
      `select p.oid::regprocedure::text as funcion,
              has_function_privilege('authenticated', p.oid, 'execute') as auth,
              has_function_privilege('anon', p.oid, 'execute') as anon,
              exists (
                select 1 from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
                where a.grantee = 0 and a.privilege_type = 'EXECUTE'
              ) as publico
         from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.prokind = 'f'`,
    );
    expect(rows.length).toBeGreaterThan(0);
    for (const fila of rows) {
      expect({ funcion: fila.funcion, auth: fila.auth, anon: fila.anon, publico: fila.publico }).toEqual({
        funcion: fila.funcion,
        auth: true,
        anon: false,
        publico: false,
      });
    }
  });

  test("anon no puede ejecutar ningún helper de private", async () => {
    await actuarComo(c, null);
    const r = await intentar(c, "select private.is_admin()");
    expect(r.error?.code).toBe("42501");
  });

  test("un usuario autenticado lee su propio perfil (la política y los helpers evalúan sin error)", async () => {
    const uid = await crearUsuario(c, `grants-${Date.now()}@prueba.test`);
    await actuarComo(c, uid);
    const r = await intentar(c, "select id, role from public.profiles");
    expect(r.error).toBeNull();
    expect(r.rows).toEqual([{ id: uid, role: null }]);
  });

  test("los helpers responden para el usuario autenticado sin lanzar permission denied", async () => {
    const uid = await crearUsuario(c, `helpers-${Date.now()}@prueba.test`);
    await actuarComo(c, uid);
    const r = await intentar(c, "select private.is_active() as activo, private.is_admin() as admin, private.current_user_role() as rol");
    expect(r.error).toBeNull();
    expect(r.rows[0]).toEqual({ activo: true, admin: false, rol: null });
  });
});
