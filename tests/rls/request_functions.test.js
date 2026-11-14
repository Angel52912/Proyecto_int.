import { abrirTransaccion, actuarComo, actuarSinUsuario, asignarRol, cerrarTransaccion, crearUsuario, intentar } from "../helpers/db.js";
import { PERMISO_DENEGADO, agregarFoto, crearSolicitud, crearTallerPublicado } from "../helpers/solicitudes.js";

/** CU-03: submit_request y cancel_request (flujo principal y alternos). Los errores viajan en el mensaje. */
describe("submit_request y cancel_request", () => {
  /** @type {import("pg").Client} */
  let c;
  let n = 0;
  const correo = () => `funciones-sol-${Date.now()}-${n++}@prueba.test`;

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

  /** @param {"draft" | "open" | "quoted" | "accepted" | "declined" | "cancelled"} [status] */
  async function escenario(status = "draft") {
    const cliente = await usuarioConRol("client");
    const artesano = await usuarioConRol("craftsman");
    const taller = await crearTallerPublicado(c, artesano);
    const solicitud = await crearSolicitud(c, cliente, taller, status);
    return { cliente, artesano, taller, solicitud };
  }

  /** @param {string} solicitud */
  const enviar = (solicitud) => intentar(c, "select public.submit_request($1) as r", [solicitud]);
  /** @param {string} solicitud */
  const cancelar = (solicitud) => intentar(c, "select public.cancel_request($1) as r", [solicitud]);

  /** @param {string} solicitud */
  async function leerEstado(solicitud) {
    await c.query("reset role");
    const { rows } = await c.query("select status, submitted_at from public.service_requests where id = $1", [solicitud]);
    return rows[0];
  }

  describe("submit_request", () => {
    test("flujo principal: pasa a open, abre el chat y notifica al artesano", async () => {
      const { cliente, artesano, solicitud } = await escenario("draft");
      await agregarFoto(c, solicitud);
      await actuarComo(c, cliente);
      const r = await enviar(solicitud);
      expect(r.error).toBeNull();
      expect(r.rows[0].r).toEqual({ id: solicitud, status: "open" });

      const estado = await leerEstado(solicitud);
      expect(estado.status).toBe("open");
      expect(estado.submitted_at).not.toBeNull();

      await actuarComo(c, artesano);
      const notas = await intentar(c, "select type, payload, read_at from public.notifications");
      expect(notas.rows).toEqual([{ type: "request_received", payload: { request_id: solicitud }, read_at: null }]);
      const mensajes = await intentar(c, "select kind, sender_id, body from public.messages");
      expect(mensajes.rows).toEqual([{ kind: "system", sender_id: null, body: "Solicitud enviada" }]);
      // Ya no es borrador: el artesano la ve.
      expect((await intentar(c, "select id from public.service_requests")).rows).toEqual([{ id: solicitud }]);
    });

    test("sin fotos lanza photo_required y no cambia el estado", async () => {
      const { cliente, solicitud } = await escenario("draft");
      await actuarComo(c, cliente);
      expect((await enviar(solicitud)).error?.message).toContain("photo_required");
      expect((await leerEstado(solicitud)).status).toBe("draft");
    });

    test.each(["open", "quoted", "accepted", "declined", "cancelled"])("desde %s lanza invalid_state", async (status) => {
      const { cliente, solicitud } = await escenario(/** @type {any} */ (status));
      await agregarFoto(c, solicitud);
      await actuarComo(c, cliente);
      expect((await enviar(solicitud)).error?.message).toContain("invalid_state");
    });

    test("si el taller se despublicó o suspendió, lanza invalid_state", async () => {
      const a = await escenario("draft");
      const b = await escenario("draft");
      await agregarFoto(c, a.solicitud);
      await agregarFoto(c, b.solicitud);
      await c.query("update public.workshops set published = false where id = $1", [a.taller]);
      await c.query("update public.workshops set suspended = true where id = $1", [b.taller]);
      await actuarComo(c, a.cliente);
      expect((await enviar(a.solicitud)).error?.message).toContain("invalid_state");
      await actuarComo(c, b.cliente);
      expect((await enviar(b.solicitud)).error?.message).toContain("invalid_state");
    });

    test("máximo 5 activas (open o quoted): la sexta lanza limit_reached", async () => {
      const cliente = await usuarioConRol("client");
      for (let i = 0; i < 5; i++) {
        const taller = await crearTallerPublicado(c, await usuarioConRol("craftsman"));
        await crearSolicitud(c, cliente, taller, i % 2 === 0 ? "open" : "quoted");
      }
      const taller = await crearTallerPublicado(c, await usuarioConRol("craftsman"));
      const sexta = await crearSolicitud(c, cliente, taller, "draft");
      await agregarFoto(c, sexta);
      await actuarComo(c, cliente);
      expect((await enviar(sexta)).error?.message).toContain("limit_reached");
      expect((await leerEstado(sexta)).status).toBe("draft");
    });

    test("cancelada, aceptada, rechazada y borrador no cuentan como activas", async () => {
      const cliente = await usuarioConRol("client");
      for (const status of ["cancelled", "accepted", "declined", "draft", "open"]) {
        const taller = await crearTallerPublicado(c, await usuarioConRol("craftsman"));
        await crearSolicitud(c, cliente, taller, /** @type {any} */ (status));
      }
      const taller = await crearTallerPublicado(c, await usuarioConRol("craftsman"));
      const nueva = await crearSolicitud(c, cliente, taller, "draft");
      await agregarFoto(c, nueva);
      await actuarComo(c, cliente);
      expect((await enviar(nueva)).error).toBeNull();
    });

    test("la solicitud de otro cliente o inexistente: not_found", async () => {
      const { solicitud } = await escenario("draft");
      await agregarFoto(c, solicitud);
      const intruso = await usuarioConRol("client");
      await actuarComo(c, intruso);
      expect((await enviar(solicitud)).error?.message).toContain("not_found");
      expect((await enviar("33333333-3333-4333-8333-333333333333")).error?.message).toContain("not_found");
    });

    test("id nulo: invalid_input", async () => {
      const cliente = await usuarioConRol("client");
      await actuarComo(c, cliente);
      expect((await intentar(c, "select public.submit_request(null)")).error?.message).toContain("invalid_input");
    });

    test.each([
      ["artesano", "craftsman"],
      ["admin", "admin"],
      ["usuario sin rol", null],
    ])("%s lanza forbidden", async (_nombre, rol) => {
      const { solicitud } = await escenario("draft");
      await agregarFoto(c, solicitud);
      const uid = await usuarioConRol(/** @type {any} */ (rol));
      await actuarComo(c, uid);
      expect((await enviar(solicitud)).error?.message).toContain("forbidden");
    });

    test("un cliente desactivado lanza inactive_user", async () => {
      const { cliente, solicitud } = await escenario("draft");
      await agregarFoto(c, solicitud);
      await c.query("update public.profiles set active = false where id = $1", [cliente]);
      await actuarComo(c, cliente);
      expect((await enviar(solicitud)).error?.message).toContain("inactive_user");
    });

    test("sin usuario en el token: not_authenticated; anónimo: sin EXECUTE", async () => {
      const { solicitud } = await escenario("draft");
      await actuarSinUsuario(c);
      expect((await enviar(solicitud)).error?.message).toContain("not_authenticated");
      await actuarComo(c, null);
      expect((await enviar(solicitud)).error?.code).toBe(PERMISO_DENEGADO);
    });

    test("no se llega a open sin pasar por la función (UPDATE directo denegado)", async () => {
      const { cliente, solicitud } = await escenario("draft");
      await actuarComo(c, cliente);
      expect((await intentar(c, "update public.service_requests set status = 'open' where id = $1", [solicitud])).error?.code).toBe(PERMISO_DENEGADO);
    });
  });

  describe("cancel_request", () => {
    test.each(["open", "quoted"])("A2: desde %s pasa a cancelled, avisa al artesano y cierra el chat", async (status) => {
      const { cliente, artesano, solicitud } = await escenario(/** @type {any} */ (status));
      await actuarComo(c, cliente);
      const r = await cancelar(solicitud);
      expect(r.error).toBeNull();
      expect(r.rows[0].r).toEqual({ id: solicitud, status: "cancelled" });
      expect((await leerEstado(solicitud)).status).toBe("cancelled");

      await actuarComo(c, artesano);
      const notas = await intentar(c, "select type, payload from public.notifications");
      expect(notas.rows).toEqual([{ type: "request_cancelled", payload: { request_id: solicitud } }]);
      const mensajes = await intentar(c, "select kind, body from public.messages");
      expect(mensajes.rows).toEqual([{ kind: "system", body: "Solicitud cancelada por el cliente" }]);
      expect((await intentar(c, "insert into public.messages (request_id, body) values ($1, 'hola')", [solicitud])).error?.code).toBe(PERMISO_DENEGADO);
    });

    test.each(["draft", "accepted", "declined", "cancelled"])("desde %s lanza invalid_state", async (status) => {
      const { cliente, solicitud } = await escenario(/** @type {any} */ (status));
      await actuarComo(c, cliente);
      expect((await cancelar(solicitud)).error?.message).toContain("invalid_state");
      expect((await leerEstado(solicitud)).status).toBe(status);
    });

    test("cancelar libera el cupo: se puede volver a escribir al mismo taller", async () => {
      const { cliente, taller, solicitud } = await escenario("open");
      await actuarComo(c, cliente);
      await cancelar(solicitud);
      const nueva = await intentar(c, "insert into public.service_requests (workshop_id, service_type, description) values ($1, 'repair', 'otra') returning id", [taller]);
      expect(nueva.error).toBeNull();
    });

    test("la solicitud de otro cliente o inexistente: not_found", async () => {
      const { solicitud } = await escenario("open");
      const intruso = await usuarioConRol("client");
      await actuarComo(c, intruso);
      expect((await cancelar(solicitud)).error?.message).toContain("not_found");
      expect((await cancelar("33333333-3333-4333-8333-333333333333")).error?.message).toContain("not_found");
      expect((await leerEstado(solicitud)).status).toBe("open");
    });

    test.each([
      ["artesano dueño del taller", "craftsman"],
      ["admin", "admin"],
      ["usuario sin rol", null],
    ])("%s lanza forbidden", async (_nombre, rol) => {
      const { artesano, solicitud } = await escenario("open");
      const uid = rol === "craftsman" ? artesano : await usuarioConRol(/** @type {any} */ (rol));
      await actuarComo(c, uid);
      expect((await cancelar(solicitud)).error?.message).toContain("forbidden");
      expect((await leerEstado(solicitud)).status).toBe("open");
    });

    test("un cliente desactivado lanza inactive_user; sin usuario, not_authenticated; anónimo, sin EXECUTE", async () => {
      const { cliente, solicitud } = await escenario("open");
      await c.query("update public.profiles set active = false where id = $1", [cliente]);
      await actuarComo(c, cliente);
      expect((await cancelar(solicitud)).error?.message).toContain("inactive_user");
      await actuarSinUsuario(c);
      expect((await cancelar(solicitud)).error?.message).toContain("not_authenticated");
      await actuarComo(c, null);
      expect((await cancelar(solicitud)).error?.code).toBe(PERMISO_DENEGADO);
    });
  });

  test("las funciones son security definer con search_path vacío y sin EXECUTE para public ni anon", async () => {
    await c.query("reset role");
    const { rows } = await c.query(
      `select p.proname, p.prosecdef, p.proconfig,
              has_function_privilege('authenticated', p.oid, 'execute') as auth,
              has_function_privilege('anon', p.oid, 'execute') as anon
         from pg_proc p
        where p.pronamespace = 'public'::regnamespace and p.proname in ('submit_request', 'cancel_request')
        order by p.proname`,
    );
    expect(rows).toHaveLength(2);
    for (const fila of rows) {
      expect(fila.prosecdef).toBe(true);
      expect(fila.proconfig).toContain("search_path=");
      expect({ auth: fila.auth, anon: fila.anon }).toEqual({ auth: true, anon: false });
    }
  });
});
