import { abrirTransaccion, actuarComo, actuarSinUsuario, asignarRol, cerrarTransaccion, crearUsuario, intentar } from "../helpers/db.js";
import { PERMISO_DENEGADO } from "../helpers/solicitudes.js";

/** CU-02: search_workshops, get_workshop_profile y los helpers de horario y distancia. */
describe("búsqueda de talleres (CU-02)", () => {
  /** @type {import("pg").Client} */
  let c;
  let n = 0;
  const correo = () => `busqueda-${Date.now()}-${n++}@prueba.test`;
  const AJENA = "99999999-9999-4999-8999-999999999999";
  const TODO_EL_DIA = { mon: [{ open: "00:00", close: "23:59" }], tue: [{ open: "00:00", close: "23:59" }], wed: [{ open: "00:00", close: "23:59" }], thu: [{ open: "00:00", close: "23:59" }], fri: [{ open: "00:00", close: "23:59" }], sat: [{ open: "00:00", close: "23:59" }], sun: [{ open: "00:00", close: "23:59" }] };
  const CENTRO = { lat: 20.9674, lng: -89.5926 };

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
   * Inserta un taller como superusuario. `colonia` único por prueba para aislar los resultados de otros datos.
   * @param {string} colonia
   * @param {Record<string, unknown>} [extra]
   * @returns {Promise<string>} id del taller
   */
  async function crearTaller(colonia, extra = {}) {
    await c.query("reset role");
    const d = {
      name: "Taller de prueba", services: "{repair,cleaning}", lat: CENTRO.lat, lng: CENTRO.lng, hours: TODO_EL_DIA,
      price_from: 100, published: true, suspended: false, postal_code: "97000", rating_avg: null, rating_count: 0, ...extra,
    };
    const dueno = await usuarioConRol("craftsman");
    const { rows } = await c.query(
      `insert into public.workshops (owner_id, name, address, colonia, postal_code, lat, lng, services, hours, price_from, published, suspended, rating_avg, rating_count)
       values ($1, $2, 'Calle 60', $3, $4, $5, $6, $7::public.service_type[], $8::jsonb, $9, $10, $11, $12, $13) returning id`,
      [dueno, d.name, colonia, d.postal_code, d.lat, d.lng, d.services, JSON.stringify(d.hours), d.price_from, d.published, d.suspended, d.rating_avg, d.rating_count],
    );
    return rows[0].id;
  }

  const buscar = (/** @type {Record<string, unknown>} */ p = {}) => {
    const d = { servicio: null, lat: null, lng: null, km: null, colonia: null, cp: null, rating: null, abierto: false, precio: null, limite: 50, desfase: 0, ...p };
    return intentar(c, "select public.search_workshops($1::public.service_type, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) as r", [
      d.servicio, d.lat, d.lng, d.km, d.colonia, d.cp, d.rating, d.abierto, d.precio, d.limite, d.desfase,
    ]);
  };
  const perfil = (/** @type {string | null} */ id, /** @type {number | null} */ lat = null, /** @type {number | null} */ lng = null) =>
    intentar(c, "select public.get_workshop_profile($1, $2, $3) as r", [id, lat, lng]);

  /** Colonia única de la prueba y un cliente activo que ya actúa. */
  async function clienteConColonia() {
    const colonia = `Prueba${Date.now()}x${n++}`;
    const cliente = await usuarioConRol("client");
    return { colonia, cliente };
  }

  describe("search_workshops: roles", () => {
    test("el cliente activo busca y recibe un arreglo", async () => {
      const { colonia, cliente } = await clienteConColonia();
      const id = await crearTaller(colonia);
      await actuarComo(c, cliente);
      const r = await buscar({ colonia });
      expect(r.error).toBeNull();
      expect(r.rows[0].r.map((/** @type {{ id: string }} */ t) => t.id)).toEqual([id]);
    });

    test("artesano, usuario sin rol y admin lanzan forbidden", async () => {
      for (const uid of [await usuarioConRol("craftsman"), await usuarioConRol(null), await usuarioConRol("admin")]) {
        await actuarComo(c, uid);
        expect((await buscar()).error?.message).toContain("forbidden");
        expect((await perfil(AJENA)).error?.message).toContain("forbidden");
      }
    });

    test("anónimo: permission denied; token sin usuario: not_authenticated; cliente inactivo: inactive_user", async () => {
      const { cliente } = await clienteConColonia();
      await actuarComo(c, null);
      expect((await buscar()).error?.code).toBe(PERMISO_DENEGADO);
      expect((await perfil(AJENA)).error?.code).toBe(PERMISO_DENEGADO);
      await actuarSinUsuario(c);
      expect((await buscar()).error?.message).toContain("not_authenticated");
      expect((await perfil(AJENA)).error?.message).toContain("not_authenticated");
      await c.query("reset role");
      await c.query("update public.profiles set active = false where id = $1", [cliente]);
      await actuarComo(c, cliente);
      expect((await buscar()).error?.message).toContain("inactive_user");
      expect((await perfil(AJENA)).error?.message).toContain("inactive_user");
    });
  });

  describe("search_workshops: visibilidad y forma de la respuesta", () => {
    test("no aparecen los talleres suspendidos ni los no publicados", async () => {
      const { colonia, cliente } = await clienteConColonia();
      const visible = await crearTaller(colonia);
      await crearTaller(colonia, { suspended: true });
      await c.query("reset role");
      const dueno = await usuarioConRol("craftsman");
      await c.query("insert into public.workshops (owner_id, name, colonia) values ($1, 'Borrador', $2)", [dueno, colonia]);
      await actuarComo(c, cliente);
      const r = await buscar({ colonia });
      expect(r.rows[0].r.map((/** @type {{ id: string }} */ t) => t.id)).toEqual([visible]);
    });

    test("no devuelve owner_id, published ni suspended y trae el campo de foto de perfil", async () => {
      const { colonia, cliente } = await clienteConColonia();
      const id = await crearTaller(colonia, { rating_avg: 4.5, rating_count: 2 });
      await c.query("insert into public.workshop_photos (workshop_id, path, kind) values ($1::uuid, $1::text || '/' || gen_random_uuid()::text, 'profile')", [id]);
      await actuarComo(c, cliente);
      const [taller] = (await buscar({ colonia })).rows[0].r;
      expect(Object.keys(taller).sort()).toEqual(
        [
          "address", "colonia", "distance_km", "hours", "id", "is_open", "lat", "lng", "name", "postal_code", "price_from",
          "profile_photo_path", "rating_avg", "rating_count", "services",
        ].sort(),
      );
      expect(taller).toMatchObject({ rating_avg: 4.5, rating_count: 2, distance_km: null, is_open: true });
      expect(taller.profile_photo_path).toMatch(new RegExp(`^${id}/`));
    });

    test("A2: sin resultados devuelve un arreglo vacío y no lanza", async () => {
      const { cliente } = await clienteConColonia();
      await actuarComo(c, cliente);
      const r = await buscar({ colonia: "colonia-que-no-existe-xyz" });
      expect(r.error).toBeNull();
      expect(r.rows[0].r).toEqual([]);
    });
  });

  describe("search_workshops: filtros", () => {
    test("servicio: solo los talleres que lo ofrecen", async () => {
      const { colonia, cliente } = await clienteConColonia();
      const reparacion = await crearTaller(colonia, { services: "{repair}" });
      const limpieza = await crearTaller(colonia, { services: "{cleaning}" });
      await actuarComo(c, cliente);
      const ids = async (/** @type {string} */ servicio) => (await buscar({ colonia, servicio })).rows[0].r.map((/** @type {{ id: string }} */ t) => t.id);
      expect(await ids("repair")).toEqual([reparacion]);
      expect(await ids("cleaning")).toEqual([limpieza]);
    });

    test("distancia: ordena del más cercano al más lejano y respeta el máximo", async () => {
      const { colonia, cliente } = await clienteConColonia();
      const lejos = await crearTaller(colonia, { lat: 21.0345, lng: -89.6502 });
      const cerca = await crearTaller(colonia, { lat: CENTRO.lat, lng: CENTRO.lng });
      const medio = await crearTaller(colonia, { lat: 20.9812, lng: -89.6329 });
      await actuarComo(c, cliente);
      const r = (await buscar({ colonia, ...CENTRO })).rows[0].r;
      expect(r.map((/** @type {{ id: string }} */ t) => t.id)).toEqual([cerca, medio, lejos]);
      expect(r[0].distance_km).toBe(0);
      const distancias = r.map((/** @type {{ distance_km: number }} */ t) => t.distance_km);
      expect(distancias).toEqual([...distancias].sort((a, b) => a - b));

      const cercanos = await buscar({ colonia, ...CENTRO, km: distancias[1] });
      expect(cercanos.rows[0].r.map((/** @type {{ id: string }} */ t) => t.id)).toEqual([cerca, medio]);
    });

    test("sin ubicación ordena por calificación, luego por reseñas; los sin calificar al final", async () => {
      const { colonia, cliente } = await clienteConColonia();
      const sin = await crearTaller(colonia, { name: "A" });
      const buena = await crearTaller(colonia, { name: "B", rating_avg: 4.8, rating_count: 3 });
      const regular = await crearTaller(colonia, { name: "C", rating_avg: 3.5, rating_count: 9 });
      await actuarComo(c, cliente);
      expect((await buscar({ colonia })).rows[0].r.map((/** @type {{ id: string }} */ t) => t.id)).toEqual([buena, regular, sin]);
    });

    test("colonia: subcadena sin distinguir mayúsculas; % y _ se toman literales", async () => {
      const { colonia, cliente } = await clienteConColonia();
      const id = await crearTaller(`${colonia} García Ginerés`);
      await actuarComo(c, cliente);
      const ids = async (/** @type {string} */ texto) => (await buscar({ colonia: texto })).rows[0].r.map((/** @type {{ id: string }} */ t) => t.id);
      expect(await ids(colonia.toUpperCase())).toEqual([id]);
      expect(await ids("ginerés")).toContain(id);
      expect(await ids("  " + colonia.toLowerCase() + "  ")).toEqual([id]);
      expect(await ids("%")).not.toContain(id);
      expect(await ids("_")).not.toContain(id);
      expect(await ids("\\")).not.toContain(id);
    });

    test("código postal exacto", async () => {
      const { colonia, cliente } = await clienteConColonia();
      const a = await crearTaller(colonia, { postal_code: "97070" });
      await crearTaller(colonia, { postal_code: "97100" });
      await actuarComo(c, cliente);
      expect((await buscar({ colonia, cp: "97070" })).rows[0].r.map((/** @type {{ id: string }} */ t) => t.id)).toEqual([a]);
    });

    test("calificación mínima: excluye los que no llegan y los que no tienen calificación", async () => {
      const { colonia, cliente } = await clienteConColonia();
      const buena = await crearTaller(colonia, { rating_avg: 4.5, rating_count: 2 });
      await crearTaller(colonia, { rating_avg: 3.9, rating_count: 2 });
      await crearTaller(colonia);
      await actuarComo(c, cliente);
      expect((await buscar({ colonia, rating: 4 })).rows[0].r.map((/** @type {{ id: string }} */ t) => t.id)).toEqual([buena]);
    });

    test("precio máximo sobre el precio «desde»", async () => {
      const { colonia, cliente } = await clienteConColonia();
      const barato = await crearTaller(colonia, { price_from: 80 });
      await crearTaller(colonia, { price_from: 300 });
      await actuarComo(c, cliente);
      expect((await buscar({ colonia, precio: 100 })).rows[0].r.map((/** @type {{ id: string }} */ t) => t.id)).toEqual([barato]);
    });

    test("open_now: solo los abiertos ahora, y is_open lo refleja", async () => {
      const { colonia, cliente } = await clienteConColonia();
      const abierto = await crearTaller(colonia, { hours: TODO_EL_DIA });
      const cerrado = await crearTaller(colonia, { hours: { mon: [] } });
      await actuarComo(c, cliente);
      const todos = (await buscar({ colonia })).rows[0].r;
      expect(Object.fromEntries(todos.map((/** @type {{ id: string, is_open: boolean }} */ t) => [t.id, t.is_open]))).toEqual({ [abierto]: true, [cerrado]: false });
      expect((await buscar({ colonia, abierto: true })).rows[0].r.map((/** @type {{ id: string }} */ t) => t.id)).toEqual([abierto]);
    });

    test("limit y offset paginan sobre el orden", async () => {
      const { colonia, cliente } = await clienteConColonia();
      const a = await crearTaller(colonia, { name: "A" });
      const b = await crearTaller(colonia, { name: "B" });
      const d = await crearTaller(colonia, { name: "C" });
      await actuarComo(c, cliente);
      const ids = async (/** @type {number} */ limite, /** @type {number} */ desfase) =>
        (await buscar({ colonia, limite, desfase })).rows[0].r.map((/** @type {{ id: string }} */ t) => t.id);
      expect(await ids(2, 0)).toEqual([a, b]);
      expect(await ids(2, 2)).toEqual([d]);
      expect(await ids(1, 5)).toEqual([]);
    });
  });

  describe("search_workshops: entradas inválidas", () => {
    test.each([
      ["lat sin lng", { lat: 20.9 }],
      ["lng sin lat", { lng: -89.6 }],
      ["lat fuera de rango", { lat: 91, lng: 0 }],
      ["lng fuera de rango", { lat: 0, lng: 181 }],
      ["distancia sin ubicación", { km: 5 }],
      ["distancia cero", { ...CENTRO, km: 0 }],
      ["distancia mayor a 500", { ...CENTRO, km: 501 }],
      ["código postal inválido", { cp: "123" }],
      ["calificación menor a 1", { rating: 0.5 }],
      ["calificación mayor a 5", { rating: 5.5 }],
      ["precio cero", { precio: 0 }],
      ["precio NaN", { precio: "NaN" }],
      ["colonia de más de 100 caracteres", { colonia: "x".repeat(101) }],
      ["límite cero", { limite: 0 }],
      ["límite mayor a 100", { limite: 101 }],
      ["offset negativo", { desfase: -1 }],
    ])("%s lanza invalid_input", async (_nombre, parametros) => {
      const { cliente } = await clienteConColonia();
      await actuarComo(c, cliente);
      expect((await buscar(parametros)).error?.message).toContain("invalid_input");
    });
  });

  describe("get_workshop_profile", () => {
    test("flujo principal: datos, calificación, horario, precio y fotos (perfil primero, trabajos recientes primero)", async () => {
      const { colonia, cliente } = await clienteConColonia();
      const id = await crearTaller(colonia, { rating_avg: 4.2, rating_count: 5, price_from: 150 });
      const insertar = (/** @type {string} */ kind, /** @type {string} */ fecha) =>
        c.query(
          "insert into public.workshop_photos (workshop_id, path, kind, created_at) values ($1::uuid, $1::text || '/' || gen_random_uuid()::text, $2::public.workshop_photo_kind, $3)",
          [id, kind, fecha],
        );
      await insertar("work", "2026-01-01T00:00:00Z");
      await insertar("profile", "2026-01-02T00:00:00Z");
      await insertar("work", "2026-03-01T00:00:00Z");
      await actuarComo(c, cliente);
      const r = await perfil(id, CENTRO.lat, CENTRO.lng);
      expect(r.error).toBeNull();
      expect(r.rows[0].r).toMatchObject({ id, rating_avg: 4.2, rating_count: 5, price_from: 150, distance_km: 0, is_open: true, services: ["repair", "cleaning"] });
      expect(r.rows[0].r).not.toHaveProperty("owner_id");
      expect(r.rows[0].r).not.toHaveProperty("suspended");
      const fotos = r.rows[0].r.photos;
      expect(fotos.map((/** @type {{ kind: string }} */ f) => f.kind)).toEqual(["profile", "work", "work"]);
      expect(fotos[0].path).toMatch(new RegExp(`^${id}/`));
    });

    test("sin ubicación la distancia es nula; sin fotos devuelve []", async () => {
      const { colonia, cliente } = await clienteConColonia();
      const id = await crearTaller(colonia);
      await actuarComo(c, cliente);
      const r = (await perfil(id)).rows[0].r;
      expect(r.distance_km).toBeNull();
      expect(r.photos).toEqual([]);
    });

    test("suspendido, no publicado o inexistente: not_found", async () => {
      const { colonia, cliente } = await clienteConColonia();
      const suspendido = await crearTaller(colonia, { suspended: true });
      await c.query("reset role");
      const dueno = await usuarioConRol("craftsman");
      const borrador = (await c.query("insert into public.workshops (owner_id, name, colonia) values ($1, 'Borrador', $2) returning id", [dueno, colonia])).rows[0].id;
      await actuarComo(c, cliente);
      for (const id of [suspendido, borrador, AJENA]) expect((await perfil(id)).error?.message).toContain("not_found");
    });

    test("id nulo o ubicación incompleta: invalid_input", async () => {
      const { cliente } = await clienteConColonia();
      await actuarComo(c, cliente);
      expect((await perfil(null)).error?.message).toContain("invalid_input");
      expect((await perfil(AJENA, 20.9, null)).error?.message).toContain("invalid_input");
      expect((await perfil(AJENA, 95, 0)).error?.message).toContain("invalid_input");
    });
  });

  describe("helpers", () => {
    const abierto = async (/** @type {unknown} */ horas, /** @type {string} */ instante) => {
      await c.query("reset role");
      return (await c.query("select private.is_workshop_open($1::jsonb, $2::timestamptz) as a", [JSON.stringify(horas), instante])).rows[0].a;
    };

    test("is_workshop_open usa la hora de Mérida (UTC-6) y el rango [open, close)", async () => {
      const lunes = { mon: [{ open: "09:00", close: "18:00" }] };
      expect(await abierto(lunes, "2026-11-16T09:00:00-06:00")).toBe(true);
      expect(await abierto(lunes, "2026-11-16T08:59:00-06:00")).toBe(false);
      expect(await abierto(lunes, "2026-11-16T17:59:00-06:00")).toBe(true);
      expect(await abierto(lunes, "2026-11-16T18:00:00-06:00")).toBe(false);
      expect(await abierto(lunes, "2026-11-16T15:00:00Z")).toBe(true); // 09:00 en Mérida
      expect(await abierto(lunes, "2026-11-17T09:00:00-06:00")).toBe(false); // martes
    });

    test("is_workshop_open: día según Mérida y no según UTC, dos rangos, vacío y nulo", async () => {
      const doble = { mon: [{ open: "10:00", close: "12:00" }, { open: "16:00", close: "20:00" }] };
      // En UTC ya es martes, pero en Mérida sigue siendo lunes.
      expect(await abierto(doble, "2026-11-17T01:59:00Z")).toBe(true); // lunes 19:59, segundo rango
      expect(await abierto(doble, "2026-11-17T02:00:00Z")).toBe(false); // lunes 20:00, ya cerró
      expect(await abierto(doble, "2026-11-16T20:00:00Z")).toBe(false); // lunes 14:00, entre rangos
      expect(await abierto({ mon: [] }, "2026-11-16T15:00:00Z")).toBe(false);
      expect(await abierto({}, "2026-11-16T15:00:00Z")).toBe(false);
      await c.query("reset role");
      expect((await c.query("select private.is_workshop_open(null, now()) as a")).rows[0].a).toBe(false);
    });

    test("distance_km: cero en el mismo punto y un grado de longitud en el ecuador son unos 111 km", async () => {
      await c.query("reset role");
      const { rows } = await c.query(
        "select private.distance_km(20.9, -89.6, 20.9, -89.6)::float as cero, private.distance_km(0, 0, 0, 1)::float as grado, private.distance_km(0, 0, 0, 1) = private.distance_km(0, 1, 0, 0) as simetrica",
      );
      expect(rows[0].cero).toBe(0);
      expect(rows[0].grado).toBeCloseTo(111.19, 1);
      expect(rows[0].simetrica).toBe(true);
    });
  });

  test("grants: anon no ejecuta las funciones; authenticated sí", async () => {
    await c.query("reset role");
    const firmas = [
      "public.search_workshops(public.service_type, double precision, double precision, numeric, text, text, numeric, boolean, numeric, integer, integer)",
      "public.get_workshop_profile(uuid, double precision, double precision)",
    ];
    for (const f of firmas) {
      const { rows } = await c.query(
        "select has_function_privilege('anon', $1, 'execute') as anon, has_function_privilege('authenticated', $1, 'execute') as auth",
        [f],
      );
      expect(rows[0]).toEqual({ anon: false, auth: true });
    }
    const helper = await c.query("select has_function_privilege('anon', 'private.is_workshop_open(jsonb, timestamptz)', 'execute') as anon");
    expect(helper.rows[0].anon).toBe(false);
  });
});
