import { abrirTransaccion, actuarComo, asignarRol, cerrarTransaccion, crearUsuario, intentar } from "../helpers/db.js";
import { PERMISO_DENEGADO, UUID_A, UUID_B, agregarFoto, crearSolicitud, crearTallerPublicado } from "../helpers/solicitudes.js";

/** CU-03: fotos de la solicitud (tabla request_photos y bucket privado request-photos). */
describe("request_photos y Storage", () => {
  /** @type {import("pg").Client} */
  let c;
  let n = 0;
  const correo = () => `fotos-sol-${Date.now()}-${n++}@prueba.test`;

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
   * Escenario base: cliente, artesano dueño y una solicitud con el estado indicado.
   * @param {"draft" | "open" | "quoted" | "accepted" | "declined" | "cancelled"} [status]
   */
  async function escenario(status = "draft") {
    const cliente = await usuarioConRol("client");
    const artesano = await usuarioConRol("craftsman");
    const taller = await crearTallerPublicado(c, artesano);
    const solicitud = await crearSolicitud(c, cliente, taller, status);
    return { cliente, artesano, solicitud };
  }

  /**
   * @param {string} solicitud
   * @param {string} [uuid]
   */
  const insertarFoto = (solicitud, uuid = UUID_A) =>
    intentar(c, "insert into public.request_photos (request_id, path) values ($1, $2) returning id", [solicitud, `${solicitud}/${uuid}`]);

  describe("tabla request_photos", () => {
    test("el cliente registra, lee y borra fotos de su borrador", async () => {
      const { cliente, solicitud } = await escenario("draft");
      await actuarComo(c, cliente);
      expect((await insertarFoto(solicitud)).error).toBeNull();
      expect((await intentar(c, "select id from public.request_photos")).rows).toHaveLength(1);
      expect((await intentar(c, "delete from public.request_photos where request_id = $1", [solicitud])).rowCount).toBe(1);
    });

    test("máximo 5 fotos por solicitud: la sexta falla con limit_reached", async () => {
      const { cliente, solicitud } = await escenario("draft");
      await actuarComo(c, cliente);
      for (let i = 0; i < 5; i++) {
        const uuid = `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`;
        expect((await insertarFoto(solicitud, uuid)).error).toBeNull();
      }
      expect((await insertarFoto(solicitud, UUID_B)).error?.message).toContain("limit_reached");
    });

    test("la ruta debe pertenecer a la solicitud (CHECK)", async () => {
      const { cliente, solicitud } = await escenario("draft");
      const ajena = (await escenario("draft")).solicitud;
      await actuarComo(c, cliente);
      const deOtra = await intentar(c, "insert into public.request_photos (request_id, path) values ($1, $2)", [solicitud, `${ajena}/${UUID_A}`]);
      const sinUuid = await intentar(c, "insert into public.request_photos (request_id, path) values ($1, $2)", [solicitud, `${solicitud}/foto.png`]);
      expect(deOtra.error?.code).toBe("23514");
      expect(sinUuid.error?.code).toBe("23514");
    });

    test.each(["open", "quoted", "accepted", "declined", "cancelled"])("con la solicitud en %s el cliente ya no agrega ni borra fotos", async (status) => {
      const { cliente, solicitud } = await escenario(/** @type {any} */ (status));
      await agregarFoto(c, solicitud);
      await actuarComo(c, cliente);
      expect((await insertarFoto(solicitud, UUID_B)).error?.code).toBe(PERMISO_DENEGADO);
      expect((await intentar(c, "delete from public.request_photos")).rowCount).toBe(0);
      expect((await intentar(c, "select id from public.request_photos")).rows).toHaveLength(1);
    });

    test("otro cliente no registra, ve ni borra fotos ajenas", async () => {
      const { solicitud } = await escenario("draft");
      await agregarFoto(c, solicitud);
      const intruso = await usuarioConRol("client");
      await actuarComo(c, intruso);
      expect((await insertarFoto(solicitud, UUID_B)).error?.code).toBe(PERMISO_DENEGADO);
      expect((await intentar(c, "select id from public.request_photos")).rows).toEqual([]);
      expect((await intentar(c, "delete from public.request_photos")).rowCount).toBe(0);
    });

    test("el artesano dueño ve las fotos si la solicitud no es borrador, y nunca escribe", async () => {
      const abierta = await escenario("open");
      await agregarFoto(c, abierta.solicitud);
      const borrador = await escenario("draft");
      await agregarFoto(c, borrador.solicitud);
      await actuarComo(c, abierta.artesano);
      expect((await intentar(c, "select id from public.request_photos")).rows).toHaveLength(1);
      expect((await insertarFoto(abierta.solicitud, UUID_B)).error?.code).toBe(PERMISO_DENEGADO);
      expect((await intentar(c, "delete from public.request_photos")).rowCount).toBe(0);
      await actuarComo(c, borrador.artesano);
      expect((await intentar(c, "select id from public.request_photos")).rows).toEqual([]);
    });

    test("un artesano ajeno no ve las fotos", async () => {
      const { solicitud } = await escenario("open");
      await agregarFoto(c, solicitud);
      const otro = await usuarioConRol("craftsman");
      await crearTallerPublicado(c, otro);
      await actuarComo(c, otro);
      expect((await intentar(c, "select id from public.request_photos")).rows).toEqual([]);
    });

    test.each([
      ["admin", "admin"],
      ["usuario sin rol", null],
    ])("%s no ve ni escribe fotos", async (_nombre, rol) => {
      const { solicitud } = await escenario("draft");
      await agregarFoto(c, solicitud);
      const uid = await usuarioConRol(/** @type {any} */ (rol));
      await actuarComo(c, uid);
      expect((await intentar(c, "select id from public.request_photos")).rows).toEqual([]);
      expect((await insertarFoto(solicitud, UUID_B)).error?.code).toBe(PERMISO_DENEGADO);
    });

    test("el cliente solo puede insertar request_id y path (no UPDATE)", async () => {
      const { cliente, solicitud } = await escenario("draft");
      await agregarFoto(c, solicitud);
      await actuarComo(c, cliente);
      expect((await intentar(c, "update public.request_photos set path = path || 'x'")).error?.code).toBe(PERMISO_DENEGADO);
    });

    test("un cliente desactivado no registra fotos", async () => {
      const { cliente, solicitud } = await escenario("draft");
      await c.query("update public.profiles set active = false where id = $1", [cliente]);
      await actuarComo(c, cliente);
      expect((await insertarFoto(solicitud)).error?.code).toBe(PERMISO_DENEGADO);
    });

    test("anónimo no tiene acceso", async () => {
      await actuarComo(c, null);
      expect((await intentar(c, "select * from public.request_photos")).error?.code).toBe(PERMISO_DENEGADO);
    });
  });

  describe("bucket request-photos", () => {
    /** @param {string} ruta */
    const subir = (ruta) => intentar(c, "insert into storage.objects (bucket_id, name) values ('request-photos', $1) returning id", [ruta]);
    /** @param {string} ruta */
    const leer = (ruta) => intentar(c, "select id from storage.objects where bucket_id = 'request-photos' and name = $1", [ruta]);

    test("configuración: privado, 5 MB y solo jpeg, png o webp", async () => {
      await c.query("reset role");
      const { rows } = await c.query("select public, file_size_limit, allowed_mime_types from storage.buckets where id = 'request-photos'");
      expect(rows).toEqual([{ public: false, file_size_limit: 5242880, allowed_mime_types: ["image/jpeg", "image/png", "image/webp"] }]);
    });

    test("el cliente sube y borra archivos de su borrador", async () => {
      const { cliente, solicitud } = await escenario("draft");
      await actuarComo(c, cliente);
      expect((await subir(`${solicitud}/${UUID_A}`)).error).toBeNull();
      const del = await intentar(c, "delete from storage.objects where bucket_id = 'request-photos' and name = $1", [`${solicitud}/${UUID_A}`]);
      expect(del.rowCount).toBe(1);
    });

    test("con la solicitud ya enviada el cliente no sube ni borra", async () => {
      const { cliente, solicitud } = await escenario("open");
      await c.query("insert into storage.objects (bucket_id, name) values ('request-photos', $1)", [`${solicitud}/${UUID_A}`]);
      await actuarComo(c, cliente);
      expect((await subir(`${solicitud}/${UUID_B}`)).error?.code).toBe(PERMISO_DENEGADO);
      const del = await intentar(c, "delete from storage.objects where bucket_id = 'request-photos'");
      expect(del.rowCount).toBe(0);
    });

    test("otro cliente no sube en la carpeta de una solicitud ajena", async () => {
      const { solicitud } = await escenario("draft");
      const intruso = await usuarioConRol("client");
      await actuarComo(c, intruso);
      expect((await subir(`${solicitud}/${UUID_A}`)).error?.code).toBe(PERMISO_DENEGADO);
    });

    test("cliente y artesano dueño leen los archivos; los demás no", async () => {
      const { cliente, artesano, solicitud } = await escenario("open");
      const ruta = `${solicitud}/${UUID_A}`;
      await c.query("insert into storage.objects (bucket_id, name) values ('request-photos', $1)", [ruta]);
      const otroCliente = await usuarioConRol("client");
      const otroArtesano = await usuarioConRol("craftsman");
      const admin = await usuarioConRol("admin");
      const sinRol = await usuarioConRol(null);
      for (const uid of [cliente, artesano]) {
        await actuarComo(c, uid);
        expect((await leer(ruta)).rows).toHaveLength(1);
      }
      for (const uid of [otroCliente, otroArtesano, admin, sinRol]) {
        await actuarComo(c, uid);
        expect((await leer(ruta)).rows).toEqual([]);
      }
      await actuarComo(c, null);
      expect((await leer(ruta)).error?.code).toBe(PERMISO_DENEGADO);
    });

    test("el artesano no ve los archivos de un borrador", async () => {
      const { artesano, solicitud } = await escenario("draft");
      const ruta = `${solicitud}/${UUID_A}`;
      await c.query("insert into storage.objects (bucket_id, name) values ('request-photos', $1)", [ruta]);
      await actuarComo(c, artesano);
      expect((await leer(ruta)).rows).toEqual([]);
    });

    test("el artesano nunca sube ni borra", async () => {
      const { artesano, solicitud } = await escenario("draft");
      await actuarComo(c, artesano);
      expect((await subir(`${solicitud}/${UUID_A}`)).error?.code).toBe(PERMISO_DENEGADO);
    });

    test.each([
      ["sin carpeta", "foto.png"],
      ["carpeta que no es uuid", "no-es-uuid/foto.png"],
      ["carpeta de una solicitud inexistente", `${UUID_B}/${UUID_A}`],
    ])("rutas inválidas se rechazan sin error de casteo: %s", async (_nombre, ruta) => {
      const { cliente } = await escenario("draft");
      await actuarComo(c, cliente);
      expect((await subir(ruta)).error?.code).toBe(PERMISO_DENEGADO);
    });

    test.each([
      ["admin", "admin"],
      ["usuario sin rol", null],
    ])("%s no sube archivos", async (_nombre, rol) => {
      const { solicitud } = await escenario("draft");
      const uid = await usuarioConRol(/** @type {any} */ (rol));
      await actuarComo(c, uid);
      expect((await subir(`${solicitud}/${UUID_A}`)).error?.code).toBe(PERMISO_DENEGADO);
    });

    test("un cliente desactivado no sube archivos y anónimo tampoco", async () => {
      const { cliente, solicitud } = await escenario("draft");
      await c.query("update public.profiles set active = false where id = $1", [cliente]);
      await actuarComo(c, cliente);
      expect((await subir(`${solicitud}/${UUID_A}`)).error?.code).toBe(PERMISO_DENEGADO);
      await actuarComo(c, null);
      expect((await subir(`${solicitud}/${UUID_A}`)).error?.code).toBe(PERMISO_DENEGADO);
    });
  });
});
