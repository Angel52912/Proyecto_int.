import { abrirTransaccion, actuarComo, actuarSinUsuario, asignarRol, cerrarTransaccion, crearUsuario, intentar } from "../helpers/db.js";
import { crearOrden, crearPresupuesto } from "../helpers/presupuestos.js";
import { PERMISO_DENEGADO, crearSolicitud, crearTallerPublicado } from "../helpers/solicitudes.js";

/** CU-06: private.order_pins, reveal_delivery_pin y verify_delivery_pin (flujo principal y alternos). */
describe("PIN de entrega (CU-06)", () => {
  /** @type {import("pg").Client} */
  let c;
  let n = 0;
  const correo = () => `pin-${Date.now()}-${n++}@prueba.test`;
  const AJENA = "99999999-9999-4999-8999-999999999999";

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

  /** Cliente, artesano, taller y una orden con el estado indicado (fase 4). */
  async function escenario(status = "ready") {
    const cliente = await usuarioConRol("client");
    const artesano = await usuarioConRol("craftsman");
    const taller = await crearTallerPublicado(c, artesano);
    const solicitud = await crearSolicitud(c, cliente, taller, "accepted");
    const quote = await crearPresupuesto(c, solicitud, "accepted");
    const orden = await crearOrden(c, { quote, request: solicitud, cliente, taller });
    await c.query("update public.orders set phase = 4, status = $2::public.order_status where id = $1", [orden, status]);
    return { cliente, artesano, taller, solicitud, orden };
  }

  /** El cliente genera el PIN. @returns {Promise<string>} */
  async function revelar(/** @type {string} */ cliente, /** @type {string} */ orden) {
    await actuarComo(c, cliente);
    const r = await intentar(c, "select public.reveal_delivery_pin($1) as r", [orden]);
    expect(r.error).toBeNull();
    return r.rows[0].r.pin;
  }

  const revelarIntento = (/** @type {string} */ orden) => intentar(c, "select public.reveal_delivery_pin($1) as r", [orden]);
  const verificar = (/** @type {string} */ orden, /** @type {string | null} */ pin) => intentar(c, "select public.verify_delivery_pin($1, $2) as r", [orden, pin]);
  const otroPin = (/** @type {string} */ pin) => (pin === "000000" ? "111111" : "000000");

  async function filaPin(/** @type {string} */ orden) {
    await c.query("reset role");
    return (await c.query("select pin_hash, attempts, locked_until from private.order_pins where order_id = $1", [orden])).rows[0];
  }
  async function leerOrden(/** @type {string} */ orden) {
    await c.query("reset role");
    return (await c.query("select status, delivered_at from public.orders where id = $1", [orden])).rows[0];
  }

  describe("private.order_pins", () => {
    test("ni authenticated ni anon pueden leer ni escribir la tabla", async () => {
      const { cliente, artesano, orden } = await escenario();
      await revelar(cliente, orden);
      for (const uid of [cliente, artesano, await usuarioConRol("admin"), await usuarioConRol(null), null]) {
        await actuarComo(c, uid);
        expect((await intentar(c, "select * from private.order_pins")).error?.code).toBe(PERMISO_DENEGADO);
        expect((await intentar(c, "update private.order_pins set attempts = 0")).error?.code).toBe(PERMISO_DENEGADO);
        expect((await intentar(c, "delete from private.order_pins")).error?.code).toBe(PERMISO_DENEGADO);
      }
    });

    test("RLS activo y la tabla no está publicada en Realtime", async () => {
      await c.query("reset role");
      const { rows } = await c.query("select relrowsecurity from pg_class where oid = 'private.order_pins'::regclass");
      expect(rows).toEqual([{ relrowsecurity: true }]);
      const publicadas = await c.query("select tablename from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'order_pins'");
      expect(publicadas.rows).toEqual([]);
    });

    test("public.orders no tiene columnas de PIN, así que Realtime no puede filtrar el hash", async () => {
      await c.query("reset role");
      const { rows } = await c.query(
        "select column_name from information_schema.columns where table_schema = 'public' and table_name = 'orders' and column_name ~ 'pin'",
      );
      expect(rows).toEqual([]);
    });
  });

  describe("reveal_delivery_pin", () => {
    test("flujo principal: 6 dígitos, guardado con hash bcrypt y cada llamada rota el PIN", async () => {
      const { cliente, orden } = await escenario("ready");
      await actuarComo(c, cliente);
      const r = await revelarIntento(orden);
      expect(r.error).toBeNull();
      expect(r.rows[0].r).toEqual({ order_id: orden, pin: expect.stringMatching(/^\d{6}$/) });
      const primera = await filaPin(orden);
      expect(primera.pin_hash).toMatch(/^\$2[aby]\$/);
      expect(primera.pin_hash).not.toContain(r.rows[0].r.pin);
      expect(primera.attempts).toBe(0);

      await actuarComo(c, cliente);
      await revelarIntento(orden);
      expect((await filaPin(orden)).pin_hash).not.toBe(primera.pin_hash);
    });

    test("solo con el pedido listo: en curso, entregado o cancelado lanzan invalid_state", async () => {
      for (const estado of ["in_progress", "delivered", "cancelled"]) {
        const { cliente, orden } = await escenario(estado);
        await actuarComo(c, cliente);
        expect((await revelarIntento(orden)).error?.message).toContain("invalid_state");
      }
    });

    test("artesano, usuario sin rol y admin lanzan forbidden", async () => {
      const { artesano, orden } = await escenario();
      for (const uid of [artesano, await usuarioConRol(null), await usuarioConRol("admin")]) {
        await actuarComo(c, uid);
        expect((await revelarIntento(orden)).error?.message).toContain("forbidden");
      }
    });

    test("otro cliente u orden inexistente: not_found; id nulo: invalid_input", async () => {
      const { orden } = await escenario();
      await actuarComo(c, await usuarioConRol("client"));
      expect((await revelarIntento(orden)).error?.message).toContain("not_found");
      expect((await revelarIntento(AJENA)).error?.message).toContain("not_found");
      expect((await revelarIntento(/** @type {any} */ (null))).error?.message).toContain("invalid_input");
    });

    test("anónimo: permission denied; token sin usuario: not_authenticated; cliente inactivo: inactive_user", async () => {
      const { cliente, orden } = await escenario();
      await actuarComo(c, null);
      expect((await revelarIntento(orden)).error?.code).toBe(PERMISO_DENEGADO);
      await actuarSinUsuario(c);
      expect((await revelarIntento(orden)).error?.message).toContain("not_authenticated");
      await c.query("reset role");
      await c.query("update public.profiles set active = false where id = $1", [cliente]);
      await actuarComo(c, cliente);
      expect((await revelarIntento(orden)).error?.message).toContain("inactive_user");
    });

    test("rotar el PIN reinicia los intentos pero no levanta un bloqueo vigente", async () => {
      const { cliente, artesano, orden } = await escenario();
      const pin = await revelar(cliente, orden);
      await actuarComo(c, artesano);
      for (let i = 0; i < 5; i += 1) await verificar(orden, otroPin(pin));
      expect((await filaPin(orden)).locked_until).not.toBeNull();

      const nuevo = await revelar(cliente, orden);
      expect((await filaPin(orden)).attempts).toBe(0);
      await actuarComo(c, artesano);
      const r = await verificar(orden, nuevo);
      expect(r.rows[0].r).toMatchObject({ ok: false, attempts_left: 0 });
    });
  });

  describe("verify_delivery_pin", () => {
    test("flujo principal: el PIN correcto entrega, borra el PIN, avisa al cliente y deja mensaje de sistema", async () => {
      const { cliente, artesano, orden, solicitud } = await escenario();
      const pin = await revelar(cliente, orden);
      await actuarComo(c, artesano);
      const r = await verificar(orden, pin);
      expect(r.error).toBeNull();
      expect(r.rows[0].r).toEqual({ ok: true, attempts_left: 5, locked_until: null, status: "delivered" });
      const orden2 = await leerOrden(orden);
      expect(orden2.status).toBe("delivered");
      expect(orden2.delivered_at).not.toBeNull();
      expect(await filaPin(orden)).toBeUndefined();

      await c.query("reset role");
      const notificaciones = await c.query("select type, payload from public.notifications where user_id = $1", [cliente]);
      expect(notificaciones.rows).toEqual([{ type: "order_delivered", payload: { order_id: orden, request_id: solicitud, review_pending: true } }]);
      const mensajes = await c.query("select kind, sender_id from public.messages where request_id = $1 and kind = 'system'", [solicitud]);
      expect(mensajes.rows).toEqual([{ kind: "system", sender_id: null }]);

      await actuarComo(c, artesano);
      expect((await verificar(orden, pin)).error?.message).toContain("invalid_state"); // ya entregado
    });

    test("A1: un PIN incorrecto no lanza excepción y el contador persiste", async () => {
      const { cliente, artesano, orden } = await escenario();
      const pin = await revelar(cliente, orden);
      await actuarComo(c, artesano);
      for (const restantes of [4, 3, 2, 1]) {
        const r = await verificar(orden, otroPin(pin));
        expect(r.error).toBeNull();
        expect(r.rows[0].r).toEqual({ ok: false, attempts_left: restantes, locked_until: null, status: "ready" });
        expect((await filaPin(orden)).attempts).toBe(5 - restantes);
        await actuarComo(c, artesano);
      }
      expect((await leerOrden(orden)).status).toBe("ready");
    });

    test("al quinto intento fallido bloquea 15 minutos, incluso con el PIN correcto", async () => {
      const { cliente, artesano, orden } = await escenario();
      const pin = await revelar(cliente, orden);
      await actuarComo(c, artesano);
      let ultimo;
      for (let i = 0; i < 5; i += 1) ultimo = await verificar(orden, otroPin(pin));
      const resultado = /** @type {any} */ (ultimo).rows[0].r;
      expect(resultado).toMatchObject({ ok: false, attempts_left: 0 });
      const minutos = (Date.parse(resultado.locked_until) - Date.now()) / 60_000;
      expect(minutos).toBeGreaterThan(14);
      expect(minutos).toBeLessThanOrEqual(15);

      const bloqueado = await verificar(orden, pin);
      expect(bloqueado.error).toBeNull();
      expect(bloqueado.rows[0].r).toMatchObject({ ok: false, attempts_left: 0 });
      expect((await leerOrden(orden)).status).toBe("ready");
    });

    test("pasado el bloqueo se puede entregar con el PIN correcto", async () => {
      const { cliente, artesano, orden } = await escenario();
      const pin = await revelar(cliente, orden);
      await actuarComo(c, artesano);
      for (let i = 0; i < 5; i += 1) await verificar(orden, otroPin(pin));
      await c.query("reset role");
      await c.query("update private.order_pins set locked_until = now() - interval '1 second' where order_id = $1", [orden]);
      await actuarComo(c, artesano);
      expect((await verificar(orden, otroPin(pin))).rows[0].r).toMatchObject({ ok: false, attempts_left: 4 });
      expect((await verificar(orden, pin)).rows[0].r.ok).toBe(true);
    });

    test("A1: PIN mal formado o nulo lanza invalid_input y no cuenta como intento", async () => {
      const { cliente, artesano, orden } = await escenario();
      await revelar(cliente, orden);
      await actuarComo(c, artesano);
      for (const malo of ["12345", "1234567", "abcdef", "", null]) {
        expect((await verificar(orden, malo)).error?.message).toContain("invalid_input");
      }
      expect((await verificar(/** @type {any} */ (null), "123456")).error?.message).toContain("invalid_input");
      expect((await filaPin(orden)).attempts).toBe(0);
    });

    test("sin PIN generado, o con el pedido en curso, entregado o cancelado: invalid_state", async () => {
      const { artesano, orden } = await escenario("ready");
      await actuarComo(c, artesano);
      expect((await verificar(orden, "123456")).error?.message).toContain("invalid_state");
      for (const estado of ["in_progress", "delivered", "cancelled"]) {
        const e = await escenario(estado);
        await actuarComo(c, e.artesano);
        expect((await verificar(e.orden, "123456")).error?.message).toContain("invalid_state");
      }
    });

    test("cliente, usuario sin rol y admin lanzan forbidden", async () => {
      const { cliente, orden } = await escenario();
      const pin = await revelar(cliente, orden);
      for (const uid of [cliente, await usuarioConRol(null), await usuarioConRol("admin")]) {
        await actuarComo(c, uid);
        expect((await verificar(orden, pin)).error?.message).toContain("forbidden");
      }
    });

    test("artesano de otro taller u orden inexistente: not_found", async () => {
      const { cliente, orden } = await escenario();
      const pin = await revelar(cliente, orden);
      await actuarComo(c, await usuarioConRol("craftsman"));
      expect((await verificar(orden, pin)).error?.message).toContain("not_found");
      expect((await verificar(AJENA, pin)).error?.message).toContain("not_found");
    });

    test("anónimo: permission denied; token sin usuario: not_authenticated; inactivo: inactive_user; taller suspendido: forbidden", async () => {
      const { cliente, artesano, taller, orden } = await escenario();
      const pin = await revelar(cliente, orden);
      await actuarComo(c, null);
      expect((await verificar(orden, pin)).error?.code).toBe(PERMISO_DENEGADO);
      await actuarSinUsuario(c);
      expect((await verificar(orden, pin)).error?.message).toContain("not_authenticated");

      await c.query("reset role");
      await c.query("update public.workshops set suspended = true where id = $1", [taller]);
      await actuarComo(c, artesano);
      expect((await verificar(orden, pin)).error?.message).toContain("forbidden");
      await c.query("reset role");
      await c.query("update public.workshops set suspended = false where id = $1", [taller]);
      await c.query("update public.profiles set active = false where id = $1", [artesano]);
      await actuarComo(c, artesano);
      expect((await verificar(orden, pin)).error?.message).toContain("inactive_user");
    });

    test("un PIN de otro pedido no sirve", async () => {
      const a = await escenario();
      const b = await escenario();
      const pinB = await revelar(b.cliente, b.orden);
      const pinA = await revelar(a.cliente, a.orden);
      await actuarComo(c, a.artesano);
      const r = await verificar(a.orden, pinB === pinA ? otroPin(pinB) : pinB); // evita la colisión (1 en un millón)
      expect(r.rows[0].r.ok).toBe(false);
    });
  });

  test("grants: anon no ejecuta ninguna función; authenticated sí", async () => {
    await c.query("reset role");
    const funciones = ["reveal_delivery_pin(uuid)", "verify_delivery_pin(uuid, text)", "create_review(uuid, integer, text, text[])"];
    for (const f of funciones) {
      const { rows } = await c.query(
        "select has_function_privilege('anon', $1, 'execute') as anon, has_function_privilege('authenticated', $1, 'execute') as auth",
        [`public.${f}`],
      );
      expect(rows[0]).toEqual({ anon: false, auth: true });
    }
  });
});
