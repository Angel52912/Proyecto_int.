import { abrirTransaccion, actuarComo, asignarRol, cerrarTransaccion, crearUsuario, intentar } from "../helpers/db.js";

const PERMISO_DENEGADO = "42501";
const UUID_A = "11111111-1111-4111-8111-111111111111";
const UUID_B = "22222222-2222-4222-8222-222222222222";

/** CU-07: fotos del taller (tabla y bucket público workshop-photos). */
describe("workshop_photos y Storage", () => {
  /** @type {import("pg").Client} */
  let c;
  let n = 0;
  const correo = () => `fotos-${Date.now()}-${n++}@prueba.test`;

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
   * @param {string} owner
   * @param {boolean} [published]
   * @returns {Promise<string>} id del taller
   */
  async function crearTaller(owner, published = false) {
    await c.query("reset role");
    const { rows } = await c.query(
      `insert into public.workshops (owner_id, name, address, colonia, lat, lng, services, hours, price_from, published)
       values ($1, 'Taller', 'Calle 60', 'Centro', 20.96, -89.59, '{repair}', '{"mon":[{"open":"09:00","close":"18:00"}]}', 100, $2) returning id`,
      [owner, published],
    );
    return rows[0].id;
  }

  /**
   * @param {string} taller
   * @param {"profile" | "work"} [kind]
   * @param {string} [uuid]
   */
  const insertarFoto = (taller, kind = "work", uuid = UUID_A) =>
    intentar(c, "insert into public.workshop_photos (workshop_id, path, kind) values ($1, $2, $3) returning id", [taller, `${taller}/${uuid}`, kind]);

  describe("tabla workshop_photos", () => {
    test("el dueño registra, lee y borra sus fotos", async () => {
      const uid = await usuarioConRol("craftsman");
      const taller = await crearTaller(uid);
      await actuarComo(c, uid);
      expect((await insertarFoto(taller)).rows).toHaveLength(1);
      expect((await intentar(c, "select id from public.workshop_photos")).rows).toHaveLength(1);
      const del = await intentar(c, "delete from public.workshop_photos where workshop_id = $1", [taller]);
      expect(del.rowCount).toBe(1);
    });

    test("otro artesano no registra, ve, edita ni borra fotos ajenas", async () => {
      const dueno = await usuarioConRol("craftsman");
      const otro = await usuarioConRol("craftsman");
      const taller = await crearTaller(dueno);
      await actuarComo(c, dueno);
      await insertarFoto(taller);
      await actuarComo(c, otro);
      expect((await insertarFoto(taller, "work", UUID_B)).error?.code).toBe(PERMISO_DENEGADO);
      expect((await intentar(c, "select id from public.workshop_photos")).rows).toEqual([]);
      expect((await intentar(c, "update public.workshop_photos set sort = 5")).rowCount).toBe(0);
      expect((await intentar(c, "delete from public.workshop_photos")).rowCount).toBe(0);
    });

    test("la ruta debe pertenecer al taller (CHECK)", async () => {
      const uid = await usuarioConRol("craftsman");
      const taller = await crearTaller(uid);
      const ajeno = await crearTaller(await usuarioConRol("craftsman"));
      await actuarComo(c, uid);
      const r = await intentar(c, "insert into public.workshop_photos (workshop_id, path) values ($1, $2)", [taller, `${ajeno}/${UUID_A}`]);
      const sinUuid = await intentar(c, "insert into public.workshop_photos (workshop_id, path) values ($1, $2)", [taller, `${taller}/foto.png`]);
      expect(r.error?.code).toBe("23514");
      expect(sinUuid.error?.code).toBe("23514");
    });

    test("solo una foto de perfil por taller", async () => {
      const uid = await usuarioConRol("craftsman");
      const taller = await crearTaller(uid);
      await actuarComo(c, uid);
      await insertarFoto(taller, "profile", UUID_A);
      expect((await insertarFoto(taller, "profile", UUID_B)).error?.code).toBe("23505");
    });

    test("máximo 10 fotos de trabajos: la 11 falla con limit_reached", async () => {
      const uid = await usuarioConRol("craftsman");
      const taller = await crearTaller(uid);
      await actuarComo(c, uid);
      for (let i = 0; i < 10; i++) {
        const uuid = `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`;
        expect((await insertarFoto(taller, "work", uuid)).error).toBeNull();
      }
      expect((await insertarFoto(taller, "work", UUID_B)).error?.message).toContain("limit_reached");
      // El perfil no cuenta para el límite de trabajos.
      expect((await insertarFoto(taller, "profile", UUID_A)).error).toBeNull();
    });

    test("el artesano solo puede cambiar sort", async () => {
      const uid = await usuarioConRol("craftsman");
      const taller = await crearTaller(uid);
      await actuarComo(c, uid);
      await insertarFoto(taller);
      expect((await intentar(c, "update public.workshop_photos set sort = 3")).rowCount).toBe(1);
      expect((await intentar(c, "update public.workshop_photos set path = path || 'x'")).error?.code).toBe(PERMISO_DENEGADO);
      expect((await intentar(c, "update public.workshop_photos set kind = 'profile'")).error?.code).toBe(PERMISO_DENEGADO);
    });

    test("el cliente ve las fotos de talleres publicados y no las de borradores; no escribe", async () => {
      const cliente = await usuarioConRol("client");
      const publicado = await crearTaller(await usuarioConRol("craftsman"), true);
      const borrador = await crearTaller(await usuarioConRol("craftsman"));
      await c.query("insert into public.workshop_photos (workshop_id, path) values ($1, $2), ($3, $4)", [
        publicado,
        `${publicado}/${UUID_A}`,
        borrador,
        `${borrador}/${UUID_A}`,
      ]);
      await actuarComo(c, cliente);
      const sel = await intentar(c, "select workshop_id from public.workshop_photos");
      expect(sel.rows).toEqual([{ workshop_id: publicado }]);
      expect((await insertarFoto(publicado, "work", UUID_B)).error?.code).toBe(PERMISO_DENEGADO);
      expect((await intentar(c, "delete from public.workshop_photos")).rowCount).toBe(0);
    });

    test.each([
      ["admin", "admin"],
      ["usuario sin rol", null],
    ])("%s no ve ni escribe fotos", async (_nombre, rol) => {
      const uid = await usuarioConRol(/** @type {any} */ (rol));
      const taller = await crearTaller(await usuarioConRol("craftsman"), true);
      await c.query("insert into public.workshop_photos (workshop_id, path) values ($1, $2)", [taller, `${taller}/${UUID_A}`]);
      await actuarComo(c, uid);
      expect((await intentar(c, "select * from public.workshop_photos")).rows).toEqual([]);
      expect((await insertarFoto(taller, "work", UUID_B)).error?.code).toBe(PERMISO_DENEGADO);
    });

    test("un artesano desactivado no registra fotos", async () => {
      const uid = await usuarioConRol("craftsman");
      const taller = await crearTaller(uid);
      await c.query("update public.profiles set active = false where id = $1", [uid]);
      await actuarComo(c, uid);
      expect((await insertarFoto(taller)).error?.code).toBe(PERMISO_DENEGADO);
    });

    test("anónimo no tiene acceso", async () => {
      await actuarComo(c, null);
      expect((await intentar(c, "select * from public.workshop_photos")).error?.code).toBe(PERMISO_DENEGADO);
    });
  });

  describe("bucket workshop-photos", () => {
    /** @param {string} ruta */
    const subir = (ruta) => intentar(c, "insert into storage.objects (bucket_id, name) values ('workshop-photos', $1) returning id", [ruta]);

    test("configuración: público, 5 MB y solo jpeg, png o webp", async () => {
      await c.query("reset role");
      const { rows } = await c.query("select public, file_size_limit, allowed_mime_types from storage.buckets where id = 'workshop-photos'");
      expect(rows).toEqual([{ public: true, file_size_limit: 5242880, allowed_mime_types: ["image/jpeg", "image/png", "image/webp"] }]);
    });

    test("el dueño sube y borra archivos en la carpeta de su taller", async () => {
      const uid = await usuarioConRol("craftsman");
      const taller = await crearTaller(uid);
      await actuarComo(c, uid);
      expect((await subir(`${taller}/${UUID_A}`)).error).toBeNull();
      const del = await intentar(c, "delete from storage.objects where bucket_id = 'workshop-photos' and name = $1", [`${taller}/${UUID_A}`]);
      expect(del.rowCount).toBe(1);
    });

    test("otro artesano no sube ni borra en la carpeta de un taller ajeno", async () => {
      const dueno = await usuarioConRol("craftsman");
      const otro = await usuarioConRol("craftsman");
      const taller = await crearTaller(dueno);
      await c.query("insert into storage.objects (bucket_id, name) values ('workshop-photos', $1)", [`${taller}/${UUID_A}`]);
      await actuarComo(c, otro);
      expect((await subir(`${taller}/${UUID_B}`)).error?.code).toBe(PERMISO_DENEGADO);
      const del = await intentar(c, "delete from storage.objects where bucket_id = 'workshop-photos'");
      expect(del.rowCount).toBe(0);
    });

    test.each([
      ["sin carpeta", "foto.png"],
      ["carpeta que no es uuid", "no-es-uuid/foto.png"],
      ["carpeta de un taller inexistente", `${UUID_B}/${UUID_A}`],
    ])("rutas inválidas se rechazan sin error de casteo: %s", async (_nombre, ruta) => {
      const uid = await usuarioConRol("craftsman");
      await crearTaller(uid);
      await actuarComo(c, uid);
      expect((await subir(ruta)).error?.code).toBe(PERMISO_DENEGADO);
    });

    test.each([
      ["cliente", "client"],
      ["admin", "admin"],
      ["usuario sin rol", null],
    ])("%s no sube archivos", async (_nombre, rol) => {
      const uid = await usuarioConRol(/** @type {any} */ (rol));
      const taller = await crearTaller(await usuarioConRol("craftsman"), true);
      await actuarComo(c, uid);
      expect((await subir(`${taller}/${UUID_A}`)).error?.code).toBe(PERMISO_DENEGADO);
    });

    test("un artesano desactivado no sube archivos", async () => {
      const uid = await usuarioConRol("craftsman");
      const taller = await crearTaller(uid);
      await c.query("update public.profiles set active = false where id = $1", [uid]);
      await actuarComo(c, uid);
      expect((await subir(`${taller}/${UUID_A}`)).error?.code).toBe(PERMISO_DENEGADO);
    });

    test("anónimo no sube archivos", async () => {
      const uid = await usuarioConRol("craftsman");
      const taller = await crearTaller(uid);
      await actuarComo(c, null);
      expect((await subir(`${taller}/${UUID_A}`)).error?.code).toBe(PERMISO_DENEGADO);
    });

    test("el bucket no tiene política de listado para authenticated ni anon", async () => {
      await c.query("reset role");
      const { rows } = await c.query(
        `select policyname from pg_policies
          where schemaname = 'storage' and tablename = 'objects' and cmd in ('SELECT', 'ALL')
            and qual ilike '%workshop-photos%'`,
      );
      expect(rows).toEqual([]);
    });
  });
});
