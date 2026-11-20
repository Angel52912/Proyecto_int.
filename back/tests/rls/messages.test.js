import { abrirTransaccion, actuarComo, asignarRol, cerrarTransaccion, crearUsuario, intentar } from "../helpers/db.js";
import { PERMISO_DENEGADO, crearSolicitud, crearTallerPublicado } from "../helpers/solicitudes.js";

/** CU-03: chat (messages), notificaciones y publicación Realtime. */
describe("messages, notifications y Realtime", () => {
  /** @type {import("pg").Client} */
  let c;
  let n = 0;
  const correo = () => `chat-${Date.now()}-${n++}@prueba.test`;

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
  async function escenario(status = "open") {
    const cliente = await usuarioConRol("client");
    const artesano = await usuarioConRol("craftsman");
    const taller = await crearTallerPublicado(c, artesano);
    const solicitud = await crearSolicitud(c, cliente, taller, status);
    return { cliente, artesano, solicitud };
  }

  /**
   * @param {string} solicitud
   * @param {string} [texto]
   */
  const enviar = (solicitud, texto = "Hola") =>
    intentar(c, "insert into public.messages (request_id, body) values ($1, $2) returning id, sender_id, kind, quote_id", [solicitud, texto]);

  describe("messages: escritura", () => {
    test("cliente y artesano envían texto; el remitente sale de auth.uid() y kind es text", async () => {
      const { cliente, artesano, solicitud } = await escenario("open");
      await actuarComo(c, cliente);
      const a = await enviar(solicitud, "Hola, ¿cuánto cuesta?");
      await actuarComo(c, artesano);
      const b = await enviar(solicitud, "Son $300");
      expect(a.rows[0]).toMatchObject({ sender_id: cliente, kind: "text", quote_id: null });
      expect(b.rows[0]).toMatchObject({ sender_id: artesano, kind: "text" });
    });

    test.each(["open", "quoted", "accepted"])("la solicitud en %s admite mensajes", async (status) => {
      const { cliente, solicitud } = await escenario(/** @type {any} */ (status));
      await actuarComo(c, cliente);
      expect((await enviar(solicitud)).error).toBeNull();
    });

    test.each(["draft", "declined", "cancelled"])("la solicitud en %s no admite mensajes", async (status) => {
      const { cliente, artesano, solicitud } = await escenario(/** @type {any} */ (status));
      await actuarComo(c, cliente);
      expect((await enviar(solicitud)).error?.code).toBe(PERMISO_DENEGADO);
      await actuarComo(c, artesano);
      expect((await enviar(solicitud)).error?.code).toBe(PERMISO_DENEGADO);
    });

    test("no se puede elegir remitente, tipo, presupuesto ni fecha", async () => {
      const { cliente, artesano, solicitud } = await escenario("open");
      await actuarComo(c, cliente);
      const remitente = await intentar(c, "insert into public.messages (request_id, body, sender_id) values ($1, 'x', $2)", [solicitud, artesano]);
      const tipo = await intentar(c, "insert into public.messages (request_id, body, kind) values ($1, 'x', 'system')", [solicitud]);
      const tarjeta = await intentar(c, "insert into public.messages (request_id, body, kind) values ($1, 'x', 'quote_card')", [solicitud]);
      const presupuesto = await intentar(c, "insert into public.messages (request_id, body, quote_id) values ($1, 'x', gen_random_uuid())", [solicitud]);
      const fecha = await intentar(c, "insert into public.messages (request_id, body, created_at) values ($1, 'x', now())", [solicitud]);
      for (const r of [remitente, tipo, tarjeta, presupuesto, fecha]) expect(r.error?.code).toBe(PERMISO_DENEGADO);
    });

    test("cuerpo vacío o de más de 2000 caracteres viola el CHECK; 2000 sí", async () => {
      const { cliente, solicitud } = await escenario("open");
      await actuarComo(c, cliente);
      expect((await enviar(solicitud, "")).error?.code).toBe("23514");
      expect((await enviar(solicitud, "x".repeat(2001))).error?.code).toBe("23514");
      expect((await enviar(solicitud, "x".repeat(2000))).error).toBeNull();
    });

    test("el texto se guarda tal cual (sin HTML interpretado)", async () => {
      const { cliente, solicitud } = await escenario("open");
      await actuarComo(c, cliente);
      const r = await intentar(c, "insert into public.messages (request_id, body) values ($1, $2) returning body", [solicitud, "<script>alert(1)</script>"]);
      expect(r.rows[0].body).toBe("<script>alert(1)</script>");
    });

    test("no participan: otro cliente, otro artesano, admin, sin rol y anónimo", async () => {
      const { solicitud } = await escenario("open");
      const otroCliente = await usuarioConRol("client");
      const otroArtesano = await usuarioConRol("craftsman");
      await crearTallerPublicado(c, otroArtesano);
      const admin = await usuarioConRol("admin");
      const sinRol = await usuarioConRol(null);
      for (const uid of [otroCliente, otroArtesano, admin, sinRol]) {
        await actuarComo(c, uid);
        expect((await enviar(solicitud)).error?.code).toBe(PERMISO_DENEGADO);
      }
      await actuarComo(c, null);
      expect((await enviar(solicitud)).error?.code).toBe(PERMISO_DENEGADO);
    });

    test("un participante desactivado no envía", async () => {
      const { cliente, artesano, solicitud } = await escenario("open");
      await c.query("update public.profiles set active = false where id in ($1, $2)", [cliente, artesano]);
      await actuarComo(c, cliente);
      expect((await enviar(solicitud)).error?.code).toBe(PERMISO_DENEGADO);
      await actuarComo(c, artesano);
      expect((await enviar(solicitud)).error?.code).toBe(PERMISO_DENEGADO);
    });

    test("sin UPDATE ni DELETE para nadie", async () => {
      const { cliente, artesano, solicitud } = await escenario("open");
      await actuarComo(c, cliente);
      await enviar(solicitud);
      for (const uid of [cliente, artesano]) {
        await actuarComo(c, uid);
        expect((await intentar(c, "update public.messages set body = 'editado'")).error?.code).toBe(PERMISO_DENEGADO);
        expect((await intentar(c, "delete from public.messages")).error?.code).toBe(PERMISO_DENEGADO);
      }
    });
  });

  describe("messages: lectura", () => {
    test("solo los dos participantes leen el chat", async () => {
      const { cliente, artesano, solicitud } = await escenario("open");
      await c.query("insert into public.messages (request_id, sender_id, body) values ($1, $2, 'uno')", [solicitud, cliente]);
      const otroCliente = await usuarioConRol("client");
      const otroArtesano = await usuarioConRol("craftsman");
      await crearTallerPublicado(c, otroArtesano);
      const admin = await usuarioConRol("admin");
      const sinRol = await usuarioConRol(null);
      for (const uid of [cliente, artesano]) {
        await actuarComo(c, uid);
        expect((await intentar(c, "select id from public.messages")).rows).toHaveLength(1);
      }
      for (const uid of [otroCliente, otroArtesano, admin, sinRol]) {
        await actuarComo(c, uid);
        expect((await intentar(c, "select id from public.messages")).rows).toEqual([]);
      }
      await actuarComo(c, null);
      expect((await intentar(c, "select id from public.messages")).error?.code).toBe(PERMISO_DENEGADO);
    });

    test("el artesano no lee mensajes de una solicitud en borrador", async () => {
      const { cliente, artesano, solicitud } = await escenario("draft");
      await c.query("insert into public.messages (request_id, sender_id, body) values ($1, $2, 'uno')", [solicitud, cliente]);
      await actuarComo(c, artesano);
      expect((await intentar(c, "select id from public.messages")).rows).toEqual([]);
    });

    test("los mensajes de sistema (sin remitente) son visibles para los participantes", async () => {
      const { cliente, solicitud } = await escenario("open");
      await c.query("insert into public.messages (request_id, sender_id, body, kind) values ($1, null, 'Solicitud enviada', 'system')", [solicitud]);
      await actuarComo(c, cliente);
      expect((await intentar(c, "select kind, sender_id from public.messages")).rows).toEqual([{ kind: "system", sender_id: null }]);
    });

    test("solo los mensajes de sistema pueden carecer de remitente (CHECK)", async () => {
      const { solicitud } = await escenario("open");
      await c.query("reset role");
      const r = await intentar(c, "insert into public.messages (request_id, sender_id, body, kind) values ($1, null, 'x', 'text')", [solicitud]);
      expect(r.error?.code).toBe("23514");
    });
  });

  describe("notifications", () => {
    /** @param {string} uid */
    async function crearNotificacion(uid) {
      await c.query("reset role");
      const { rows } = await c.query("insert into public.notifications (user_id, type, payload) values ($1, 'request_received', '{}') returning id", [uid]);
      return rows[0].id;
    }

    test("cada usuario lee y marca como leídas solo las suyas", async () => {
      const a = await usuarioConRol("craftsman");
      const b = await usuarioConRol("client");
      const idA = await crearNotificacion(a);
      await crearNotificacion(b);
      await actuarComo(c, a);
      expect((await intentar(c, "select id from public.notifications")).rows).toEqual([{ id: idA }]);
      expect((await intentar(c, "update public.notifications set read_at = now()")).rowCount).toBe(1);
      await actuarComo(c, b);
      expect((await intentar(c, "update public.notifications set read_at = now() where id = $1", [idA])).rowCount).toBe(0);
    });

    test("no se editan tipo, contenido ni dueño; no se crean ni borran", async () => {
      const a = await usuarioConRol("craftsman");
      const b = await usuarioConRol("client");
      await crearNotificacion(a);
      await actuarComo(c, a);
      expect((await intentar(c, "update public.notifications set type = 'otro'")).error?.code).toBe(PERMISO_DENEGADO);
      expect((await intentar(c, "update public.notifications set payload = '{}'")).error?.code).toBe(PERMISO_DENEGADO);
      expect((await intentar(c, "update public.notifications set user_id = $1", [b])).error?.code).toBe(PERMISO_DENEGADO);
      expect((await intentar(c, "insert into public.notifications (user_id, type) values ($1, 'x')", [a])).error?.code).toBe(PERMISO_DENEGADO);
      expect((await intentar(c, "delete from public.notifications")).error?.code).toBe(PERMISO_DENEGADO);
    });

    test("el admin y el usuario sin rol solo ven las suyas; anónimo no tiene acceso", async () => {
      const cliente = await usuarioConRol("client");
      const admin = await usuarioConRol("admin");
      await crearNotificacion(cliente);
      await actuarComo(c, admin);
      expect((await intentar(c, "select id from public.notifications")).rows).toEqual([]);
      await actuarComo(c, null);
      expect((await intentar(c, "select id from public.notifications")).error?.code).toBe(PERMISO_DENEGADO);
    });
  });

  describe("Realtime", () => {
    test("messages, notifications y service_requests están en la publicación supabase_realtime", async () => {
      await c.query("reset role");
      const { rows } = await c.query("select tablename from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public'");
      const tablas = rows.map((fila) => fila.tablename);
      expect(tablas).toEqual(expect.arrayContaining(["messages", "notifications", "service_requests"]));
    });

    test("las tablas del chat tienen RLS activo", async () => {
      await c.query("reset role");
      const { rows } = await c.query(
        "select relname, relrowsecurity from pg_class where relnamespace = 'public'::regnamespace and relname in ('service_requests', 'request_photos', 'messages', 'notifications') order by relname",
      );
      expect(rows).toEqual([
        { relname: "messages", relrowsecurity: true },
        { relname: "notifications", relrowsecurity: true },
        { relname: "request_photos", relrowsecurity: true },
        { relname: "service_requests", relrowsecurity: true },
      ]);
    });
  });
});
