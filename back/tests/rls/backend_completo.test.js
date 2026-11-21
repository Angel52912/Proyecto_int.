import { randomUUID } from "node:crypto";
import { abrirTransaccion, actuarComo, cerrarTransaccion, intentar, intentarBorradoStorage, crearUsuarioFactory, desactivarUsuario, crearArchivoStorage } from "../helpers/db.js";
import { crearOrden, crearPresupuesto } from "../helpers/presupuestos.js";
import { PERMISO_DENEGADO, UUID_A, agregarFoto, crearSolicitud, crearTallerPublicado } from "../helpers/solicitudes.js";

/** Migraciones 0019 (búsqueda por texto y orden, Mi taller) y 0020 (endurecimiento). */
describe("backend completo (0019 y 0020)", () => {
  /** @type {import("pg").Client} */
  let c;
  let n = 0;
  const marca = () => `bc${Date.now()}x${String(n++).padStart(5, "0")}`;
  const CENTRO = { lat: 20.9674, lng: -89.5926 };

  beforeAll(async () => {
    c = await abrirTransaccion();
  });

  afterAll(async () => {
    await cerrarTransaccion(c);
  });

  /** @param {"client" | "craftsman" | "admin" | null} rol */
  const usuarioConRol = crearUsuarioFactory(c);

  /** Taller publicado con colonia única (y nombre indicado). */
  async function taller(/** @type {string} */ colonia, /** @type {Record<string, unknown>} */ extra = {}) {
    const artesano = await usuarioConRol("craftsman");
    const id = await crearTallerPublicado(c, artesano, /** @type {any} */ (extra));
    // crearTallerPublicado solo conoce published, suspended y services: el resto se actualiza aquí.
    const campos = ["name", "price_from", "rating_avg", "rating_count", "lat", "lng"].filter((k) => k in extra);
    const sets = ["colonia = $2", ...campos.map((k, i) => `${k} = $${i + 3}`)];
    await c.query(`update public.workshops set ${sets.join(", ")} where id = $1`, [id, colonia, ...campos.map((k) => extra[k])]);
    return { id, artesano };
  }

  describe("0019: search_workshops con texto y orden", () => {
    const buscar = (/** @type {Record<string, unknown>} */ p = {}) => {
      const d = { servicio: null, lat: null, lng: null, km: null, colonia: null, cp: null, rating: null, abierto: false, precio: null, limite: 50, desfase: 0, texto: null, orden: null, ...p };
      return intentar(c, "select public.search_workshops($1::public.service_type, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) as r", [
        d.servicio, d.lat, d.lng, d.km, d.colonia, d.cp, d.rating, d.abierto, d.precio, d.limite, d.desfase, d.texto, d.orden,
      ]);
    };
    const ids = (/** @type {any} */ r) => r.rows[0].r.map((/** @type {{ id: string }} */ t) => t.id);

    test("p_search encuentra por nombre o por colonia, sin distinguir mayúsculas; % y _ son literales", async () => {
      const token = marca();
      const cliente = await usuarioConRol("client");
      const porNombre = await taller(`Centro ${token}`, { name: `Calzado ${token} El Buen Paso` });
      const porColonia = await taller(`Ginerés ${token}`, { name: "Otro taller" });
      await actuarComo(c, cliente);
      expect(ids(await buscar({ texto: `CALZADO ${token}` }))).toEqual([porNombre.id]);
      expect(ids(await buscar({ texto: `ginerés ${token}` }))).toEqual([porColonia.id]);
      expect((await buscar({ texto: token })).rows[0].r).toHaveLength(2);
      for (const comodin of ["%", "_", "\\"]) expect(ids(await buscar({ texto: comodin }))).not.toContain(porNombre.id);
      expect((await buscar({ texto: "   " })).error).toBeNull(); // vacío = sin filtro
    });

    test("sin servicio devuelve talleres de todos los servicios, sin repetirlos", async () => {
      const token = marca();
      const cliente = await usuarioConRol("client");
      const reparacion = await taller(token, { services: "{repair}" });
      const limpieza = await taller(token, { services: "{cleaning}" });
      await actuarComo(c, cliente);
      expect(ids(await buscar({ colonia: token })).sort()).toEqual([reparacion.id, limpieza.id].sort());
      expect(ids(await buscar({ colonia: token, servicio: "cleaning" }))).toEqual([limpieza.id]);
    });

    test("p_order: price, rating y distance; por defecto distance con ubicación y rating sin ella", async () => {
      const token = marca();
      const cliente = await usuarioConRol("client");
      const caro = await taller(token, { price_from: 300, rating_avg: 5, rating_count: 9, lat: CENTRO.lat, lng: CENTRO.lng });
      const barato = await taller(token, { price_from: 80, rating_avg: 3, rating_count: 2, lat: 21.0345, lng: -89.6502 });
      const medio = await taller(token, { price_from: 150, rating_avg: 4, rating_count: 4, lat: 20.9812, lng: -89.6329 });
      await actuarComo(c, cliente);
      expect(ids(await buscar({ colonia: token, orden: "price" }))).toEqual([barato.id, medio.id, caro.id]);
      expect(ids(await buscar({ colonia: token, orden: "rating" }))).toEqual([caro.id, medio.id, barato.id]);
      expect(ids(await buscar({ colonia: token }))).toEqual([caro.id, medio.id, barato.id]); // sin ubicación: rating
      expect(ids(await buscar({ colonia: token, ...CENTRO }))).toEqual([caro.id, medio.id, barato.id]); // por cercanía
      expect(ids(await buscar({ colonia: token, ...CENTRO, orden: "price" }))).toEqual([barato.id, medio.id, caro.id]);
      expect(ids(await buscar({ colonia: token, ...CENTRO, orden: "distance" }))).toEqual([caro.id, medio.id, barato.id]);
    });

    test.each([
      ["orden desconocido", { orden: "otro" }],
      ["orden distance sin ubicación", { orden: "distance" }],
      ["texto de más de 100 caracteres", { texto: "x".repeat(101) }],
    ])("%s lanza invalid_input", async (_nombre, parametros) => {
      await actuarComo(c, await usuarioConRol("client"));
      expect((await buscar(parametros)).error?.message).toContain("invalid_input");
    });

    test("artesano, admin y sin rol siguen sin poder buscar (forbidden)", async () => {
      for (const rol of ["craftsman", "admin", null]) {
        await actuarComo(c, await usuarioConRol(/** @type {any} */ (rol)));
        expect((await buscar({ texto: "x" })).error?.message).toContain("forbidden");
      }
    });
  });

  describe("0019: Mi taller (get_my_workshop_stats y list_my_workshop_reviews)", () => {
    const estadisticas = () => intentar(c, "select public.get_my_workshop_stats() as r");
    const resenas = (/** @type {number} */ limite = 20, /** @type {number} */ desfase = 0) =>
      intentar(c, "select public.list_my_workshop_reviews($1, $2) as r", [limite, desfase]);

    /** Taller con pedidos entregados (uno a tiempo y uno tarde), uno en curso, uno listo, solicitudes y reseñas. */
    async function conActividad() {
      const { id: tallerId, artesano } = await taller(marca());
      const clientes = [await usuarioConRol("client"), await usuarioConRol("client"), await usuarioConRol("client"), await usuarioConRol("client"), await usuarioConRol("client")];
      /** @param {string} cliente @param {string} estado */
      const pedido = async (cliente, estado) => {
        const solicitud = await crearSolicitud(c, cliente, tallerId, "accepted");
        const quote = await crearPresupuesto(c, solicitud, "accepted");
        const orden = await crearOrden(c, { quote, request: solicitud, cliente, taller: tallerId });
        await c.query("update public.orders set status = $2::public.order_status, phase = 4 where id = $1", [orden, estado]);
        return { orden, cliente };
      };
      const aTiempo = await pedido(clientes[0], "delivered");
      await c.query("update public.orders set due_date = current_date + 5, delivered_at = now() where id = $1", [aTiempo.orden]);
      const tarde = await pedido(clientes[1], "delivered");
      await c.query("update public.orders set due_date = current_date - 5, delivered_at = now() where id = $1", [tarde.orden]);
      const oculta = await pedido(clientes[2], "delivered");
      await c.query("update public.orders set due_date = current_date + 5, delivered_at = now() where id = $1", [oculta.orden]);
      await pedido(clientes[3], "in_progress");
      await pedido(clientes[4], "ready");
      await crearSolicitud(c, await usuarioConRol("client"), tallerId, "open");
      await crearSolicitud(c, await usuarioConRol("client"), tallerId, "quoted");
      await crearSolicitud(c, await usuarioConRol("client"), tallerId, "draft"); // no cuenta
      const reseña = async (/** @type {{ orden: string, cliente: string }} */ p, /** @type {number} */ rating, /** @type {string} */ comentario) =>
        (
          await c.query("insert into public.reviews (order_id, client_id, workshop_id, rating, comment) values ($1, $2, $3, $4, $5) returning id", [p.orden, p.cliente, tallerId, rating, comentario])
        ).rows[0].id;
      await reseña(aTiempo, 5, "Excelente");
      await reseña(tarde, 4, "Bien, pero tarde");
      const ocultaId = await reseña(oculta, 1, "Reseña oculta por el admin");
      await c.query("update public.reviews set hidden = true where id = $1", [ocultaId]);
      return { tallerId, artesano, aTiempo, tarde };
    }

    test("las estadísticas cuentan pedidos por estado, puntualidad, solicitudes (sin borradores) y calificación sin las ocultas", async () => {
      const e = await conActividad();
      await actuarComo(c, e.artesano);
      const r = await estadisticas();
      expect(r.error).toBeNull();
      expect(r.rows[0].r).toEqual({
        workshop_id: e.tallerId,
        published: true,
        suspended: false,
        rating_avg: 4.5,
        rating_count: 2,
        orders: { total: 5, in_progress: 1, ready: 1, delivered: 3, on_time_pct: 66.7 },
        requests: { open: 1, quoted: 1, accepted: 5, cancelled: 0 },
      });
    });

    test("sin pedidos entregados el porcentaje a tiempo es nulo y todo está en cero", async () => {
      const { artesano } = await taller(marca());
      await actuarComo(c, artesano);
      const r = (await estadisticas()).rows[0].r;
      expect(r.orders).toEqual({ total: 0, in_progress: 0, ready: 0, delivered: 0, on_time_pct: null });
      expect(r.requests).toEqual({ open: 0, quoted: 0, accepted: 0, cancelled: 0 });
      expect(r.rating_avg).toBeNull();
    });

    test("las reseñas propias: solo no ocultas, más reciente primero, sin client_id ni order_id, con paginación", async () => {
      const e = await conActividad();
      await actuarComo(c, e.artesano);
      const r = (await resenas()).rows[0].r;
      expect(r.total).toBe(2);
      expect(r.items).toHaveLength(2);
      expect(r.items.map((/** @type {{ comment: string }} */ x) => x.comment).sort()).toEqual(["Bien, pero tarde", "Excelente"]);
      expect(Object.keys(r.items[0]).sort()).toEqual(["comment", "created_at", "id", "rating", "tags"]);
      expect((await resenas(1, 1)).rows[0].r.items).toHaveLength(1);
      expect((await resenas(1, 5)).rows[0].r.items).toEqual([]);
    });

    test("cada artesano ve solo lo de su taller", async () => {
      await conActividad();
      const otro = await taller(marca());
      await actuarComo(c, otro.artesano);
      expect((await resenas()).rows[0].r).toEqual({ total: 0, items: [] });
      expect((await estadisticas()).rows[0].r.orders.total).toBe(0);
    });

    test("cliente, usuario sin rol y admin: forbidden; artesano sin taller: not_found", async () => {
      for (const rol of ["client", null, "admin"]) {
        await actuarComo(c, await usuarioConRol(/** @type {any} */ (rol)));
        expect((await estadisticas()).error?.message).toContain("forbidden");
        expect((await resenas()).error?.message).toContain("forbidden");
      }
      await actuarComo(c, await usuarioConRol("craftsman"));
      expect((await estadisticas()).error?.message).toContain("not_found");
      expect((await resenas()).error?.message).toContain("not_found");
    });

    test("anónimo: permission denied; artesano desactivado: inactive_user; paginación inválida: invalid_input", async () => {
      const { artesano } = await taller(marca());
      await actuarComo(c, null);
      expect((await estadisticas()).error?.code).toBe(PERMISO_DENEGADO);
      expect((await resenas()).error?.code).toBe(PERMISO_DENEGADO);
      await actuarComo(c, artesano);
      for (const [limite, desfase] of [[0, 0], [101, 0], [10, -1]]) expect((await resenas(limite, desfase)).error?.message).toContain("invalid_input");
      await desactivarUsuario(c, artesano);
      await actuarComo(c, artesano);
      expect((await estadisticas()).error?.message).toContain("inactive_user");
    });
  });

  describe("0020: cuotas y rutas de Storage", () => {
    const subir = (/** @type {string} */ bucket, /** @type {string} */ ruta) =>
      intentar(c, "insert into storage.objects (bucket_id, name) values ($1, $2)", [bucket, ruta]);
    async function rellenar(/** @type {string} */ bucket, /** @type {string} */ carpeta, /** @type {number} */ cuantos) {
      await c.query("reset role");
      await c.query("insert into storage.objects (bucket_id, name) select $1, $2::text || '/' || gen_random_uuid()::text from generate_series(1, $3)", [bucket, carpeta, cuantos]);
    }
    const uuid = () => randomUUID();

    test("workshop-photos: hasta 12 archivos por taller; el 13 se rechaza", async () => {
      const { id, artesano } = await taller(marca());
      await rellenar("workshop-photos", id, 11);
      await actuarComo(c, artesano);
      expect((await subir("workshop-photos", `${id}/${uuid()}`)).error).toBeNull();
      expect((await subir("workshop-photos", `${id}/${uuid()}`)).error?.code).toBe(PERMISO_DENEGADO);
    });

    test("request-photos: hasta 6 archivos por solicitud; el 7 se rechaza", async () => {
      const cliente = await usuarioConRol("client");
      const { id: tallerId } = await taller(marca());
      const solicitud = await crearSolicitud(c, cliente, tallerId, "draft");
      await rellenar("request-photos", solicitud, 5);
      await actuarComo(c, cliente);
      expect((await subir("request-photos", `${solicitud}/${uuid()}`)).error).toBeNull();
      expect((await subir("request-photos", `${solicitud}/${uuid()}`)).error?.code).toBe(PERMISO_DENEGADO);
    });

    test("progress-photos: hasta 40 archivos por pedido; el 41 se rechaza", async () => {
      const cliente = await usuarioConRol("client");
      const { id: tallerId, artesano } = await taller(marca());
      const solicitud = await crearSolicitud(c, cliente, tallerId, "accepted");
      const quote = await crearPresupuesto(c, solicitud, "accepted");
      const orden = await crearOrden(c, { quote, request: solicitud, cliente, taller: tallerId });
      await rellenar("progress-photos", orden, 39);
      await actuarComo(c, artesano);
      expect((await subir("progress-photos", `${orden}/${uuid()}`)).error).toBeNull();
      expect((await subir("progress-photos", `${orden}/${uuid()}`)).error?.code).toBe(PERMISO_DENEGADO);
    });

    test("avatars: hasta 3 archivos por usuario", async () => {
      const uid = await usuarioConRol("client");
      await rellenar("avatars", uid, 2);
      await actuarComo(c, uid);
      expect((await subir("avatars", `${uid}/${uuid()}`)).error).toBeNull();
      expect((await subir("avatars", `${uid}/${uuid()}`)).error?.code).toBe(PERMISO_DENEGADO);
    });

    test("solo rutas de un nivel: {id}/{uuid}, sin subcarpetas, en los cuatro buckets", async () => {
      const cliente = await usuarioConRol("client");
      const { id: tallerId, artesano } = await taller(marca());
      const solicitud = await crearSolicitud(c, cliente, tallerId, "draft");
      const solicitudAceptada = await crearSolicitud(c, await usuarioConRol("client"), tallerId, "accepted");
      const orden = await crearOrden(c, {
        quote: await crearPresupuesto(c, solicitudAceptada, "accepted"),
        request: solicitudAceptada,
        cliente: (await c.query("select client_id from public.service_requests where id = $1", [solicitudAceptada])).rows[0].client_id,
        taller: tallerId,
      });
      await actuarComo(c, artesano);
      expect((await subir("workshop-photos", `${tallerId}/sub/${uuid()}`)).error?.code).toBe(PERMISO_DENEGADO);
      expect((await subir("progress-photos", `${orden}/sub/${uuid()}`)).error?.code).toBe(PERMISO_DENEGADO);
      await actuarComo(c, cliente);
      expect((await subir("request-photos", `${solicitud}/sub/${uuid()}`)).error?.code).toBe(PERMISO_DENEGADO);
      expect((await subir("avatars", `${cliente}/sub/${uuid()}`)).error?.code).toBe(PERMISO_DENEGADO);
    });

    test("un artesano con el taller suspendido ya no sube fotos del taller, pero sí puede borrar las suyas", async () => {
      const { id, artesano } = await taller(marca());
      const archivo = `${id}/${uuid()}`;
      await crearArchivoStorage(c, "workshop-photos", archivo);
      await c.query("update public.workshops set suspended = true where id = $1", [id]);
      await actuarComo(c, artesano);
      expect((await subir("workshop-photos", `${id}/${uuid()}`)).error?.code).toBe(PERMISO_DENEGADO);
      const fila = await intentar(c, "insert into public.workshop_photos (workshop_id, path, kind) values ($1, $2, 'work')", [id, `${id}/${uuid()}`]);
      expect(fila.error?.code).toBe(PERMISO_DENEGADO);
      expect((await intentarBorradoStorage(c, "delete from storage.objects where bucket_id = 'workshop-photos' and name = $1", [archivo])).rowCount).toBe(1);
    });

    test("el artesano activo con el taller disponible sigue pudiendo subir y registrar fotos", async () => {
      const { id, artesano } = await taller(marca());
      await actuarComo(c, artesano);
      const ruta = `${id}/${uuid()}`;
      expect((await subir("workshop-photos", ruta)).error).toBeNull();
      expect((await intentar(c, "insert into public.workshop_photos (workshop_id, path, kind) values ($1, $2, 'work')", [id, ruta])).error).toBeNull();
    });
  });

  describe("0020: submit_request exige el archivo en Storage", () => {
    async function borrador() {
      const cliente = await usuarioConRol("client");
      const { id: tallerId } = await taller(marca());
      const solicitud = await crearSolicitud(c, cliente, tallerId, "draft");
      return { cliente, solicitud };
    }
    const enviar = (/** @type {string} */ solicitud) => intentar(c, "select public.submit_request($1) as r", [solicitud]);

    test("una fila en request_photos sin archivo en Storage no basta: photo_required", async () => {
      const { cliente, solicitud } = await borrador();
      await c.query("insert into public.request_photos (request_id, path) values ($1, $2)", [solicitud, `${solicitud}/${UUID_A}`]);
      await actuarComo(c, cliente);
      expect((await enviar(solicitud)).error?.message).toContain("photo_required");
    });

    test("con el archivo en Storage se envía; sin fotos sigue siendo photo_required", async () => {
      const { cliente, solicitud } = await borrador();
      await actuarComo(c, cliente);
      expect((await enviar(solicitud)).error?.message).toContain("photo_required");
      await agregarFoto(c, solicitud);
      await actuarComo(c, cliente);
      const r = await enviar(solicitud);
      expect(r.error).toBeNull();
      expect(r.rows[0].r).toEqual({ id: solicitud, status: "open" });
    });
  });

  describe("0020: límites de tasa", () => {
    test("mensajes: 30 por minuto por usuario; el 31 lanza rate_limited y los de sistema no cuentan", async () => {
      const cliente = await usuarioConRol("client");
      const { id: tallerId } = await taller(marca());
      const solicitud = await crearSolicitud(c, cliente, tallerId, "open");
      await c.query("insert into public.messages (request_id, sender_id, body, kind) select $1, null, 'sistema', 'system' from generate_series(1, 40)", [solicitud]);
      await actuarComo(c, cliente);
      const enviar = () => intentar(c, "insert into public.messages (request_id, body) values ($1, 'hola')", [solicitud]);
      for (let i = 0; i < 30; i += 1) expect((await enviar()).error).toBeNull();
      expect((await enviar()).error?.message).toContain("rate_limited");
    });

    test("presupuestos: 10 por hora por solicitud; el 11 lanza rate_limited", async () => {
      const cliente = await usuarioConRol("client");
      const { id: tallerId, artesano } = await taller(marca());
      const solicitud = await crearSolicitud(c, cliente, tallerId, "open");
      await actuarComo(c, artesano);
      const fecha = (await c.query("select (current_date + 7)::text as f")).rows[0].f;
      const enviar = () => intentar(c, "select public.send_quote($1, 100, $2::date, '{}'::jsonb) as r", [solicitud, fecha]);
      for (let i = 0; i < 10; i += 1) expect((await enviar()).error).toBeNull();
      expect((await enviar()).error?.message).toContain("rate_limited");
    });

    test("borradores: 10 por cliente; el 11 lanza limit_reached y otro cliente no se ve afectado", async () => {
      const cliente = await usuarioConRol("client");
      for (let i = 0; i < 10; i += 1) {
        const { id } = await taller(marca());
        await crearSolicitud(c, cliente, id, "draft");
      }
      const { id: tallerExtra } = await taller(marca());
      await c.query("savepoint borrador");
      await expect(crearSolicitud(c, cliente, tallerExtra, "draft")).rejects.toThrow(/limit_reached/);
      await c.query("rollback to savepoint borrador");
      // Un cliente distinto sí puede crear su borrador, y los enviados ya no cuentan como borradores.
      await expect(crearSolicitud(c, await usuarioConRol("client"), tallerExtra, "draft")).resolves.toEqual(expect.any(String));
      await c.query("update public.service_requests set status = 'open', submitted_at = now() where client_id = $1 and status = 'draft'", [cliente]);
      await expect(crearSolicitud(c, cliente, tallerExtra, "draft")).resolves.toEqual(expect.any(String));
    });
  });

  test("grants: anon no ejecuta las funciones nuevas; authenticated sí", async () => {
    await c.query("reset role");
    for (const f of ["public.get_my_workshop_stats()", "public.list_my_workshop_reviews(integer, integer)"]) {
      const { rows } = await c.query("select has_function_privilege('anon', $1, 'execute') as anon, has_function_privilege('authenticated', $1, 'execute') as auth", [f]);
      expect(rows[0]).toEqual({ anon: false, auth: true });
    }
  });
});
