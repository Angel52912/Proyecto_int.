import { abrirTransaccion, actuarComo, actuarSinUsuario, asignarRol, cerrarTransaccion, crearUsuario, intentar } from "../helpers/db.js";
import { crearOrden, crearPresupuesto } from "../helpers/presupuestos.js";
import { PERMISO_DENEGADO, crearSolicitud, crearTallerPublicado } from "../helpers/solicitudes.js";

/** CU-06: reviews, create_review y el promedio del taller (flujo principal y alternos). */
describe("reseñas y calificación (CU-06)", () => {
  /** @type {import("pg").Client} */
  let c;
  let n = 0;
  const correo = () => `resena-${Date.now()}-${n++}@prueba.test`;
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

  /**
   * Orden con el estado indicado. Con `base` reutiliza el artesano y el taller (para varias reseñas del mismo taller).
   * @param {string} [status]
   * @param {{ artesano: string, taller: string }} [base]
   */
  async function escenario(status = "delivered", base) {
    const cliente = await usuarioConRol("client");
    const artesano = base?.artesano ?? (await usuarioConRol("craftsman"));
    const taller = base?.taller ?? (await crearTallerPublicado(c, artesano));
    const solicitud = await crearSolicitud(c, cliente, taller, "accepted");
    const quote = await crearPresupuesto(c, solicitud, "accepted");
    const orden = await crearOrden(c, { quote, request: solicitud, cliente, taller });
    await c.query("update public.orders set phase = 4, status = $2::public.order_status where id = $1", [orden, status]);
    return { cliente, artesano, taller, solicitud, orden };
  }

  const calificar = (
    /** @type {string} */ orden,
    /** @type {number | null} */ rating,
    /** @type {string | null} */ comentario = null,
    /** @type {string[]} */ etiquetas = [],
  ) => intentar(c, "select public.create_review($1, $2, $3, $4::text[]) as r", [orden, rating, comentario, etiquetas]);

  async function taller(/** @type {string} */ id) {
    await c.query("reset role");
    return (await c.query("select rating_avg::float as rating_avg, rating_count from public.workshops where id = $1", [id])).rows[0];
  }

  describe("create_review", () => {
    test("flujo principal: crea la reseña, recalcula el promedio y avisa al artesano", async () => {
      const { cliente, artesano, taller: tallerId, orden } = await escenario();
      await actuarComo(c, cliente);
      const r = await calificar(orden, 4, "  Quedó muy bien  ", [" Puntual ", "Buen trato"]);
      expect(r.error).toBeNull();
      expect(r.rows[0].r).toMatchObject({
        order_id: orden,
        workshop_id: tallerId,
        rating: 4,
        comment: "Quedó muy bien",
        tags: ["Puntual", "Buen trato"],
        hidden: false,
      });
      expect(await taller(tallerId)).toEqual({ rating_avg: 4, rating_count: 1 });
      await c.query("reset role");
      const avisos = await c.query("select type, payload from public.notifications where user_id = $1", [artesano]);
      expect(avisos.rows).toEqual([{ type: "review_received", payload: { order_id: orden, review_id: r.rows[0].r.id, rating: 4 } }]);
    });

    test("la reseña es opcional: comentario vacío queda nulo y sin etiquetas", async () => {
      const { cliente, orden } = await escenario();
      await actuarComo(c, cliente);
      const r = await calificar(orden, 5, "   ");
      expect(r.rows[0].r).toMatchObject({ rating: 5, comment: null, tags: [] });
    });

    test("el promedio se calcula sobre todas las reseñas del taller (1 decimal)", async () => {
      const primero = await escenario();
      const segundo = await escenario("delivered", primero);
      await actuarComo(c, primero.cliente);
      await calificar(primero.orden, 5);
      await actuarComo(c, segundo.cliente);
      await calificar(segundo.orden, 4);
      expect(await taller(primero.taller)).toEqual({ rating_avg: 4.5, rating_count: 2 });
    });

    test("sin edición: una segunda reseña del mismo pedido lanza invalid_state", async () => {
      const { cliente, taller: tallerId, orden } = await escenario();
      await actuarComo(c, cliente);
      expect((await calificar(orden, 5)).error).toBeNull();
      expect((await calificar(orden, 1)).error?.message).toContain("invalid_state");
      expect(await taller(tallerId)).toEqual({ rating_avg: 5, rating_count: 1 });
    });

    test("solo con el pedido entregado: en curso, listo o cancelado lanzan invalid_state", async () => {
      for (const estado of ["in_progress", "ready", "cancelled"]) {
        const { cliente, orden } = await escenario(estado);
        await actuarComo(c, cliente);
        expect((await calificar(orden, 5)).error?.message).toContain("invalid_state");
      }
    });

    test("estrellas, comentario o etiquetas fuera de rango: invalid_input", async () => {
      const { cliente, orden } = await escenario();
      await actuarComo(c, cliente);
      for (const rating of [0, 6, -1, null]) expect((await calificar(orden, rating)).error?.message).toContain("invalid_input");
      expect((await calificar(orden, 5, "x".repeat(1001))).error?.message).toContain("invalid_input");
      expect((await calificar(orden, 5, null, ["a", "b", "c", "d", "e", "f"])).error?.message).toContain("invalid_input");
      expect((await calificar(orden, 5, null, [""])).error?.message).toContain("invalid_input");
      expect((await calificar(orden, 5, null, ["x".repeat(31)])).error?.message).toContain("invalid_input");
      expect((await calificar(/** @type {any} */ (null), 5)).error?.message).toContain("invalid_input");
    });

    test("artesano, usuario sin rol y admin lanzan forbidden", async () => {
      const { artesano, orden } = await escenario();
      for (const uid of [artesano, await usuarioConRol(null), await usuarioConRol("admin")]) {
        await actuarComo(c, uid);
        expect((await calificar(orden, 5)).error?.message).toContain("forbidden");
      }
    });

    test("otro cliente u orden inexistente: not_found", async () => {
      const { orden } = await escenario();
      await actuarComo(c, await usuarioConRol("client"));
      expect((await calificar(orden, 5)).error?.message).toContain("not_found");
      expect((await calificar(AJENA, 5)).error?.message).toContain("not_found");
    });

    test("anónimo: permission denied; token sin usuario: not_authenticated; cliente inactivo: inactive_user", async () => {
      const { cliente, orden } = await escenario();
      await actuarComo(c, null);
      expect((await calificar(orden, 5)).error?.code).toBe(PERMISO_DENEGADO);
      await actuarSinUsuario(c);
      expect((await calificar(orden, 5)).error?.message).toContain("not_authenticated");
      await c.query("reset role");
      await c.query("update public.profiles set active = false where id = $1", [cliente]);
      await actuarComo(c, cliente);
      expect((await calificar(orden, 5)).error?.message).toContain("inactive_user");
    });
  });

  describe("tabla reviews", () => {
    async function conResena() {
      const e = await escenario();
      await actuarComo(c, e.cliente);
      const r = await calificar(e.orden, 5, "Excelente");
      return { ...e, resena: r.rows[0].r.id };
    }

    test("ven las reseñas no ocultas los clientes y artesanos activos", async () => {
      const { cliente, artesano } = await conResena();
      for (const uid of [cliente, artesano, await usuarioConRol("client"), await usuarioConRol("craftsman")]) {
        await actuarComo(c, uid);
        expect((await intentar(c, "select id from public.reviews")).rows).toHaveLength(1);
      }
    });

    test("admin, usuario sin rol y usuarios inactivos no ven nada; anónimo: permission denied", async () => {
      const { cliente } = await conResena();
      for (const uid of [await usuarioConRol("admin"), await usuarioConRol(null)]) {
        await actuarComo(c, uid);
        expect((await intentar(c, "select id from public.reviews")).rows).toEqual([]);
      }
      await c.query("reset role");
      await c.query("update public.profiles set active = false where id = $1", [cliente]);
      await actuarComo(c, cliente);
      expect((await intentar(c, "select id from public.reviews")).rows).toEqual([]);
      await actuarComo(c, null);
      expect((await intentar(c, "select id from public.reviews")).error?.code).toBe(PERMISO_DENEGADO);
    });

    test("una reseña oculta solo la ve su autor y el promedio del taller la excluye", async () => {
      const { cliente, artesano, taller: tallerId, resena } = await conResena();
      await c.query("reset role");
      await c.query("update public.reviews set hidden = true where id = $1", [resena]);
      expect(await taller(tallerId)).toEqual({ rating_avg: null, rating_count: 0 });

      await actuarComo(c, cliente);
      expect((await intentar(c, "select id from public.reviews")).rows).toHaveLength(1);
      for (const uid of [artesano, await usuarioConRol("client")]) {
        await actuarComo(c, uid);
        expect((await intentar(c, "select id from public.reviews")).rows).toEqual([]);
      }

      await c.query("reset role");
      await c.query("update public.reviews set hidden = false where id = $1", [resena]);
      expect(await taller(tallerId)).toEqual({ rating_avg: 5, rating_count: 1 });
    });

    test("sin edición ni borrado: nadie inserta, actualiza ni borra desde la API", async () => {
      const { cliente, artesano, taller: tallerId, orden } = await conResena();
      for (const uid of [cliente, artesano]) {
        await actuarComo(c, uid);
        const insertar = await intentar(c, "insert into public.reviews (order_id, client_id, workshop_id, rating) values ($1, $2, $3, 5)", [orden, cliente, tallerId]);
        expect(insertar.error?.code).toBe(PERMISO_DENEGADO);
        expect((await intentar(c, "update public.reviews set rating = 1")).error?.code).toBe(PERMISO_DENEGADO);
        expect((await intentar(c, "update public.reviews set hidden = true")).error?.code).toBe(PERMISO_DENEGADO);
        expect((await intentar(c, "delete from public.reviews")).error?.code).toBe(PERMISO_DENEGADO);
      }
    });

    test("nadie puede editar rating_avg ni rating_count del taller", async () => {
      const { artesano, taller: tallerId } = await conResena();
      await actuarComo(c, artesano);
      expect((await intentar(c, "update public.workshops set rating_avg = 5 where id = $1", [tallerId])).error?.code).toBe(PERMISO_DENEGADO);
      expect((await intentar(c, "update public.workshops set rating_count = 99 where id = $1", [tallerId])).error?.code).toBe(PERMISO_DENEGADO);
    });

    test("restricciones: una reseña por pedido, estrellas de 1 a 5 y máximo 5 etiquetas incluso como superusuario", async () => {
      const { cliente, taller: tallerId, orden } = await conResena();
      await c.query("reset role");
      const duplicada = await intentar(c, "insert into public.reviews (order_id, client_id, workshop_id, rating) values ($1, $2, $3, 5)", [orden, cliente, tallerId]);
      expect(duplicada.error?.code).toBe("23505");
      const otra = await escenario();
      await c.query("reset role");
      const rating = await intentar(c, "insert into public.reviews (order_id, client_id, workshop_id, rating) values ($1, $2, $3, 6)", [otra.orden, otra.cliente, otra.taller]);
      expect(rating.error?.code).toBe("23514");
      const etiquetas = await intentar(
        c,
        "insert into public.reviews (order_id, client_id, workshop_id, rating, tags) values ($1, $2, $3, 5, array['a','b','c','d','e','f'])",
        [otra.orden, otra.cliente, otra.taller],
      );
      expect(etiquetas.error?.code).toBe("23514");
    });

    test("RLS activo en reviews", async () => {
      await c.query("reset role");
      const { rows } = await c.query("select relrowsecurity from pg_class where oid = 'public.reviews'::regclass");
      expect(rows).toEqual([{ relrowsecurity: true }]);
    });
  });
});
