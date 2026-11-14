import { abrirTransaccion, actuarComo, asignarRol, cerrarTransaccion, crearUsuario, intentar } from "../helpers/db.js";
import { crearOrden, crearPresupuesto } from "../helpers/presupuestos.js";
import { PERMISO_DENEGADO, crearSolicitud, crearTallerPublicado } from "../helpers/solicitudes.js";

/** CU-04: permisos de las tablas quotes y orders (solo lectura para participantes). */
describe("quotes y orders: RLS", () => {
  /** @type {import("pg").Client} */
  let c;
  let n = 0;
  const correo = () => `quotes-orders-${Date.now()}-${n++}@prueba.test`;

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

  /** Solicitud aceptada con su presupuesto y su orden, más usuarios ajenos de cada rol. */
  async function escenario() {
    const cliente = await usuarioConRol("client");
    const artesano = await usuarioConRol("craftsman");
    const taller = await crearTallerPublicado(c, artesano);
    const request = await crearSolicitud(c, cliente, taller, "accepted");
    const quote = await crearPresupuesto(c, request, "accepted");
    const orden = await crearOrden(c, { quote, request, cliente, taller });
    return {
      cliente,
      artesano,
      taller,
      request,
      quote,
      orden,
      otroCliente: await usuarioConRol("client"),
      otroArtesano: await usuarioConRol("craftsman"),
      admin: await usuarioConRol("admin"),
      sinRol: await usuarioConRol(null),
    };
  }

  describe("SELECT de quotes", () => {
    test("el cliente y el artesano de la solicitud la ven", async () => {
      const e = await escenario();
      for (const uid of [e.cliente, e.artesano]) {
        await actuarComo(c, uid);
        expect((await intentar(c, "select id from public.quotes")).rows).toEqual([{ id: e.quote }]);
      }
    });

    test("otro cliente, otro artesano, admin y usuario sin rol no ven nada", async () => {
      const e = await escenario();
      for (const uid of [e.otroCliente, e.otroArtesano, e.admin, e.sinRol]) {
        await actuarComo(c, uid);
        expect((await intentar(c, "select id from public.quotes")).rows).toEqual([]);
      }
    });

    test("el cliente inactivo no ve nada", async () => {
      const e = await escenario();
      await c.query("reset role");
      await c.query("update public.profiles set active = false where id = $1", [e.cliente]);
      await actuarComo(c, e.cliente);
      expect((await intentar(c, "select id from public.quotes")).rows).toEqual([]);
    });

    test("el anónimo no tiene permiso sobre la tabla", async () => {
      await escenario();
      await actuarComo(c, null);
      expect((await intentar(c, "select id from public.quotes")).error?.code).toBe(PERMISO_DENEGADO);
    });
  });

  describe("escritura directa en quotes y orders", () => {
    test("nadie (cliente, artesano, admin) puede insertar, actualizar ni borrar quotes", async () => {
      const e = await escenario();
      for (const uid of [e.cliente, e.artesano, e.admin]) {
        await actuarComo(c, uid);
        const insertar = await intentar(
          c,
          "insert into public.quotes (request_id, amount_mxn, delivery_date) values ($1, 1, current_date + 1)",
          [e.request],
        );
        expect(insertar.error?.code).toBe(PERMISO_DENEGADO);
        expect((await intentar(c, "update public.quotes set amount_mxn = 1")).error?.code).toBe(PERMISO_DENEGADO);
        expect((await intentar(c, "delete from public.quotes")).error?.code).toBe(PERMISO_DENEGADO);
      }
    });

    test("nadie puede insertar, actualizar ni borrar orders", async () => {
      const e = await escenario();
      for (const uid of [e.cliente, e.artesano, e.admin]) {
        await actuarComo(c, uid);
        const insertar = await intentar(
          c,
          "insert into public.orders (quote_id, request_id, client_id, workshop_id, due_date) values ($1, $2, $3, $4, current_date)",
          [e.quote, e.request, e.cliente, e.taller],
        );
        expect(insertar.error?.code).toBe(PERMISO_DENEGADO);
        expect((await intentar(c, "update public.orders set phase = 4")).error?.code).toBe(PERMISO_DENEGADO);
        expect((await intentar(c, "delete from public.orders")).error?.code).toBe(PERMISO_DENEGADO);
      }
    });
  });

  describe("restricciones de quotes", () => {
    test("solo una cotización `sent` por solicitud (índice único parcial)", async () => {
      const e = await escenario();
      const request = await crearSolicitud(c, await usuarioConRol("client"), e.taller, "quoted");
      await crearPresupuesto(c, request, "sent");
      await c.query("savepoint dup");
      await expect(crearPresupuesto(c, request, "sent")).rejects.toMatchObject({ code: "23505" });
      await c.query("rollback to savepoint dup");
      // Varias rechazadas o reemplazadas sí se permiten.
      await crearPresupuesto(c, request, "superseded");
      await crearPresupuesto(c, request, "rejected");
    });

    test("monto mayor que cero y detalle objeto", async () => {
      const e = await escenario();
      const request = await crearSolicitud(c, await usuarioConRol("client"), e.taller, "quoted");
      await c.query("savepoint chk");
      await expect(
        c.query("insert into public.quotes (request_id, amount_mxn, delivery_date) values ($1, 0, current_date)", [request]),
      ).rejects.toMatchObject({ code: "23514" });
      await c.query("rollback to savepoint chk");
      await expect(
        c.query("insert into public.quotes (request_id, amount_mxn, delivery_date, detail) values ($1, 5, current_date, '[]')", [request]),
      ).rejects.toMatchObject({ code: "23514" });
      await c.query("rollback to savepoint chk");
    });
  });

  describe("SELECT de orders", () => {
    test("el cliente y el artesano de la orden la ven", async () => {
      const e = await escenario();
      for (const uid of [e.cliente, e.artesano]) {
        await actuarComo(c, uid);
        const r = await intentar(c, "select id, phase, status from public.orders");
        expect(r.rows).toEqual([{ id: e.orden, phase: 1, status: "in_progress" }]);
      }
    });

    test("otro cliente, otro artesano, admin, sin rol y cliente inactivo no ven nada", async () => {
      const e = await escenario();
      await c.query("reset role");
      const inactivo = await usuarioConRol("client");
      const requestInactivo = await crearSolicitud(c, inactivo, e.taller, "accepted");
      const quoteInactivo = await crearPresupuesto(c, requestInactivo, "accepted");
      await crearOrden(c, { quote: quoteInactivo, request: requestInactivo, cliente: inactivo, taller: e.taller });
      await c.query("update public.profiles set active = false where id = $1", [inactivo]);
      for (const uid of [e.otroCliente, e.otroArtesano, e.admin, e.sinRol, inactivo]) {
        await actuarComo(c, uid);
        expect((await intentar(c, "select id from public.orders")).rows).toEqual([]);
      }
    });

    test("el anónimo no tiene permiso sobre la tabla", async () => {
      await escenario();
      await actuarComo(c, null);
      expect((await intentar(c, "select id from public.orders")).error?.code).toBe(PERMISO_DENEGADO);
    });

    test("orders no tiene columnas de PIN (viven en private.order_pins) y select * no filtra nada", async () => {
      const e = await escenario();
      await c.query("reset role");
      const { rows } = await c.query(
        "select column_name from information_schema.columns where table_schema = 'public' and table_name = 'orders' and column_name ~ 'pin'",
      );
      expect(rows).toEqual([]);
      for (const uid of [e.cliente, e.artesano]) {
        await actuarComo(c, uid);
        const todo = await intentar(c, "select * from public.orders");
        expect(todo.error?.code).toBe(PERMISO_DENEGADO); // el grant sigue siendo por columna
        expect((await intentar(c, "select delivery_pin_hash from public.orders")).error?.code).toBe("42703");
      }
    });
  });

  test("las tablas quotes y orders tienen RLS activo y están en Realtime", async () => {
    await c.query("reset role");
    const { rows } = await c.query(
      "select relname, relrowsecurity from pg_class where relname in ('quotes', 'orders') and relnamespace = 'public'::regnamespace order by relname",
    );
    expect(rows).toEqual([
      { relname: "orders", relrowsecurity: true },
      { relname: "quotes", relrowsecurity: true },
    ]);
    const publicadas = await c.query(
      "select tablename from pg_publication_tables where pubname = 'supabase_realtime' and tablename in ('quotes', 'orders') order by tablename",
    );
    if (publicadas.rowCount !== 0) expect(publicadas.rows).toEqual([{ tablename: "orders" }, { tablename: "quotes" }]);
  });
});
