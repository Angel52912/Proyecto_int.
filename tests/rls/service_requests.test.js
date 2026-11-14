import { abrirTransaccion, actuarComo, asignarRol, cerrarTransaccion, crearUsuario, intentar } from "../helpers/db.js";
import { PERMISO_DENEGADO, crearSolicitud, crearTallerPublicado } from "../helpers/solicitudes.js";

/** CU-03: permisos de service_requests por rol y visibilidad de la contraparte en profiles. */
describe("service_requests", () => {
  /** @type {import("pg").Client} */
  let c;
  let n = 0;
  const correo = () => `solicitudes-${Date.now()}-${n++}@prueba.test`;

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
   * @param {string} taller
   * @param {string} [servicio]
   * @param {string} [descripcion]
   */
  const insertar = (taller, servicio = "repair", descripcion = "Suela despegada") =>
    intentar(
      c,
      "insert into public.service_requests (workshop_id, service_type, description) values ($1, $2, $3) returning id, client_id, status",
      [taller, servicio, descripcion],
    );

  describe("INSERT", () => {
    test("el cliente crea un borrador propio (client_id sale de auth.uid())", async () => {
      const cliente = await usuarioConRol("client");
      const taller = await crearTallerPublicado(c, await usuarioConRol("craftsman"));
      await actuarComo(c, cliente);
      const r = await insertar(taller);
      expect(r.error).toBeNull();
      expect(r.rows[0]).toMatchObject({ client_id: cliente, status: "draft" });
    });

    test("no puede elegir el estado, el dueño ni las marcas de envío", async () => {
      const cliente = await usuarioConRol("client");
      const otro = await usuarioConRol("client");
      const taller = await crearTallerPublicado(c, await usuarioConRol("craftsman"));
      await actuarComo(c, cliente);
      const porEstado = await intentar(c, "insert into public.service_requests (workshop_id, service_type, description, status) values ($1, 'repair', 'x', 'open')", [taller]);
      const porDueno = await intentar(c, "insert into public.service_requests (client_id, workshop_id, service_type, description) values ($1, $2, 'repair', 'x')", [otro, taller]);
      const porFecha = await intentar(c, "insert into public.service_requests (workshop_id, service_type, description, submitted_at) values ($1, 'repair', 'x', now())", [taller]);
      expect(porEstado.error?.code).toBe(PERMISO_DENEGADO);
      expect(porDueno.error?.code).toBe(PERMISO_DENEGADO);
      expect(porFecha.error?.code).toBe(PERMISO_DENEGADO);
    });

    test("taller sin publicar, suspendido, inexistente o sin ese servicio: denegado", async () => {
      const cliente = await usuarioConRol("client");
      const borrador = await crearTallerPublicado(c, await usuarioConRol("craftsman"), { published: false });
      const suspendido = await crearTallerPublicado(c, await usuarioConRol("craftsman"), { suspended: true });
      const soloLimpieza = await crearTallerPublicado(c, await usuarioConRol("craftsman"), { services: "{cleaning}" });
      await actuarComo(c, cliente);
      expect((await insertar(borrador)).error?.code).toBe(PERMISO_DENEGADO);
      expect((await insertar(suspendido)).error?.code).toBe(PERMISO_DENEGADO);
      expect((await insertar(soloLimpieza, "repair")).error?.code).toBe(PERMISO_DENEGADO);
      expect((await insertar("33333333-3333-4333-8333-333333333333")).error?.code).toBe(PERMISO_DENEGADO);
      expect((await insertar(soloLimpieza, "cleaning")).error).toBeNull();
    });

    test("descripción vacía o de más de 1000 caracteres viola el CHECK", async () => {
      const cliente = await usuarioConRol("client");
      const taller = await crearTallerPublicado(c, await usuarioConRol("craftsman"));
      await actuarComo(c, cliente);
      expect((await insertar(taller, "repair", "")).error?.code).toBe("23514");
      expect((await insertar(taller, "repair", "x".repeat(1001))).error?.code).toBe("23514");
    });

    test("solo una solicitud viva por cliente y taller; cancelada libera el cupo", async () => {
      const cliente = await usuarioConRol("client");
      const taller = await crearTallerPublicado(c, await usuarioConRol("craftsman"));
      await actuarComo(c, cliente);
      expect((await insertar(taller)).error).toBeNull();
      expect((await insertar(taller)).error?.code).toBe("23505");
      await c.query("reset role");
      await c.query("update public.service_requests set status = 'cancelled' where client_id = $1", [cliente]);
      await actuarComo(c, cliente);
      expect((await insertar(taller)).error).toBeNull();
    });

    test.each([
      ["artesano", "craftsman"],
      ["admin", "admin"],
      ["usuario sin rol", null],
    ])("%s no crea solicitudes", async (_nombre, rol) => {
      const uid = await usuarioConRol(/** @type {any} */ (rol));
      const taller = await crearTallerPublicado(c, await usuarioConRol("craftsman"));
      await actuarComo(c, uid);
      expect((await insertar(taller)).error?.code).toBe(PERMISO_DENEGADO);
    });

    test("un cliente desactivado no crea solicitudes", async () => {
      const cliente = await usuarioConRol("client");
      const taller = await crearTallerPublicado(c, await usuarioConRol("craftsman"));
      await c.query("update public.profiles set active = false where id = $1", [cliente]);
      await actuarComo(c, cliente);
      expect((await insertar(taller)).error?.code).toBe(PERMISO_DENEGADO);
    });

    test("anónimo no tiene acceso", async () => {
      await actuarComo(c, null);
      expect((await intentar(c, "select * from public.service_requests")).error?.code).toBe(PERMISO_DENEGADO);
      expect((await insertar("33333333-3333-4333-8333-333333333333")).error?.code).toBe(PERMISO_DENEGADO);
    });
  });

  describe("SELECT", () => {
    test("el cliente ve solo las suyas, también en borrador", async () => {
      const cliente = await usuarioConRol("client");
      const otro = await usuarioConRol("client");
      const taller = await crearTallerPublicado(c, await usuarioConRol("craftsman"));
      const mia = await crearSolicitud(c, cliente, taller, "draft");
      await crearSolicitud(c, otro, taller, "open");
      await actuarComo(c, cliente);
      expect((await intentar(c, "select id from public.service_requests")).rows).toEqual([{ id: mia }]);
    });

    test("el artesano ve las de su taller, excepto borradores; no las de otro taller", async () => {
      const cliente = await usuarioConRol("client");
      const dueno = await usuarioConRol("craftsman");
      const otroDueno = await usuarioConRol("craftsman");
      const taller = await crearTallerPublicado(c, dueno);
      const ajeno = await crearTallerPublicado(c, otroDueno);
      const otroCliente = await usuarioConRol("client");
      const abierta = await crearSolicitud(c, cliente, taller, "open");
      await crearSolicitud(c, otroCliente, taller, "draft");
      await crearSolicitud(c, cliente, ajeno, "open");
      await actuarComo(c, dueno);
      expect((await intentar(c, "select id from public.service_requests")).rows).toEqual([{ id: abierta }]);
    });

    test("el artesano suspendido o con el taller sin publicar sigue viendo sus solicitudes", async () => {
      const cliente = await usuarioConRol("client");
      const dueno = await usuarioConRol("craftsman");
      const taller = await crearTallerPublicado(c, dueno);
      await crearSolicitud(c, cliente, taller, "open");
      await c.query("update public.workshops set suspended = true where id = $1", [taller]);
      await actuarComo(c, dueno);
      expect((await intentar(c, "select id from public.service_requests")).rows).toHaveLength(1);
    });

    test.each([
      ["admin", "admin"],
      ["usuario sin rol", null],
    ])("%s no ve solicitudes", async (_nombre, rol) => {
      const uid = await usuarioConRol(/** @type {any} */ (rol));
      const taller = await crearTallerPublicado(c, await usuarioConRol("craftsman"));
      await crearSolicitud(c, await usuarioConRol("client"), taller, "open");
      await actuarComo(c, uid);
      expect((await intentar(c, "select id from public.service_requests")).rows).toEqual([]);
    });
  });

  describe("UPDATE y DELETE", () => {
    test("el cliente edita la descripción solo mientras es borrador", async () => {
      const cliente = await usuarioConRol("client");
      const taller = await crearTallerPublicado(c, await usuarioConRol("craftsman"));
      const borrador = await crearSolicitud(c, cliente, taller, "draft");
      await actuarComo(c, cliente);
      expect((await intentar(c, "update public.service_requests set description = 'Nueva' where id = $1", [borrador])).rowCount).toBe(1);
      await c.query("reset role");
      await c.query("update public.service_requests set status = 'open' where id = $1", [borrador]);
      await actuarComo(c, cliente);
      expect((await intentar(c, "update public.service_requests set description = 'Otra' where id = $1", [borrador])).rowCount).toBe(0);
    });

    test("nadie cambia status, dueño ni taller por UPDATE directo", async () => {
      const cliente = await usuarioConRol("client");
      const taller = await crearTallerPublicado(c, await usuarioConRol("craftsman"));
      await crearSolicitud(c, cliente, taller, "draft");
      await actuarComo(c, cliente);
      expect((await intentar(c, "update public.service_requests set status = 'open'")).error?.code).toBe(PERMISO_DENEGADO);
      expect((await intentar(c, "update public.service_requests set status = 'cancelled'")).error?.code).toBe(PERMISO_DENEGADO);
      expect((await intentar(c, "update public.service_requests set client_id = workshop_id")).error?.code).toBe(PERMISO_DENEGADO);
      expect((await intentar(c, "update public.service_requests set workshop_id = id")).error?.code).toBe(PERMISO_DENEGADO);
    });

    test("el artesano no edita solicitudes; nadie borra", async () => {
      const cliente = await usuarioConRol("client");
      const dueno = await usuarioConRol("craftsman");
      const taller = await crearTallerPublicado(c, dueno);
      await crearSolicitud(c, cliente, taller, "open");
      await actuarComo(c, dueno);
      expect((await intentar(c, "update public.service_requests set description = 'x'")).rowCount).toBe(0);
      expect((await intentar(c, "delete from public.service_requests")).error?.code).toBe(PERMISO_DENEGADO);
      await actuarComo(c, cliente);
      expect((await intentar(c, "delete from public.service_requests")).error?.code).toBe(PERMISO_DENEGADO);
    });

    test("otro cliente no edita el borrador ajeno", async () => {
      const cliente = await usuarioConRol("client");
      const intruso = await usuarioConRol("client");
      const taller = await crearTallerPublicado(c, await usuarioConRol("craftsman"));
      await crearSolicitud(c, cliente, taller, "draft");
      await actuarComo(c, intruso);
      expect((await intentar(c, "update public.service_requests set description = 'x'")).rowCount).toBe(0);
    });
  });

  describe("perfil de la contraparte (profiles)", () => {
    test("cliente y artesano se ven entre sí cuando la solicitud ya no es borrador", async () => {
      const cliente = await usuarioConRol("client");
      const dueno = await usuarioConRol("craftsman");
      const taller = await crearTallerPublicado(c, dueno);
      await crearSolicitud(c, cliente, taller, "open");
      await actuarComo(c, cliente);
      expect((await intentar(c, "select id from public.profiles where id = $1", [dueno])).rows).toHaveLength(1);
      await actuarComo(c, dueno);
      expect((await intentar(c, "select id from public.profiles where id = $1", [cliente])).rows).toHaveLength(1);
    });

    test("con la solicitud en borrador el artesano no ve al cliente", async () => {
      const cliente = await usuarioConRol("client");
      const dueno = await usuarioConRol("craftsman");
      const taller = await crearTallerPublicado(c, dueno);
      await crearSolicitud(c, cliente, taller, "draft");
      await actuarComo(c, dueno);
      expect((await intentar(c, "select id from public.profiles where id = $1", [cliente])).rows).toEqual([]);
    });

    test("un usuario sin solicitud en común no ve el perfil; el admin tampoco", async () => {
      const cliente = await usuarioConRol("client");
      const dueno = await usuarioConRol("craftsman");
      const taller = await crearTallerPublicado(c, dueno);
      await crearSolicitud(c, cliente, taller, "open");
      const otroCliente = await usuarioConRol("client");
      const otroArtesano = await usuarioConRol("craftsman");
      const admin = await usuarioConRol("admin");
      for (const uid of [otroCliente, otroArtesano, admin]) {
        await actuarComo(c, uid);
        expect((await intentar(c, "select id from public.profiles where id in ($1, $2)", [cliente, dueno])).rows).toEqual([]);
      }
    });

    test("un cliente no ve a otro cliente aunque ambos escriban al mismo taller", async () => {
      const a = await usuarioConRol("client");
      const b = await usuarioConRol("client");
      const taller = await crearTallerPublicado(c, await usuarioConRol("craftsman"));
      await crearSolicitud(c, a, taller, "open");
      await crearSolicitud(c, b, taller, "open");
      await actuarComo(c, a);
      expect((await intentar(c, "select id from public.profiles where id = $1", [b])).rows).toEqual([]);
    });

    test("ver al contraparte no da acceso a client_private", async () => {
      const cliente = await usuarioConRol("client");
      const dueno = await usuarioConRol("craftsman");
      const taller = await crearTallerPublicado(c, dueno);
      await crearSolicitud(c, cliente, taller, "open");
      await c.query("insert into public.client_private (user_id, age, address) values ($1, 30, 'Calle 1')", [cliente]);
      await actuarComo(c, dueno);
      expect((await intentar(c, "select * from public.client_private")).rows).toEqual([]);
    });
  });
});
