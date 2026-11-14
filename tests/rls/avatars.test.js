import { abrirTransaccion, actuarComo, asignarRol, cerrarTransaccion, crearUsuario, intentar } from "../helpers/db.js";
import { PERMISO_DENEGADO, UUID_A, UUID_B, crearSolicitud, crearTallerPublicado } from "../helpers/solicitudes.js";

/** CU-01: bucket privado avatars y la restricción de profiles.avatar_path (migración 0017). */
describe("fotos de perfil (bucket avatars)", () => {
  /** @type {import("pg").Client} */
  let c;
  let n = 0;
  const correo = () => `avatar-${Date.now()}-${n++}@prueba.test`;
  const UUID_C = "33333333-3333-4333-8333-333333333333";
  const UUID_D = "44444444-4444-4444-8444-444444444444";

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

  const subir = (/** @type {string} */ ruta) => intentar(c, "insert into storage.objects (bucket_id, name) values ('avatars', $1) returning id", [ruta]);
  const leer = (/** @type {string} */ ruta) => intentar(c, "select id from storage.objects where bucket_id = 'avatars' and name = $1", [ruta]);
  const borrar = (/** @type {string} */ ruta) => intentar(c, "delete from storage.objects where bucket_id = 'avatars' and name = $1", [ruta]);
  /** Inserta un archivo como superusuario. */
  async function existente(/** @type {string} */ ruta) {
    await c.query("reset role");
    await c.query("insert into storage.objects (bucket_id, name) values ('avatars', $1)", [ruta]);
  }

  /** Cliente y artesano con una solicitud en el estado indicado. */
  async function conSolicitud(status = "open") {
    const cliente = await usuarioConRol("client");
    const artesano = await usuarioConRol("craftsman");
    const taller = await crearTallerPublicado(c, artesano);
    await crearSolicitud(c, cliente, taller, /** @type {any} */ (status));
    return { cliente, artesano };
  }

  describe("configuración", () => {
    test("bucket privado, 5 MB y solo jpeg, png o webp", async () => {
      await c.query("reset role");
      const { rows } = await c.query("select public, file_size_limit, allowed_mime_types from storage.buckets where id = 'avatars'");
      expect(rows).toEqual([{ public: false, file_size_limit: 5242880, allowed_mime_types: ["image/jpeg", "image/png", "image/webp"] }]);
    });
  });

  describe("subir", () => {
    test.each(["client", "craftsman"])("un %s activo sube en su propia carpeta", async (rol) => {
      const uid = await usuarioConRol(/** @type {any} */ (rol));
      await actuarComo(c, uid);
      expect((await subir(`${uid}/${UUID_A}`)).error).toBeNull();
    });

    test("usuario sin rol, admin y anónimo no suben ni en su carpeta", async () => {
      for (const rol of [null, "admin"]) {
        const uid = await usuarioConRol(/** @type {any} */ (rol));
        await actuarComo(c, uid);
        expect((await subir(`${uid}/${UUID_A}`)).error?.code).toBe(PERMISO_DENEGADO);
      }
      await actuarComo(c, null);
      expect((await subir(`${UUID_C}/${UUID_A}`)).error?.code).toBe(PERMISO_DENEGADO);
    });

    test("un usuario desactivado no sube", async () => {
      const uid = await usuarioConRol("client");
      await c.query("update public.profiles set active = false where id = $1", [uid]);
      await actuarComo(c, uid);
      expect((await subir(`${uid}/${UUID_A}`)).error?.code).toBe(PERMISO_DENEGADO);
    });

    test("no sube en la carpeta de otro usuario, en una carpeta que no es un uid ni en la raíz", async () => {
      const uid = await usuarioConRol("client");
      const otro = await usuarioConRol("craftsman");
      await actuarComo(c, uid);
      expect((await subir(`${otro}/${UUID_A}`)).error?.code).toBe(PERMISO_DENEGADO);
      expect((await subir(`no-es-uid/${UUID_A}`)).error?.code).toBe(PERMISO_DENEGADO);
      expect((await subir(UUID_A)).error?.code).toBe(PERMISO_DENEGADO);
    });

    test("máximo 3 archivos por usuario", async () => {
      const uid = await usuarioConRol("client");
      await existente(`${uid}/${UUID_A}`);
      await existente(`${uid}/${UUID_B}`);
      await actuarComo(c, uid);
      expect((await subir(`${uid}/${UUID_C}`)).error).toBeNull(); // el tercero entra
      expect((await subir(`${uid}/${UUID_D}`)).error?.code).toBe(PERMISO_DENEGADO); // el cuarto no
      expect((await borrar(`${uid}/${UUID_A}`)).rowCount).toBe(1);
      expect((await subir(`${uid}/${UUID_D}`)).error).toBeNull(); // al borrar uno vuelve a haber lugar
    });

    test("el tope de 3 es por usuario: los archivos de otros no cuentan", async () => {
      const uid = await usuarioConRol("client");
      const otro = await usuarioConRol("client");
      for (const u of [UUID_A, UUID_B, UUID_C]) await existente(`${otro}/${u}`);
      await actuarComo(c, uid);
      expect((await subir(`${uid}/${UUID_A}`)).error).toBeNull();
    });
  });

  describe("ver", () => {
    test("el propio usuario ve su foto", async () => {
      const uid = await usuarioConRol("client");
      await existente(`${uid}/${UUID_A}`);
      await actuarComo(c, uid);
      expect((await leer(`${uid}/${UUID_A}`)).rows).toHaveLength(1);
    });

    test("la contraparte con la que comparte una solicitud (no borrador) ve la foto, en ambos sentidos", async () => {
      const { cliente, artesano } = await conSolicitud("open");
      await existente(`${cliente}/${UUID_A}`);
      await existente(`${artesano}/${UUID_B}`);
      await actuarComo(c, artesano);
      expect((await leer(`${cliente}/${UUID_A}`)).rows).toHaveLength(1);
      await actuarComo(c, cliente);
      expect((await leer(`${artesano}/${UUID_B}`)).rows).toHaveLength(1);
    });

    test("con la solicitud en borrador el artesano no ve la foto del cliente", async () => {
      const { cliente, artesano } = await conSolicitud("draft");
      await existente(`${cliente}/${UUID_A}`);
      await actuarComo(c, artesano);
      expect((await leer(`${cliente}/${UUID_A}`)).rows).toEqual([]);
    });

    test("usuarios sin relación, admin, usuario sin rol y desactivados no ven la foto; anónimo: permission denied", async () => {
      const { cliente } = await conSolicitud("open");
      await existente(`${cliente}/${UUID_A}`);
      const inactivo = await usuarioConRol("client");
      await c.query("update public.profiles set active = false where id = $1", [inactivo]);
      for (const uid of [await usuarioConRol("client"), await usuarioConRol("craftsman"), await usuarioConRol("admin"), await usuarioConRol(null), inactivo]) {
        await actuarComo(c, uid);
        expect((await leer(`${cliente}/${UUID_A}`)).rows).toEqual([]);
      }
      await actuarComo(c, null);
      expect((await leer(`${cliente}/${UUID_A}`)).error?.code).toBe(PERMISO_DENEGADO);
    });

    test("una carpeta que no es un uid válido no rompe la política (no se ve y no hay error)", async () => {
      const uid = await usuarioConRol("client");
      await existente(`carpeta-rara/${UUID_A}`);
      await actuarComo(c, uid);
      const r = await leer(`carpeta-rara/${UUID_A}`);
      expect(r.error).toBeNull();
      expect(r.rows).toEqual([]);
    });
  });

  describe("borrar", () => {
    test("el usuario borra solo sus propios archivos", async () => {
      const { cliente, artesano } = await conSolicitud("open");
      await existente(`${cliente}/${UUID_A}`);
      await actuarComo(c, artesano);
      expect((await borrar(`${cliente}/${UUID_A}`)).rowCount).toBe(0); // la contraparte la ve, pero no la borra
      await actuarComo(c, cliente);
      expect((await borrar(`${cliente}/${UUID_A}`)).rowCount).toBe(1);
    });

    test("admin, usuario sin rol y desactivado no borran; anónimo: permission denied", async () => {
      for (const rol of [null, "admin"]) {
        const uid = await usuarioConRol(/** @type {any} */ (rol));
        await existente(`${uid}/${UUID_A}`);
        await actuarComo(c, uid);
        expect((await borrar(`${uid}/${UUID_A}`)).rowCount).toBe(0);
      }
      const inactivo = await usuarioConRol("client");
      await existente(`${inactivo}/${UUID_A}`);
      await c.query("update public.profiles set active = false where id = $1", [inactivo]);
      await actuarComo(c, inactivo);
      expect((await borrar(`${inactivo}/${UUID_A}`)).rowCount).toBe(0);
      await actuarComo(c, null);
      expect((await borrar(`${inactivo}/${UUID_A}`)).error?.code).toBe(PERMISO_DENEGADO);
    });
  });

  describe("profiles.avatar_path", () => {
    const guardar = (/** @type {string} */ uid, /** @type {string | null} */ ruta) =>
      intentar(c, "update public.profiles set avatar_path = $2 where id = $1 returning avatar_path", [uid, ruta]);

    test("acepta {su_uid}/{uuid} y null", async () => {
      const uid = await usuarioConRol("client");
      await actuarComo(c, uid);
      expect((await guardar(uid, `${uid}/${UUID_A}`)).rows).toEqual([{ avatar_path: `${uid}/${UUID_A}` }]);
      expect((await guardar(uid, null)).rows).toEqual([{ avatar_path: null }]);
    });

    test("rechaza la ruta de otro usuario, rutas arbitrarias y mayúsculas (23514), también como superusuario", async () => {
      const uid = await usuarioConRol("client");
      const otro = await usuarioConRol("craftsman");
      await actuarComo(c, uid);
      for (const mala of [`${otro}/${UUID_A}`, "x/y", `${uid}/`, `${uid}/ABCDEFAB-CDEF-4DEF-8DEF-ABCDEFABCDEF`, `${uid}/${UUID_A}/extra`, "../etc"]) {
        expect((await guardar(uid, mala)).error?.code).toBe("23514");
      }
      await c.query("reset role");
      expect((await guardar(uid, "x/y")).error?.code).toBe("23514");
    });
  });
});
