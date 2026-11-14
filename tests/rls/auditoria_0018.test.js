import { abrirTransaccion, actuarComo, asignarRol, cerrarTransaccion, crearUsuario, intentar } from "../helpers/db.js";
import { crearOrden, crearPresupuesto } from "../helpers/presupuestos.js";
import { PERMISO_DENEGADO, agregarFoto, crearSolicitud, crearTallerPublicado } from "../helpers/solicitudes.js";

/** Correcciones de la auditoría global (migración 0018). */
describe("auditoría 0018", () => {
  /** @type {import("pg").Client} */
  let c;
  let n = 0;
  const marca = () => `aud${Date.now()}x${String(n++).padStart(5, "0")}`;

  beforeAll(async () => {
    c = await abrirTransaccion();
  });

  afterAll(async () => {
    await cerrarTransaccion(c);
  });

  /** @param {"client" | "craftsman" | "admin" | null} rol */
  async function usuarioConRol(rol) {
    const uid = await crearUsuario(c, `${marca()}@prueba.test`);
    if (rol) await asignarRol(c, uid, rol);
    return uid;
  }

  /** Taller publicado con colonia única, y un cliente. */
  async function escenario() {
    const colonia = marca();
    const cliente = await usuarioConRol("client");
    const artesano = await usuarioConRol("craftsman");
    const taller = await crearTallerPublicado(c, artesano);
    await c.query("update public.workshops set colonia = $2 where id = $1", [taller, colonia]);
    return { colonia, cliente, artesano, taller };
  }

  const buscar = (/** @type {string} */ colonia) =>
    intentar(c, "select public.search_workshops(null, null, null, null, $1) as r", [colonia]);
  const desactivar = async (/** @type {string} */ uid) => {
    await c.query("reset role");
    await c.query("update public.profiles set active = false where id = $1", [uid]);
  };

  describe("1. un artesano desactivado sale del mapa y de las solicitudes", () => {
    test("search_workshops, get_workshop_profile y la lectura directa dejan de verlo; al reactivarlo vuelve", async () => {
      const e = await escenario();
      await actuarComo(c, e.cliente);
      expect((await buscar(e.colonia)).rows[0].r).toHaveLength(1);
      expect((await intentar(c, "select public.get_workshop_profile($1) as r", [e.taller])).error).toBeNull();
      expect((await intentar(c, "select id from public.workshops where id = $1", [e.taller])).rows).toHaveLength(1);

      await desactivar(e.artesano);
      await actuarComo(c, e.cliente);
      expect((await buscar(e.colonia)).rows[0].r).toEqual([]);
      expect((await intentar(c, "select public.get_workshop_profile($1) as r", [e.taller])).error?.message).toContain("not_found");
      expect((await intentar(c, "select id from public.workshops where id = $1", [e.taller])).rows).toEqual([]);

      await c.query("reset role");
      await c.query("update public.profiles set active = true where id = $1", [e.artesano]);
      await actuarComo(c, e.cliente);
      expect((await buscar(e.colonia)).rows[0].r).toHaveLength(1);
    });

    test("una solicitud en borrador a ese taller ya no se puede enviar (invalid_state)", async () => {
      const e = await escenario();
      const solicitud = await crearSolicitud(c, e.cliente, e.taller, "draft");
      await agregarFoto(c, solicitud);
      await desactivar(e.artesano);
      await actuarComo(c, e.cliente);
      expect((await intentar(c, "select public.submit_request($1) as r", [solicitud])).error?.message).toContain("invalid_state");
    });

    test("el cliente tampoco puede crear un borrador nuevo hacia ese taller", async () => {
      const e = await escenario();
      await desactivar(e.artesano);
      await actuarComo(c, e.cliente);
      const r = await intentar(
        c,
        "insert into public.service_requests (workshop_id, service_type, description) values ($1, 'repair', 'Suela') returning id",
        [e.taller],
      );
      expect(r.error?.code === PERMISO_DENEGADO || r.error?.code === "42501" || r.rowCount === 0).toBe(true);
    });

    test("integración: el admin desactiva al artesano y su taller sale del mapa", async () => {
      const e = await escenario();
      const admin = await usuarioConRol("admin");
      await actuarComo(c, admin);
      expect((await intentar(c, "select public.admin_set_user_active($1, false, 'Prueba') as r", [e.artesano])).error).toBeNull();
      await actuarComo(c, e.cliente);
      expect((await buscar(e.colonia)).rows[0].r).toEqual([]);
    });

    test("el artesano desactivado no ve su propio taller por el mapa, pero el taller sigue existiendo", async () => {
      const e = await escenario();
      await desactivar(e.artesano);
      await c.query("reset role");
      expect((await c.query("select published, suspended from public.workshops where id = $1", [e.taller])).rows).toEqual([{ published: true, suspended: false }]);
    });
  });

  describe("2. recálculo del promedio del taller", () => {
    const calificar = async (/** @type {string} */ taller, /** @type {string} */ cliente, /** @type {number} */ rating) => {
      await c.query("reset role");
      const solicitud = await crearSolicitud(c, cliente, taller, "accepted");
      const quote = await crearPresupuesto(c, solicitud, "accepted");
      const orden = await crearOrden(c, { quote, request: solicitud, cliente, taller });
      await c.query("update public.orders set status = 'delivered', phase = 4 where id = $1", [orden]);
      return (
        await c.query("insert into public.reviews (order_id, client_id, workshop_id, rating) values ($1, $2, $3, $4) returning id", [orden, cliente, taller, rating])
      ).rows[0].id;
    };

    test("el promedio y el conteo siguen correctos al crear y ocultar reseñas", async () => {
      const e = await escenario();
      const segundo = await usuarioConRol("client");
      const a = await calificar(e.taller, e.cliente, 5);
      await calificar(e.taller, segundo, 4);
      const leer = async () => (await c.query("select rating_avg::float as avg, rating_count from public.workshops where id = $1", [e.taller])).rows[0];
      expect(await leer()).toEqual({ avg: 4.5, rating_count: 2 });
      await c.query("update public.reviews set hidden = true where id = $1", [a]);
      expect(await leer()).toEqual({ avg: 4, rating_count: 1 });
    });

    test("la función del trigger bloquea la fila del taller antes de recalcular", async () => {
      await c.query("reset role");
      const { rows } = await c.query("select prosrc from pg_proc where proname = 'recalc_workshop_rating' and pronamespace = 'private'::regnamespace");
      expect(rows).toHaveLength(1);
      expect(rows[0].prosrc).toMatch(/for update/i);
    });
  });

  describe("3. reseñas: sin client_id y visibilidad por taller visible", () => {
    /** Reseña de un cliente en un taller nuevo. */
    async function conResena() {
      const e = await escenario();
      const solicitud = await crearSolicitud(c, e.cliente, e.taller, "accepted");
      const quote = await crearPresupuesto(c, solicitud, "accepted");
      const orden = await crearOrden(c, { quote, request: solicitud, cliente: e.cliente, taller: e.taller });
      await c.query("update public.orders set status = 'delivered', phase = 4 where id = $1", [orden]);
      const resena = (
        await c.query("insert into public.reviews (order_id, client_id, workshop_id, rating, comment) values ($1, $2, $3, 5, 'Excelente') returning id", [orden, e.cliente, e.taller])
      ).rows[0].id;
      return { ...e, orden, resena };
    }
    const ver = (/** @type {string} */ id) => intentar(c, "select id from public.reviews where id = $1", [id]);

    test("ninguna cuenta de la API puede leer client_id ni usar select *", async () => {
      const e = await conResena();
      for (const uid of [e.cliente, e.artesano, await usuarioConRol("client"), await usuarioConRol("craftsman")]) {
        await actuarComo(c, uid);
        expect((await intentar(c, "select client_id from public.reviews")).error?.code).toBe(PERMISO_DENEGADO);
        expect((await intentar(c, "select * from public.reviews")).error?.code).toBe(PERMISO_DENEGADO);
        expect((await intentar(c, "select id, order_id, workshop_id, rating, tags, comment, hidden, created_at from public.reviews where id = $1", [e.resena])).error).toBeNull();
      }
    });

    test("otros clientes y artesanos la ven solo si el taller es visible (publicado, no suspendido y con dueño activo)", async () => {
      const e = await conResena();
      const otroCliente = await usuarioConRol("client");
      const competidor = await usuarioConRol("craftsman");
      for (const uid of [otroCliente, competidor]) {
        await actuarComo(c, uid);
        expect((await ver(e.resena)).rows).toHaveLength(1);
      }
      for (const cambio of [
        "update public.workshops set published = false where id = $1",
        "update public.workshops set suspended = true where id = $1",
      ]) {
        await c.query("reset role");
        await c.query(cambio, [e.taller]);
        for (const uid of [otroCliente, competidor]) {
          await actuarComo(c, uid);
          expect((await ver(e.resena)).rows).toEqual([]);
        }
        await c.query("reset role");
        await c.query("update public.workshops set published = true, suspended = false where id = $1", [e.taller]);
      }
      await desactivar(e.artesano);
      for (const uid of [otroCliente, competidor]) {
        await actuarComo(c, uid);
        expect((await ver(e.resena)).rows).toEqual([]);
      }
    });

    test("el autor la ve siempre (aunque esté oculta o el taller suspendido) y el artesano dueño la ve si no está oculta", async () => {
      const e = await conResena();
      await c.query("update public.workshops set suspended = true where id = $1", [e.taller]);
      await actuarComo(c, e.cliente);
      expect((await ver(e.resena)).rows).toHaveLength(1);
      await actuarComo(c, e.artesano);
      expect((await ver(e.resena)).rows).toHaveLength(1); // su propio taller, aunque esté suspendido
      await c.query("reset role");
      await c.query("update public.reviews set hidden = true where id = $1", [e.resena]);
      await actuarComo(c, e.cliente);
      expect((await ver(e.resena)).rows).toHaveLength(1);
      await actuarComo(c, e.artesano);
      expect((await ver(e.resena)).rows).toEqual([]);
    });

    test("admin, usuario sin rol, usuarios inactivos y anónimo no la ven", async () => {
      const e = await conResena();
      for (const uid of [await usuarioConRol("admin"), await usuarioConRol(null)]) {
        await actuarComo(c, uid);
        expect((await ver(e.resena)).rows).toEqual([]);
      }
      await desactivar(e.cliente);
      await actuarComo(c, e.cliente);
      expect((await ver(e.resena)).rows).toEqual([]);
      await actuarComo(c, null);
      expect((await ver(e.resena)).error?.code).toBe(PERMISO_DENEGADO);
    });

    test("getOrderReview sigue funcionando: el cliente busca su reseña por order_id", async () => {
      const e = await conResena();
      await actuarComo(c, e.cliente);
      const r = await intentar(c, "select id, order_id, rating from public.reviews where order_id = $1", [e.orden]);
      expect(r.rows).toEqual([{ id: e.resena, order_id: e.orden, rating: 5 }]);
    });
  });

  describe("4. respond_quote con el taller no disponible", () => {
    /** Solicitud `quoted` con un presupuesto vigente. */
    async function cotizada() {
      const e = await escenario();
      const solicitud = await crearSolicitud(c, e.cliente, e.taller, "quoted");
      const quote = await crearPresupuesto(c, solicitud, "sent");
      return { ...e, solicitud, quote };
    }
    const responder = (/** @type {string} */ quote, /** @type {boolean} */ aceptar) =>
      intentar(c, "select public.respond_quote($1, $2) as r", [quote, aceptar]);
    async function ordenes(/** @type {string} */ solicitud) {
      await c.query("reset role");
      return (await c.query("select count(*)::int as n from public.orders where request_id = $1", [solicitud])).rows[0].n;
    }

    test("con el taller suspendido no se acepta (invalid_state), no se crea la orden y el presupuesto sigue vigente", async () => {
      const e = await cotizada();
      await c.query("update public.workshops set suspended = true where id = $1", [e.taller]);
      await actuarComo(c, e.cliente);
      expect((await responder(e.quote, true)).error?.message).toContain("invalid_state");
      expect(await ordenes(e.solicitud)).toBe(0);
      await c.query("reset role");
      expect((await c.query("select status from public.quotes where id = $1", [e.quote])).rows).toEqual([{ status: "sent" }]);
    });

    test("con el artesano desactivado tampoco se acepta", async () => {
      const e = await cotizada();
      await desactivar(e.artesano);
      await actuarComo(c, e.cliente);
      expect((await responder(e.quote, true)).error?.message).toContain("invalid_state");
      expect(await ordenes(e.solicitud)).toBe(0);
    });

    test("rechazar sí se puede aunque el taller no esté disponible", async () => {
      const e = await cotizada();
      await c.query("update public.workshops set suspended = true where id = $1", [e.taller]);
      await actuarComo(c, e.cliente);
      const r = await responder(e.quote, false);
      expect(r.error).toBeNull();
      expect(r.rows[0].r).toMatchObject({ status: "rejected", order_id: null });
    });

    test("con el taller disponible aceptar sigue creando la orden", async () => {
      const e = await cotizada();
      await actuarComo(c, e.cliente);
      const r = await responder(e.quote, true);
      expect(r.error).toBeNull();
      expect(r.rows[0].r).toMatchObject({ status: "accepted" });
      expect(await ordenes(e.solicitud)).toBe(1);
    });
  });

  test("grants: private.workshop_owner_active y private.can_read_review no son ejecutables por anon", async () => {
    await c.query("reset role");
    const { rows } = await c.query(
      `select has_function_privilege('anon', 'private.workshop_owner_active(uuid)', 'execute') as a1,
              has_function_privilege('anon', 'private.can_read_review(uuid)', 'execute') as a2,
              has_function_privilege('authenticated', 'private.can_read_review(uuid)', 'execute') as u2`,
    );
    expect(rows[0]).toEqual({ a1: false, a2: false, u2: true });
  });
});
