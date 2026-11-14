import {
  abrirTransaccion,
  actuarComo,
  actuarSinUsuario,
  asignarRol,
  cerrarTransaccion,
  crearUsuario,
  intentar,
} from "../helpers/db.js";

const PERMISO_DENEGADO = "42501";

/** CU-01: perfil sin rol, set_my_role de un solo uso y columna role protegida. */
describe("profiles y set_my_role", () => {
  /** @type {import("pg").Client} */
  let c;
  let n = 0;
  const correo = () => `perfil-${Date.now()}-${n++}@prueba.test`;

  beforeAll(async () => {
    c = await abrirTransaccion();
  });

  afterAll(async () => {
    await cerrarTransaccion(c);
  });

  describe("trigger de alta", () => {
    test("crea el perfil sin rol, sin nombre y activo", async () => {
      const uid = await crearUsuario(c, correo());
      const { rows } = await c.query("select role, full_name, active from public.profiles where id = $1", [uid]);
      expect(rows).toEqual([{ role: null, full_name: "", active: true }]);
    });

    test("ignora user_metadata: no toma rol ni nombre de ahí", async () => {
      const uid = await crearUsuario(c, correo(), { role: "admin", full_name: "Intruso", user_role: "admin" });
      const { rows } = await c.query("select role, full_name from public.profiles where id = $1", [uid]);
      expect(rows).toEqual([{ role: null, full_name: "" }]);
    });
  });

  describe("set_my_role", () => {
    test("sin rol puede elegir client", async () => {
      const uid = await crearUsuario(c, correo());
      await actuarComo(c, uid);
      const r = await intentar(c, "select public.set_my_role('client') as rol");
      expect(r.error).toBeNull();
      expect(r.rows[0].rol).toBe("client");
      const perfil = await intentar(c, "select role from public.profiles");
      expect(perfil.rows).toEqual([{ role: "client" }]);
    });

    test("sin rol puede elegir craftsman", async () => {
      const uid = await crearUsuario(c, correo());
      await actuarComo(c, uid);
      const r = await intentar(c, "select public.set_my_role('craftsman') as rol");
      expect(r.rows[0].rol).toBe("craftsman");
    });

    test("un segundo intento lanza role_already_set, incluso con otro rol", async () => {
      const uid = await crearUsuario(c, correo());
      await actuarComo(c, uid);
      await intentar(c, "select public.set_my_role('client')");
      const r = await intentar(c, "select public.set_my_role('craftsman')");
      expect(r.error?.message).toBe("role_already_set");
      const perfil = await intentar(c, "select role from public.profiles");
      expect(perfil.rows).toEqual([{ role: "client" }]);
    });

    test.each(["admin", "otro", "", "CLIENT"])("rechaza el valor %p con invalid_input", async (valor) => {
      const uid = await crearUsuario(c, correo());
      await actuarComo(c, uid);
      const r = await intentar(c, "select public.set_my_role($1)", [valor]);
      expect(r.error?.message).toBe("invalid_input");
      const perfil = await intentar(c, "select role from public.profiles");
      expect(perfil.rows).toEqual([{ role: null }]);
    });

    test("rechaza nulo con invalid_input", async () => {
      const uid = await crearUsuario(c, correo());
      await actuarComo(c, uid);
      const r = await intentar(c, "select public.set_my_role(null)");
      expect(r.error?.message).toBe("invalid_input");
    });

    test("un admin ya asignado no puede cambiar su rol (role_already_set)", async () => {
      const uid = await crearUsuario(c, correo());
      await asignarRol(c, uid, "admin");
      await actuarComo(c, uid);
      const r = await intentar(c, "select public.set_my_role('client')");
      expect(r.error?.message).toBe("role_already_set");
    });

    test("un usuario desactivado recibe inactive_user", async () => {
      const uid = await crearUsuario(c, correo());
      await c.query("reset role");
      await c.query("update public.profiles set active = false where id = $1", [uid]);
      await actuarComo(c, uid);
      const r = await intentar(c, "select public.set_my_role('client')");
      expect(r.error?.message).toBe("inactive_user");
    });

    test("autenticado sin sub recibe not_authenticated", async () => {
      await actuarSinUsuario(c);
      const r = await intentar(c, "select public.set_my_role('client')");
      expect(r.error?.message).toBe("not_authenticated");
    });

    test("anónimo no puede ejecutarla (permission denied)", async () => {
      await actuarComo(c, null);
      const r = await intentar(c, "select public.set_my_role('client')");
      expect(r.error?.code).toBe(PERMISO_DENEGADO);
    });
  });

  describe("columna role protegida y permisos por actor", () => {
    test("nadie con rol authenticated puede hacer UPDATE de role, ni en su propia fila", async () => {
      const uid = await crearUsuario(c, correo());
      await asignarRol(c, uid, "client");
      await actuarComo(c, uid);
      const r = await intentar(c, "update public.profiles set role = 'admin' where id = $1", [uid]);
      expect(r.error?.code).toBe(PERMISO_DENEGADO);
    });

    test("un usuario sin rol tampoco puede asignarse el rol con UPDATE", async () => {
      const uid = await crearUsuario(c, correo());
      await actuarComo(c, uid);
      const r = await intentar(c, "update public.profiles set role = 'admin' where id = $1", [uid]);
      expect(r.error?.code).toBe(PERMISO_DENEGADO);
    });

    test("no puede modificar active", async () => {
      const uid = await crearUsuario(c, correo());
      await asignarRol(c, uid, "craftsman");
      await actuarComo(c, uid);
      const r = await intentar(c, "update public.profiles set active = false where id = $1", [uid]);
      expect(r.error?.code).toBe(PERMISO_DENEGADO);
    });

    test("sin INSERT ni DELETE en profiles", async () => {
      const uid = await crearUsuario(c, correo());
      await asignarRol(c, uid, "client");
      await actuarComo(c, uid);
      const ins = await intentar(c, "insert into public.profiles (id) values (gen_random_uuid())");
      const del = await intentar(c, "delete from public.profiles where id = $1", [uid]);
      expect(ins.error?.code).toBe(PERMISO_DENEGADO);
      expect(del.error?.code).toBe(PERMISO_DENEGADO);
    });

    test.each(["client", "craftsman"])("un %s puede editar su nombre y foto", async (rol) => {
      const uid = await crearUsuario(c, correo());
      await asignarRol(c, uid, rol);
      await actuarComo(c, uid);
      const r = await intentar(
        c,
        "update public.profiles set full_name = 'Ana', avatar_path = 'x/y' where id = $1 returning full_name, avatar_path",
        [uid],
      );
      expect(r.error).toBeNull();
      expect(r.rows).toEqual([{ full_name: "Ana", avatar_path: "x/y" }]);
    });

    test("un usuario sin rol no modifica nada (0 filas)", async () => {
      const uid = await crearUsuario(c, correo());
      await actuarComo(c, uid);
      const r = await intentar(c, "update public.profiles set full_name = 'Ana' where id = $1", [uid]);
      expect(r.error).toBeNull();
      expect(r.rowCount).toBe(0);
    });

    test("un admin no edita perfiles por UPDATE directo (solo por funciones)", async () => {
      const uid = await crearUsuario(c, correo());
      await asignarRol(c, uid, "admin");
      await actuarComo(c, uid);
      const r = await intentar(c, "update public.profiles set full_name = 'Ana' where id = $1", [uid]);
      expect(r.rowCount).toBe(0);
    });

    test("un usuario desactivado no puede editar su perfil", async () => {
      const uid = await crearUsuario(c, correo());
      await asignarRol(c, uid, "client");
      await c.query("reset role");
      await c.query("update public.profiles set active = false where id = $1", [uid]);
      await actuarComo(c, uid);
      const r = await intentar(c, "update public.profiles set full_name = 'Ana' where id = $1", [uid]);
      expect(r.rowCount).toBe(0);
    });

    test("no puede editar el perfil de otro usuario", async () => {
      const a = await crearUsuario(c, correo());
      const b = await crearUsuario(c, correo());
      await asignarRol(c, a, "client");
      await asignarRol(c, b, "client");
      await actuarComo(c, a);
      const r = await intentar(c, "update public.profiles set full_name = 'Hack' where id = $1", [b]);
      expect(r.rowCount).toBe(0);
    });

    test("solo ve su propio perfil", async () => {
      const a = await crearUsuario(c, correo());
      await crearUsuario(c, correo());
      await actuarComo(c, a);
      const r = await intentar(c, "select id from public.profiles");
      expect(r.rows).toEqual([{ id: a }]);
    });

    test("anónimo no puede leer ni escribir profiles", async () => {
      await actuarComo(c, null);
      const sel = await intentar(c, "select id from public.profiles");
      const upd = await intentar(c, "update public.profiles set full_name = 'x'");
      expect(sel.error?.code).toBe(PERMISO_DENEGADO);
      expect(upd.error?.code).toBe(PERMISO_DENEGADO);
    });
  });
});
