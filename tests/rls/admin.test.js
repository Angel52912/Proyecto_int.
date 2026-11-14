import { abrirTransaccion, actuarComo, actuarSinUsuario, asignarRol, cerrarTransaccion, crearUsuario, intentar } from "../helpers/db.js";
import { crearOrden, crearPresupuesto } from "../helpers/presupuestos.js";
import { PERMISO_DENEGADO, crearSolicitud, crearTallerPublicado } from "../helpers/solicitudes.js";

/** CU-08: admin_actions y las funciones admin_* (flujo principal, A1 y roles). */
describe("administración (CU-08)", () => {
  /** @type {import("pg").Client} */
  let c;
  let n = 0;
  const AJENA = "99999999-9999-4999-8999-999999999999";
  // Ancho fijo: una marca nunca es prefijo de otra (las búsquedas son por subcadena).
  const marca = () => `adm${Date.now()}x${String(n++).padStart(5, "0")}`;
  const correo = () => `${marca()}@prueba.test`;

  beforeAll(async () => {
    c = await abrirTransaccion();
  });

  afterAll(async () => {
    await cerrarTransaccion(c);
  });

  /** @param {"client" | "craftsman" | "admin" | null} rol @param {string} [nombre] */
  async function usuarioConRol(rol, nombre) {
    const uid = await crearUsuario(c, correo());
    if (rol) await asignarRol(c, uid, rol);
    if (nombre) await c.query("update public.profiles set full_name = $2 where id = $1", [uid, nombre]);
    return uid;
  }

  /** Llama a una función de public como el usuario actual. */
  const llamar = (/** @type {string} */ funcion, /** @type {unknown[]} */ args = []) =>
    intentar(c, `select public.${funcion}(${args.map((_, i) => `$${i + 1}`).join(", ")}) as r`, args);

  async function contarAcciones(/** @type {string} */ admin) {
    await c.query("reset role");
    return (await c.query("select count(*)::int as n from public.admin_actions where admin_id = $1", [admin])).rows[0].n;
  }

  /** Cliente, artesano, taller con nombre único, solicitud aceptada, orden y reseña. */
  async function escenario() {
    const token = marca();
    const cliente = await usuarioConRol("client", `Cliente ${token}`);
    const artesano = await usuarioConRol("craftsman", `Artesano ${token}`);
    const taller = await crearTallerPublicado(c, artesano);
    await c.query("update public.workshops set name = $2, colonia = $3 where id = $1", [taller, `Taller ${token}`, `Colonia ${token}`]);
    const solicitud = await crearSolicitud(c, cliente, taller, "accepted");
    const quote = await crearPresupuesto(c, solicitud, "accepted");
    const orden = await crearOrden(c, { quote, request: solicitud, cliente, taller });
    await c.query("update public.orders set status = 'delivered', phase = 4 where id = $1", [orden]);
    const resena = (
      await c.query(
        "insert into public.reviews (order_id, client_id, workshop_id, rating, comment) values ($1, $2, $3, 4, 'Buen trabajo') returning id",
        [orden, cliente, taller],
      )
    ).rows[0].id;
    return { token, cliente, artesano, taller, solicitud, orden, resena };
  }

  /** Las llamadas de cada función admin_* (con ids ajenos: solo importa si pasa o no el control de acceso). */
  const todasLasFunciones = () => [
    ["admin_dashboard", []],
    ["admin_list_users", []],
    ["admin_set_user_active", [AJENA, false]],
    ["admin_list_workshops", []],
    ["admin_set_workshop_suspended", [AJENA, true]],
    ["admin_list_reviews", []],
    ["admin_set_review_hidden", [AJENA, true]],
    ["admin_list_requests", []],
    ["admin_list_orders", []],
    ["admin_list_actions", []],
  ];

  describe("acceso: solo el admin activo", () => {
    test("cliente, artesano y usuario sin rol: forbidden en todas las funciones", async () => {
      for (const rol of ["client", "craftsman", null]) {
        await actuarComo(c, await usuarioConRol(/** @type {any} */ (rol)));
        for (const [funcion, args] of todasLasFunciones()) {
          expect((await llamar(String(funcion), /** @type {unknown[]} */ (args))).error?.message).toContain("forbidden");
        }
      }
    });

    test("admin inactivo: inactive_user", async () => {
      const inactivo = await usuarioConRol("admin");
      await c.query("update public.profiles set active = false where id = $1", [inactivo]);
      await actuarComo(c, inactivo);
      for (const [funcion, args] of todasLasFunciones()) {
        expect((await llamar(String(funcion), /** @type {unknown[]} */ (args))).error?.message).toContain("inactive_user");
      }
    });

    test("anónimo: permission denied; token sin usuario: not_authenticated", async () => {
      await actuarComo(c, null);
      for (const [funcion, args] of todasLasFunciones()) {
        expect((await llamar(String(funcion), /** @type {unknown[]} */ (args))).error?.code).toBe(PERMISO_DENEGADO);
      }
      await actuarSinUsuario(c);
      for (const [funcion, args] of todasLasFunciones()) {
        expect((await llamar(String(funcion), /** @type {unknown[]} */ (args))).error?.message).toContain("not_authenticated");
      }
    });

    test("las acciones denegadas no escriben la bitácora ni cambian datos", async () => {
      const e = await escenario();
      const cliente = await usuarioConRol("client");
      await actuarComo(c, cliente);
      await llamar("admin_set_user_active", [e.cliente, false]);
      await llamar("admin_set_workshop_suspended", [e.taller, true]);
      await llamar("admin_set_review_hidden", [e.resena, true]);
      await c.query("reset role");
      expect((await c.query("select count(*)::int as n from public.admin_actions where target_id in ($1, $2, $3)", [e.cliente, e.taller, e.resena])).rows[0].n).toBe(0);
      const estado = await c.query("select (select active from public.profiles where id = $1) as u, (select suspended from public.workshops where id = $2) as t, (select hidden from public.reviews where id = $3) as r", [e.cliente, e.taller, e.resena]);
      expect(estado.rows[0]).toEqual({ u: true, t: false, r: false });
    });

    test("grants: anon no ejecuta ninguna función admin_*; authenticated sí", async () => {
      await c.query("reset role");
      const { rows } = await c.query(
        `select p.oid::regprocedure::text as funcion,
                has_function_privilege('anon', p.oid, 'execute') as anon,
                has_function_privilege('authenticated', p.oid, 'execute') as auth
           from pg_proc p join pg_namespace n on n.oid = p.pronamespace
          where n.nspname = 'public' and p.proname like 'admin\\_%'`,
      );
      expect(rows).toHaveLength(10);
      for (const fila of rows) expect({ funcion: fila.funcion, anon: fila.anon, auth: fila.auth }).toEqual({ funcion: fila.funcion, anon: false, auth: true });
    });
  });

  describe("tabla admin_actions", () => {
    test("RLS activo; ningún rol de la API la lee ni la escribe, ni siquiera el admin", async () => {
      await c.query("reset role");
      expect((await c.query("select relrowsecurity from pg_class where oid = 'public.admin_actions'::regclass")).rows).toEqual([{ relrowsecurity: true }]);
      const admin = await usuarioConRol("admin");
      for (const uid of [admin, await usuarioConRol("client"), await usuarioConRol("craftsman"), await usuarioConRol(null), null]) {
        await actuarComo(c, uid);
        expect((await intentar(c, "select * from public.admin_actions")).error?.code).toBe(PERMISO_DENEGADO);
        const insertar = await intentar(c, "insert into public.admin_actions (admin_id, action, target_table, target_id) values ($1, 'x', 'x', $1)", [admin]);
        expect(insertar.error?.code).toBe(PERMISO_DENEGADO);
        expect((await intentar(c, "update public.admin_actions set action = 'y'")).error?.code).toBe(PERMISO_DENEGADO);
        expect((await intentar(c, "delete from public.admin_actions")).error?.code).toBe(PERMISO_DENEGADO);
      }
    });

    test("append-only: UPDATE, DELETE y TRUNCATE fallan incluso como superusuario", async () => {
      const admin = await usuarioConRol("admin");
      await c.query("reset role");
      const fila = (
        await c.query("insert into public.admin_actions (admin_id, action, target_table, target_id) values ($1, 'prueba', 'profiles', $1) returning id", [admin])
      ).rows[0].id;
      expect((await intentar(c, "update public.admin_actions set action = 'otra' where id = $1", [fila])).error?.message).toContain("append_only");
      expect((await intentar(c, "delete from public.admin_actions where id = $1", [fila])).error?.message).toContain("append_only");
      expect((await intentar(c, "truncate public.admin_actions")).error?.message).toContain("append_only");
    });
  });

  describe("admin_dashboard", () => {
    test("devuelve los totales y suben al crear datos (se compara contra el estado previo)", async () => {
      const admin = await usuarioConRol("admin");
      await actuarComo(c, admin);
      const antes = (await llamar("admin_dashboard")).rows[0].r;
      expect(Object.keys(antes).sort()).toEqual(["orders", "requests", "reviews", "users", "workshops"]);
      expect(Object.keys(antes.users).sort()).toEqual(["active", "admins", "clients", "craftsmen", "total", "without_role"]);

      await escenario();
      await actuarComo(c, admin);
      const despues = (await llamar("admin_dashboard")).rows[0].r;
      expect(despues.users.total).toBe(antes.users.total + 2);
      expect(despues.users.clients).toBe(antes.users.clients + 1);
      expect(despues.users.craftsmen).toBe(antes.users.craftsmen + 1);
      expect(despues.workshops.total).toBe(antes.workshops.total + 1);
      expect(despues.workshops.published).toBe(antes.workshops.published + 1);
      expect(despues.requests.total).toBe(antes.requests.total + 1);
      expect(despues.requests.accepted).toBe(antes.requests.accepted + 1);
      expect(despues.orders.delivered).toBe(antes.orders.delivered + 1);
      expect(despues.reviews.count).toBe(antes.reviews.count + 1);
    });

    test("los borradores no cuentan como solicitudes y las reseñas ocultas no cuentan en el promedio", async () => {
      const admin = await usuarioConRol("admin");
      const e = await escenario();
      await actuarComo(c, admin);
      const antes = (await llamar("admin_dashboard")).rows[0].r;
      await crearSolicitud(c, await usuarioConRol("client"), await crearTallerPublicado(c, await usuarioConRol("craftsman")), "draft");
      await actuarComo(c, admin);
      expect((await llamar("admin_dashboard")).rows[0].r.requests.total).toBe(antes.requests.total);
      await llamar("admin_set_review_hidden", [e.resena, true]);
      expect((await llamar("admin_dashboard")).rows[0].r.reviews.count).toBe(antes.reviews.count - 1);
    });
  });

  describe("usuarios", () => {
    test("lista con total y paginación; busca por nombre o correo; no expone datos privados", async () => {
      const admin = await usuarioConRol("admin");
      const e = await escenario();
      await actuarComo(c, admin);
      const r = await llamar("admin_list_users", [e.token]);
      expect(r.error).toBeNull();
      expect(r.rows[0].r.total).toBe(2);
      expect(r.rows[0].r.items.map((/** @type {{ id: string }} */ u) => u.id).sort()).toEqual([e.cliente, e.artesano].sort());
      expect(Object.keys(r.rows[0].r.items[0]).sort()).toEqual(["active", "created_at", "email", "full_name", "id", "role"]);

      const pagina = await llamar("admin_list_users", [e.token, null, null, 1, 1]);
      expect(pagina.rows[0].r.total).toBe(2);
      expect(pagina.rows[0].r.items).toHaveLength(1);
      const porCorreo = await llamar("admin_list_users", [(await c.query("select email from auth.users where id = $1", [e.cliente])).rows[0].email.toUpperCase()]);
      expect(porCorreo.rows[0].r.items.map((/** @type {{ id: string }} */ u) => u.id)).toEqual([e.cliente]);
    });

    test("filtra por rol y estado; el comodín % y _ se toma literal", async () => {
      const admin = await usuarioConRol("admin");
      const e = await escenario();
      await c.query("update public.profiles set active = false where id = $1", [e.artesano]);
      await actuarComo(c, admin);
      expect((await llamar("admin_list_users", [e.token, "craftsman"])).rows[0].r.total).toBe(1);
      expect((await llamar("admin_list_users", [e.token, null, false])).rows[0].r.items.map((/** @type {{ id: string }} */ u) => u.id)).toEqual([e.artesano]);
      for (const comodin of ["%", "_", "\\"]) {
        const r = await llamar("admin_list_users", [comodin]);
        expect(r.rows[0].r.items.map((/** @type {{ id: string }} */ u) => u.id)).not.toContain(e.cliente);
      }
    });

    test("desactivar y reactivar: cambia el estado, escribe la bitácora con el motivo y no elimina al usuario", async () => {
      const admin = await usuarioConRol("admin");
      const e = await escenario();
      await actuarComo(c, admin);
      const r = await llamar("admin_set_user_active", [e.cliente, false, "  Reportes de abuso  "]);
      expect(r.error).toBeNull();
      expect(r.rows[0].r).toEqual({ id: e.cliente, active: false });
      await c.query("reset role");
      expect((await c.query("select active from public.profiles where id = $1", [e.cliente])).rows).toEqual([{ active: false }]);
      const bitacora = await c.query("select admin_id, action, target_table, target_id, details from public.admin_actions where target_id = $1", [e.cliente]);
      expect(bitacora.rows).toEqual([
        { admin_id: admin, action: "user_deactivated", target_table: "profiles", target_id: e.cliente, details: { role: "client", previous_active: true, reason: "Reportes de abuso" } },
      ]);

      await actuarComo(c, admin);
      expect((await llamar("admin_set_user_active", [e.cliente, true])).rows[0].r).toEqual({ id: e.cliente, active: true });
      await c.query("reset role");
      expect((await c.query("select action from public.admin_actions where target_id = $1 order by action", [e.cliente])).rows.map((x) => x.action)).toEqual(["user_deactivated", "user_reactivated"]);
    });

    test("el usuario desactivado ya no puede usar las funciones de la app", async () => {
      const admin = await usuarioConRol("admin");
      const e = await escenario();
      await actuarComo(c, admin);
      await llamar("admin_set_user_active", [e.cliente, false]);
      await actuarComo(c, e.cliente);
      expect((await llamar("search_workshops")).error?.message).toContain("inactive_user");
    });

    test("A1: el admin no puede desactivarse a sí mismo (forbidden) y no queda registrado", async () => {
      const admin = await usuarioConRol("admin");
      await actuarComo(c, admin);
      const antes = await contarAcciones(admin);
      await actuarComo(c, admin);
      expect((await llamar("admin_set_user_active", [admin, false])).error?.message).toContain("forbidden");
      expect(await contarAcciones(admin)).toBe(antes);
      await c.query("reset role");
      expect((await c.query("select active from public.profiles where id = $1", [admin])).rows).toEqual([{ active: true }]);
    });

    test("A1: un admin puede desactivar a otro, y el desactivado ya no puede actuar ni desactivar al primero", async () => {
      const a = await usuarioConRol("admin");
      const b = await usuarioConRol("admin");
      await actuarComo(c, a);
      expect((await llamar("admin_set_user_active", [b, false])).error).toBeNull();
      await actuarComo(c, b);
      expect((await llamar("admin_set_user_active", [a, false])).error?.message).toContain("inactive_user");
      await c.query("reset role");
      expect((await c.query("select active from public.profiles where id = $1", [a])).rows).toEqual([{ active: true }]);
      expect((await c.query("select count(*)::int as n from public.profiles where role = 'admin' and active")).rows[0].n).toBeGreaterThanOrEqual(1);
    });

    test("mismo estado: invalid_state; inexistente: not_found; datos inválidos: invalid_input", async () => {
      const admin = await usuarioConRol("admin");
      const e = await escenario();
      await actuarComo(c, admin);
      expect((await llamar("admin_set_user_active", [e.cliente, true])).error?.message).toContain("invalid_state");
      expect((await llamar("admin_set_user_active", [AJENA, false])).error?.message).toContain("not_found");
      expect((await llamar("admin_set_user_active", [null, false])).error?.message).toContain("invalid_input");
      expect((await llamar("admin_set_user_active", [e.cliente, null])).error?.message).toContain("invalid_input");
      expect((await llamar("admin_set_user_active", [e.cliente, false, "x".repeat(301)])).error?.message).toContain("invalid_input");
    });
  });

  describe("talleres", () => {
    test("lista con el dueño y filtros; busca por nombre del taller, colonia o dueño", async () => {
      const admin = await usuarioConRol("admin");
      const e = await escenario();
      await actuarComo(c, admin);
      for (const texto of [`Taller ${e.token}`, `Colonia ${e.token}`, `Artesano ${e.token}`]) {
        const r = await llamar("admin_list_workshops", [texto]);
        expect(r.rows[0].r.total).toBe(1);
        expect(r.rows[0].r.items[0]).toMatchObject({ id: e.taller, owner_id: e.artesano, owner_name: `Artesano ${e.token}`, published: true, suspended: false });
      }
      expect(Object.keys((await llamar("admin_list_workshops", [e.token])).rows[0].r.items[0]).sort()).toEqual(
        ["colonia", "created_at", "id", "name", "owner_id", "owner_name", "published", "rating_avg", "rating_count", "services", "suspended"].sort(),
      );
      expect((await llamar("admin_list_workshops", [e.token, false])).rows[0].r.total).toBe(0);
      expect((await llamar("admin_list_workshops", [e.token, true, false])).rows[0].r.total).toBe(1);
    });

    test("suspender: sale del mapa, avisa al dueño y queda en la bitácora; reactivar lo devuelve", async () => {
      const admin = await usuarioConRol("admin");
      const e = await escenario();
      const cliente = await usuarioConRol("client");
      await actuarComo(c, cliente);
      const visible = async () => (await llamar("search_workshops", [null, null, null, null, e.token])).rows[0].r.length;
      expect(await visible()).toBe(1);

      await actuarComo(c, admin);
      const r = await llamar("admin_set_workshop_suspended", [e.taller, true, "Fraude"]);
      expect(r.error).toBeNull();
      expect(r.rows[0].r).toEqual({ id: e.taller, suspended: true });
      await actuarComo(c, cliente);
      expect(await visible()).toBe(0);

      await c.query("reset role");
      const aviso = await c.query("select type, payload from public.notifications where user_id = $1", [e.artesano]);
      expect(aviso.rows).toEqual([{ type: "workshop_suspended", payload: { workshop_id: e.taller } }]);
      const bitacora = await c.query("select admin_id, action, details from public.admin_actions where target_id = $1", [e.taller]);
      expect(bitacora.rows).toEqual([{ admin_id: admin, action: "workshop_suspended", details: { owner_id: e.artesano, published: true, reason: "Fraude" } }]);

      await actuarComo(c, admin);
      expect((await llamar("admin_set_workshop_suspended", [e.taller, false])).rows[0].r).toEqual({ id: e.taller, suspended: false });
      await actuarComo(c, cliente);
      expect(await visible()).toBe(1);
    });

    test("mismo estado: invalid_state; inexistente: not_found; datos inválidos: invalid_input", async () => {
      const admin = await usuarioConRol("admin");
      const e = await escenario();
      await actuarComo(c, admin);
      expect((await llamar("admin_set_workshop_suspended", [e.taller, false])).error?.message).toContain("invalid_state");
      expect((await llamar("admin_set_workshop_suspended", [AJENA, true])).error?.message).toContain("not_found");
      expect((await llamar("admin_set_workshop_suspended", [null, true])).error?.message).toContain("invalid_input");
      expect((await llamar("admin_set_workshop_suspended", [e.taller, null])).error?.message).toContain("invalid_input");
    });
  });

  describe("reseñas", () => {
    test("lista con el comentario y filtros", async () => {
      const admin = await usuarioConRol("admin");
      const e = await escenario();
      await actuarComo(c, admin);
      const r = await llamar("admin_list_reviews", [e.taller]);
      expect(r.rows[0].r.total).toBe(1);
      expect(r.rows[0].r.items[0]).toMatchObject({ id: e.resena, workshop_id: e.taller, client_id: e.cliente, rating: 4, comment: "Buen trabajo", hidden: false, workshop_name: `Taller ${e.token}` });
      expect((await llamar("admin_list_reviews", [e.taller, true])).rows[0].r.total).toBe(0);
    });

    test("ocultar recalcula el promedio del taller; restaurar lo devuelve; queda en la bitácora", async () => {
      const admin = await usuarioConRol("admin");
      const e = await escenario();
      await c.query("update public.workshops set rating_avg = 4, rating_count = 1 where id = $1", [e.taller]);
      await actuarComo(c, admin);
      const oculta = await llamar("admin_set_review_hidden", [e.resena, true, "Insultos"]);
      expect(oculta.error).toBeNull();
      expect(oculta.rows[0].r).toEqual({ id: e.resena, hidden: true, workshop_id: e.taller, rating_avg: null, rating_count: 0 });
      const restaurada = await llamar("admin_set_review_hidden", [e.resena, false]);
      expect(restaurada.rows[0].r).toMatchObject({ hidden: false, rating_avg: 4, rating_count: 1 });
      await c.query("reset role");
      expect((await c.query("select action from public.admin_actions where target_id = $1 order by action", [e.resena])).rows.map((x) => x.action)).toEqual(["review_hidden", "review_restored"]);
    });

    test("una reseña oculta deja de verla el artesano y solo la ve su autor", async () => {
      const admin = await usuarioConRol("admin");
      const e = await escenario();
      await actuarComo(c, admin);
      await llamar("admin_set_review_hidden", [e.resena, true]);
      await actuarComo(c, e.artesano);
      expect((await intentar(c, "select id from public.reviews where id = $1", [e.resena])).rows).toEqual([]);
      await actuarComo(c, e.cliente);
      expect((await intentar(c, "select id from public.reviews where id = $1", [e.resena])).rows).toHaveLength(1);
    });

    test("mismo estado: invalid_state; inexistente: not_found; datos inválidos: invalid_input", async () => {
      const admin = await usuarioConRol("admin");
      const e = await escenario();
      await actuarComo(c, admin);
      expect((await llamar("admin_set_review_hidden", [e.resena, false])).error?.message).toContain("invalid_state");
      expect((await llamar("admin_set_review_hidden", [AJENA, true])).error?.message).toContain("not_found");
      expect((await llamar("admin_set_review_hidden", [null, true])).error?.message).toContain("invalid_input");
      expect((await llamar("admin_set_review_hidden", [e.resena, null])).error?.message).toContain("invalid_input");
    });
  });

  describe("solicitudes y pedidos: solo lectura", () => {
    test("solicitudes: estatus y fechas; sin descripción; los borradores no se listan", async () => {
      const admin = await usuarioConRol("admin");
      const e = await escenario();
      const borrador = await crearSolicitud(c, await usuarioConRol("client"), await crearTallerPublicado(c, await usuarioConRol("craftsman")), "draft");
      await actuarComo(c, admin);
      const r = await llamar("admin_list_requests", [null, 100]);
      expect(r.error).toBeNull();
      const items = r.rows[0].r.items;
      expect(items.map((/** @type {{ id: string }} */ s) => s.id)).toContain(e.solicitud);
      expect(items.map((/** @type {{ id: string }} */ s) => s.id)).not.toContain(borrador);
      expect(Object.keys(items[0]).sort()).toEqual(["client_id", "created_at", "id", "service_type", "status", "submitted_at", "updated_at", "workshop_id", "workshop_name"]);
      const aceptadas = await llamar("admin_list_requests", ["accepted", 100]);
      expect(aceptadas.rows[0].r.items.every((/** @type {{ status: string }} */ s) => s.status === "accepted")).toBe(true);
      expect((await llamar("admin_list_requests", ["draft"])).error?.message).toContain("invalid_input");
    });

    test("pedidos: fase, estatus y fechas; sin montos, fotos de avance ni PIN", async () => {
      const admin = await usuarioConRol("admin");
      const e = await escenario();
      await actuarComo(c, admin);
      const r = await llamar("admin_list_orders", ["delivered", 100]);
      expect(r.error).toBeNull();
      const item = r.rows[0].r.items.find((/** @type {{ id: string }} */ o) => o.id === e.orden);
      expect(item).toMatchObject({ id: e.orden, request_id: e.solicitud, phase: 4, status: "delivered", workshop_name: `Taller ${e.token}` });
      expect(Object.keys(item).sort()).toEqual(
        ["client_id", "created_at", "delivered_at", "due_date", "id", "phase", "ready_at", "request_id", "status", "updated_at", "workshop_id", "workshop_name"].sort(),
      );
    });

    test("el admin no puede leer las tablas de solicitudes, pedidos, mensajes ni fotos directamente", async () => {
      const admin = await usuarioConRol("admin");
      await escenario();
      await actuarComo(c, admin);
      for (const tabla of ["service_requests", "orders", "messages", "request_photos", "order_updates", "quotes", "client_private"]) {
        const r = await intentar(c, `select * from public.${tabla}`);
        expect(r.error?.code === PERMISO_DENEGADO || r.rows.length === 0).toBe(true);
      }
    });
  });

  describe("bitácora", () => {
    test("registra quién, qué y cuándo; filtra por admin y por acción", async () => {
      const admin = await usuarioConRol("admin");
      const otro = await usuarioConRol("admin");
      const e = await escenario();
      await actuarComo(c, admin);
      await llamar("admin_set_workshop_suspended", [e.taller, true]);
      await llamar("admin_set_review_hidden", [e.resena, true]);
      const r = await llamar("admin_list_actions", [admin]);
      expect(r.error).toBeNull();
      expect(r.rows[0].r.total).toBe(2);
      expect(r.rows[0].r.items.map((/** @type {{ action: string }} */ a) => a.action).sort()).toEqual(["review_hidden", "workshop_suspended"]);
      expect(r.rows[0].r.items[0]).toMatchObject({ admin_id: admin, target_id: expect.any(String), target_table: expect.any(String) });
      expect(r.rows[0].r.items[0].created_at).toBeTruthy();
      expect((await llamar("admin_list_actions", [admin, "review_hidden"])).rows[0].r.total).toBe(1);
      expect((await llamar("admin_list_actions", [otro])).rows[0].r.total).toBe(0);
    });

    test("consultar la bitácora y las listas no genera entradas", async () => {
      const admin = await usuarioConRol("admin");
      await actuarComo(c, admin);
      for (const [funcion, args] of [["admin_dashboard", []], ["admin_list_users", []], ["admin_list_workshops", []], ["admin_list_reviews", []], ["admin_list_requests", []], ["admin_list_orders", []], ["admin_list_actions", []]]) {
        await llamar(String(funcion), /** @type {unknown[]} */ (args));
      }
      expect(await contarAcciones(admin)).toBe(0);
    });
  });

  describe("paginación y entradas", () => {
    test.each([
      ["admin_list_users", [null, null, null, 0, 0]],
      ["admin_list_users", [null, null, null, 101, 0]],
      ["admin_list_users", [null, null, null, 10, -1]],
      ["admin_list_users", ["x".repeat(101)]],
      ["admin_list_workshops", [null, null, null, 0, 0]],
      ["admin_list_workshops", ["x".repeat(101)]],
      ["admin_list_reviews", [null, null, 101, 0]],
      ["admin_list_requests", [null, 0, 0]],
      ["admin_list_orders", [null, 10, -1]],
      ["admin_list_actions", [null, null, 101, 0]],
      ["admin_list_actions", [null, "x".repeat(51)]],
    ])("%s con %j lanza invalid_input", async (funcion, args) => {
      await actuarComo(c, await usuarioConRol("admin"));
      expect((await llamar(String(funcion), /** @type {unknown[]} */ (args))).error?.message).toContain("invalid_input");
    });
  });
});
