import { abrirTransaccion, actuarComo, actuarSinUsuario, asignarRol, cerrarTransaccion, crearUsuario, intentar } from "../helpers/db.js";
import { crearPresupuesto, fechaFutura } from "../helpers/presupuestos.js";
import { PERMISO_DENEGADO, crearSolicitud, crearTallerPublicado } from "../helpers/solicitudes.js";

/** CU-04: send_quote, respond_quote y cancel_request con presupuesto (flujo principal y alternos). */
describe("send_quote, respond_quote y cancel_request", () => {
  /** @type {import("pg").Client} */
  let c;
  let n = 0;
  const correo = () => `funciones-quote-${Date.now()}-${n++}@prueba.test`;

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
    return { cliente, artesano, taller, solicitud };
  }

  /** @param {string} solicitud @param {Record<string, unknown>} [extra] */
  const enviar = (solicitud, extra = {}) => {
    const datos = { monto: 350.5, fecha: fechaFutura(), detalle: { note: "Cambio de suela" }, ...extra };
    return intentar(c, "select public.send_quote($1, $2, $3, $4::jsonb) as r", [solicitud, datos.monto, datos.fecha, JSON.stringify(datos.detalle)]);
  };
  /** @param {string} quote @param {boolean} aceptar */
  const responder = (quote, aceptar) => intentar(c, "select public.respond_quote($1, $2) as r", [quote, aceptar]);
  /** @param {string} solicitud */
  const cancelar = (solicitud) => intentar(c, "select public.cancel_request($1) as r", [solicitud]);

  /** @param {string} solicitud */
  async function estadoSolicitud(solicitud) {
    await c.query("reset role");
    return (await c.query("select status from public.service_requests where id = $1", [solicitud])).rows[0].status;
  }
  /** @param {string} quote */
  async function estadoQuote(quote) {
    await c.query("reset role");
    return (await c.query("select status from public.quotes where id = $1", [quote])).rows[0].status;
  }
  /** @param {string} uid */
  async function tiposDeNotificacion(uid) {
    await c.query("reset role");
    return (await c.query("select type from public.notifications where user_id = $1 order by created_at, type", [uid])).rows.map((r) => r.type);
  }

  describe("send_quote", () => {
    test("flujo principal: crea el presupuesto, cotiza la solicitud, pone la tarjeta en el chat y avisa al cliente", async () => {
      const { cliente, artesano, solicitud } = await escenario("open");
      await actuarComo(c, artesano);
      const r = await enviar(solicitud);
      expect(r.error).toBeNull();
      expect(r.rows[0].r).toMatchObject({
        request_id: solicitud,
        amount_mxn: 350.5,
        status: "sent",
        responded_at: null,
        detail: { note: "Cambio de suela" },
      });
      expect(await estadoSolicitud(solicitud)).toBe("quoted");

      await actuarComo(c, cliente);
      const tarjeta = await intentar(c, "select kind, sender_id, quote_id, body from public.messages where kind = 'quote_card'");
      expect(tarjeta.rows).toEqual([{ kind: "quote_card", sender_id: artesano, quote_id: r.rows[0].r.id, body: "Presupuesto enviado" }]);
      expect((await intentar(c, "select type, payload from public.notifications")).rows).toEqual([
        { type: "quote_received", payload: { request_id: solicitud, quote_id: r.rows[0].r.id } },
      ]);
    });

    test("A2: rectificar deja el anterior en superseded y solo uno vigente", async () => {
      const { artesano, solicitud } = await escenario("open");
      await actuarComo(c, artesano);
      const primero = await enviar(solicitud);
      const segundo = await enviar(solicitud, { monto: 400 });
      expect(segundo.error).toBeNull();
      expect(await estadoQuote(primero.rows[0].r.id)).toBe("superseded");
      expect(await estadoQuote(segundo.rows[0].r.id)).toBe("sent");
      expect(await estadoSolicitud(solicitud)).toBe("quoted");
    });

    test("cliente, usuario sin rol y admin lanzan forbidden", async () => {
      const { cliente, solicitud } = await escenario("open");
      for (const uid of [cliente, await usuarioConRol(null), await usuarioConRol("admin")]) {
        await actuarComo(c, uid);
        expect((await enviar(solicitud)).error?.message).toContain("forbidden");
      }
    });

    test("artesano de otro taller o solicitud inexistente o en borrador: not_found", async () => {
      const { artesano, solicitud, taller } = await escenario("open");
      await actuarComo(c, await usuarioConRol("craftsman"));
      expect((await enviar(solicitud)).error?.message).toContain("not_found");
      const borrador = await crearSolicitud(c, await usuarioConRol("client"), taller, "draft");
      await actuarComo(c, artesano);
      expect((await enviar(borrador)).error?.message).toContain("not_found");
      expect((await enviar("99999999-9999-4999-8999-999999999999")).error?.message).toContain("not_found");
    });

    test("anónimo: permission denied; token sin usuario: not_authenticated; artesano inactivo: inactive_user", async () => {
      const { artesano, solicitud } = await escenario("open");
      await actuarComo(c, null);
      expect((await enviar(solicitud)).error?.code).toBe(PERMISO_DENEGADO);
      await actuarSinUsuario(c);
      expect((await enviar(solicitud)).error?.message).toContain("not_authenticated");
      await c.query("reset role");
      await c.query("update public.profiles set active = false where id = $1", [artesano]);
      await actuarComo(c, artesano);
      expect((await enviar(solicitud)).error?.message).toContain("inactive_user");
    });

    test.each([
      ["monto cero", { monto: 0 }],
      ["monto negativo", { monto: -1 }],
      ["tres decimales", { monto: 10.123 }],
      ["monto enorme", { monto: 100000000 }],
      ["fecha pasada", { fecha: "2020-01-01" }],
      ["detalle que no es objeto", { detalle: [1, 2] }],
      ["detalle muy largo", { detalle: { x: "a".repeat(2100) } }],
    ])("datos inválidos (%s): invalid_input y no cambia nada", async (_nombre, extra) => {
      const { artesano, solicitud } = await escenario("open");
      await actuarComo(c, artesano);
      expect((await enviar(solicitud, extra)).error?.message).toContain("invalid_input");
      expect(await estadoSolicitud(solicitud)).toBe("open");
    });

    test.each(["accepted", "declined", "cancelled"])("con la solicitud en %s lanza invalid_state", async (status) => {
      const { artesano, solicitud } = await escenario(/** @type {any} */ (status));
      await actuarComo(c, artesano);
      expect((await enviar(solicitud)).error?.message).toContain("invalid_state");
    });

    test("taller suspendido: forbidden", async () => {
      const { artesano, taller, solicitud } = await escenario("open");
      await c.query("reset role");
      await c.query("update public.workshops set suspended = true where id = $1", [taller]);
      await actuarComo(c, artesano);
      expect((await enviar(solicitud)).error?.message).toContain("forbidden");
    });
  });

  describe("respond_quote", () => {
    /** Solicitud cotizada con un presupuesto vigente. */
    async function cotizada() {
      const e = await escenario("quoted");
      const quote = await crearPresupuesto(c, e.solicitud, "sent");
      return { ...e, quote };
    }

    test("aceptar: crea la orden, acepta la solicitud, avisa a ambas partes y deja el chat abierto", async () => {
      const { cliente, artesano, solicitud, quote } = await cotizada();
      await actuarComo(c, cliente);
      const r = await responder(quote, true);
      expect(r.error).toBeNull();
      expect(r.rows[0].r).toMatchObject({ quote_id: quote, status: "accepted" });
      expect(await estadoQuote(quote)).toBe("accepted");
      expect(await estadoSolicitud(solicitud)).toBe("accepted");

      await actuarComo(c, cliente);
      const orden = await intentar(c, "select id, quote_id, request_id, client_id, phase, status from public.orders");
      expect(orden.rows).toEqual([
        { id: r.rows[0].r.order_id, quote_id: quote, request_id: solicitud, client_id: cliente, phase: 1, status: "in_progress" },
      ]);
      expect(await tiposDeNotificacion(cliente)).toEqual(["order_created"]);
      expect(await tiposDeNotificacion(artesano)).toEqual(["quote_accepted"]);
      // El chat sigue admitiendo mensajes con la solicitud aceptada.
      await actuarComo(c, cliente);
      expect((await intentar(c, "insert into public.messages (request_id, body) values ($1, 'Gracias')", [solicitud])).error).toBeNull();
    });

    test("A1: rechazar deja la solicitud cotizada, sin orden, con el chat abierto, y avisa al artesano", async () => {
      const { cliente, artesano, solicitud, quote } = await cotizada();
      await actuarComo(c, cliente);
      const r = await responder(quote, false);
      expect(r.rows[0].r).toEqual({ quote_id: quote, status: "rejected", order_id: null });
      expect(await estadoQuote(quote)).toBe("rejected");
      expect(await estadoSolicitud(solicitud)).toBe("quoted");
      await c.query("reset role");
      expect((await c.query("select count(*)::int as total from public.orders where request_id = $1", [solicitud])).rows[0].total).toBe(0);
      expect(await tiposDeNotificacion(artesano)).toEqual(["quote_rejected"]);
      // El chat sigue abierto.
      await actuarComo(c, cliente);
      expect((await intentar(c, "insert into public.messages (request_id, body) values ($1, 'Hola')", [solicitud])).error).toBeNull();
    });

    test("tras un rechazo el artesano envía otro presupuesto y el cliente lo acepta (varias rondas)", async () => {
      const { cliente, artesano, solicitud, quote } = await cotizada();
      await actuarComo(c, cliente);
      await responder(quote, false);
      await actuarComo(c, artesano);
      const segundo = await enviar(solicitud, { monto: 200 });
      expect(segundo.error).toBeNull();
      await actuarComo(c, cliente);
      await responder(segundo.rows[0].r.id, false);
      await actuarComo(c, artesano);
      const tercero = await enviar(solicitud, { monto: 150 });
      await actuarComo(c, cliente);
      expect((await responder(tercero.rows[0].r.id, true)).error).toBeNull();
      expect(await estadoSolicitud(solicitud)).toBe("accepted");
      await c.query("reset role");
      const estados = (await c.query("select status from public.quotes where request_id = $1 order by created_at, id", [solicitud])).rows;
      expect(estados.map((q) => q.status).sort()).toEqual(["accepted", "rejected", "rejected", "rejected"]);
    });

    test("responder dos veces o un presupuesto reemplazado lanza invalid_state", async () => {
      const { cliente, artesano, solicitud, quote } = await cotizada();
      await actuarComo(c, artesano);
      const nuevo = await enviar(solicitud, { monto: 500 });
      await actuarComo(c, cliente);
      expect((await responder(quote, true)).error?.message).toContain("invalid_state");
      expect((await responder(nuevo.rows[0].r.id, true)).error).toBeNull();
      expect((await responder(nuevo.rows[0].r.id, false)).error?.message).toContain("invalid_state");
      // La orden es única por presupuesto: no se duplica.
      await c.query("reset role");
      expect((await c.query("select count(*)::int as total from public.orders where request_id = $1", [solicitud])).rows[0].total).toBe(1);
    });

    test("otro cliente: not_found; artesano, admin y sin rol: forbidden", async () => {
      const { quote, artesano } = await cotizada();
      await actuarComo(c, await usuarioConRol("client"));
      expect((await responder(quote, true)).error?.message).toContain("not_found");
      for (const uid of [artesano, await usuarioConRol("admin"), await usuarioConRol(null)]) {
        await actuarComo(c, uid);
        expect((await responder(quote, true)).error?.message).toContain("forbidden");
      }
    });

    test("presupuesto inexistente: not_found; anónimo: permission denied; sin usuario: not_authenticated; cliente inactivo: inactive_user", async () => {
      const { cliente, quote } = await cotizada();
      await actuarComo(c, cliente);
      expect((await responder("99999999-9999-4999-8999-999999999999", true)).error?.message).toContain("not_found");
      await actuarComo(c, null);
      expect((await responder(quote, true)).error?.code).toBe(PERMISO_DENEGADO);
      await actuarSinUsuario(c);
      expect((await responder(quote, true)).error?.message).toContain("not_authenticated");
      await c.query("reset role");
      await c.query("update public.profiles set active = false where id = $1", [cliente]);
      await actuarComo(c, cliente);
      expect((await responder(quote, true)).error?.message).toContain("inactive_user");
    });

    test("con la solicitud cancelada no se puede aceptar (invalid_state)", async () => {
      const { cliente, solicitud, quote } = await cotizada();
      await actuarComo(c, cliente);
      expect((await cancelar(solicitud)).error).toBeNull();
      expect((await responder(quote, true)).error?.message).toContain("invalid_state");
    });
  });

  describe("cancel_request con presupuesto vigente", () => {
    test("marca el presupuesto como rechazado y conserva el resto del comportamiento", async () => {
      const { cliente, artesano, solicitud } = await escenario("quoted");
      const quote = await crearPresupuesto(c, solicitud, "sent");
      await actuarComo(c, cliente);
      const r = await cancelar(solicitud);
      expect(r.rows[0].r).toEqual({ id: solicitud, status: "cancelled" });
      expect(await estadoQuote(quote)).toBe("rejected");
      expect(await tiposDeNotificacion(artesano)).toEqual(["request_cancelled"]);
    });

    test("sin presupuesto sigue funcionando; aceptada sigue sin poder cancelarse", async () => {
      const abierta = await escenario("open");
      await actuarComo(c, abierta.cliente);
      expect((await cancelar(abierta.solicitud)).error).toBeNull();
      const aceptada = await escenario("accepted");
      await actuarComo(c, aceptada.cliente);
      expect((await cancelar(aceptada.solicitud)).error?.message).toContain("invalid_state");
    });
  });
});
