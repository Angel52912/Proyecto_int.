import { jest } from "@jest/globals";

/** Cliente falso: registra las llamadas y devuelve respuestas encoladas. */
function crearFalso() {
  /** @type {any[]} */
  const respuestas = [];
  /** @type {any[]} */
  const llamadas = [];
  const builder = {
    select: (...a) => (llamadas.push(["select", ...a]), builder),
    update: (...a) => (llamadas.push(["update", ...a]), builder),
    is: (...a) => (llamadas.push(["is", ...a]), builder),
    then: (resolver, rechazar) => Promise.resolve(respuestas.shift()).then(resolver, rechazar),
  };
  const cliente = {
    auth: { getSession: async () => ({ data: { session: { user: { id: "u-1" } } }, error: null }) },
    from: jest.fn((tabla) => (llamadas.push(["from", tabla]), builder)),
    rpc: jest.fn(async (...a) => (llamadas.push(["rpc", ...a]), respuestas.shift())),
  };
  return { cliente, respuestas, llamadas };
}

let falso = crearFalso();
jest.unstable_mockModule("../../js/supabaseClient.js", () => ({ obtenerCliente: () => falso.cliente }));
const taller = await import("../../js/features/workshop/api.js");
const tallerMock = await import("../../js/features/workshop/api.mock.js");
const solicitudes = await import("../../js/features/requests/api.js");
const solicitudesMock = await import("../../js/features/requests/api.mock.js");
const sim = await import("../../js/features/requests/simulacion.js");

/** @param {Promise<unknown>} promesa @returns {Promise<string>} */
async function codigoDe(promesa) {
  try {
    await promesa;
  } catch (error) {
    return /** @type {any} */ (error).code;
  }
  return "sin_error";
}

const COMPLETO = { name: "Taller", address: "Calle 60", colonia: "Centro", lat: 20.9, lng: -89.6, services: ["repair"], hours: { mon: [{ open: "09:00", close: "18:00" }] }, price_from: 100 };

beforeEach(() => {
  falso = crearFalso();
  tallerMock.reiniciarSimulacion();
  sim.reiniciarSimulacion();
});

describe("Mi taller (real)", () => {
  test("contrato: real y simulado exportan getMyWorkshopStats y listMyWorkshopReviews", () => {
    for (const nombre of ["getMyWorkshopStats", "listMyWorkshopReviews"]) {
      expect(typeof taller[nombre]).toBe("function");
      expect(typeof tallerMock[nombre]).toBe("function");
    }
  });

  test("getMyWorkshopStats llama al RPC sin parámetros y devuelve los datos", async () => {
    const datos = { workshop_id: "t", rating_avg: 4.5, rating_count: 2, orders: { total: 1 }, requests: { open: 0 } };
    falso.respuestas.push({ data: datos, error: null });
    await expect(taller.getMyWorkshopStats()).resolves.toEqual(datos);
    expect(falso.llamadas).toContainEqual(["rpc", "get_my_workshop_stats"]);
  });

  test("listMyWorkshopReviews pagina con 20 por defecto y valida los límites", async () => {
    falso.respuestas.push({ data: { total: 0, items: [] }, error: null });
    await taller.listMyWorkshopReviews();
    expect(falso.llamadas).toContainEqual(["rpc", "list_my_workshop_reviews", { p_limit: 20, p_offset: 0 }]);
    for (const malo of [{ limit: 0 }, { limit: 101 }, { offset: -1 }, { limit: 1.5 }, []]) {
      expect(await codigoDe(taller.listMyWorkshopReviews(/** @type {any} */ (malo)))).toBe("invalid_input");
    }
  });

  test("traduce los errores del RPC (artesano sin taller, otro rol)", async () => {
    falso.respuestas.push({ data: null, error: { message: "not_found" } });
    expect(await codigoDe(taller.getMyWorkshopStats())).toBe("not_found");
    falso.respuestas.push({ data: null, error: { message: "forbidden" } });
    expect(await codigoDe(taller.listMyWorkshopReviews())).toBe("forbidden");
  });
});

describe("Mi taller (simulado)", () => {
  async function conTaller() {
    await tallerMock.saveMyWorkshop(COMPLETO);
    await tallerMock.publishMyWorkshop();
  }
  const dia = (/** @type {number} */ n) => `2026-11-${String(n).padStart(2, "0")}T18:00:00.000Z`;

  test("sin datos: ceros, sin porcentaje de puntualidad y la calificación del taller", async () => {
    await conTaller();
    const r = await tallerMock.getMyWorkshopStats();
    expect(r).toMatchObject({ published: true, suspended: false, rating_avg: null, rating_count: 0 });
    expect(r.orders).toEqual({ total: 0, in_progress: 0, ready: 0, delivered: 0, on_time_pct: null });
    expect(r.requests).toEqual({ open: 0, quoted: 0, accepted: 0, cancelled: 0 });
  });

  test("calcula pedidos por estado, puntualidad con la hora de Mérida, solicitudes y promedio sin las reseñas ocultas", async () => {
    await conTaller();
    tallerMock.fijarDatosMiTallerSimulados({
      pedidos: [
        { status: "delivered", due_date: "2026-11-10", delivered_at: dia(10) }, // a tiempo (12:00 en Mérida del día 10)
        { status: "delivered", due_date: "2026-11-10", delivered_at: dia(11) }, // tarde
        { status: "delivered", due_date: "2026-11-10", delivered_at: "2026-11-11T05:00:00.000Z" }, // 23:00 del 10 en Mérida: a tiempo
        { status: "in_progress", due_date: "2026-11-20", delivered_at: null },
        { status: "ready", due_date: "2026-11-20", delivered_at: null },
      ],
      solicitudes: [{ status: "open" }, { status: "open" }, { status: "quoted" }, { status: "accepted" }, { status: "cancelled" }],
      resenas: [
        { id: "a", rating: 5, tags: [], comment: null, created_at: dia(1) },
        { id: "b", rating: 4, tags: ["Puntual"], comment: "Bien", created_at: dia(2) },
        { id: "c", rating: 1, tags: [], comment: "Mal", created_at: dia(3), hidden: true },
      ],
    });
    const r = await tallerMock.getMyWorkshopStats();
    expect(r.orders).toEqual({ total: 5, in_progress: 1, ready: 1, delivered: 3, on_time_pct: 66.7 });
    expect(r.requests).toEqual({ open: 2, quoted: 1, accepted: 1, cancelled: 1 });
    expect(r).toMatchObject({ rating_avg: 4.5, rating_count: 2 });
  });

  test("listMyWorkshopReviews: no ocultas, de la más reciente a la más antigua, sin datos del autor y con paginación", async () => {
    await conTaller();
    tallerMock.fijarDatosMiTallerSimulados({
      resenas: [
        { id: "a", rating: 5, tags: ["Puntual"], comment: "Excelente", created_at: dia(1), client_id: "secreto", order_id: "secreto" },
        { id: "b", rating: 4, tags: [], comment: null, created_at: dia(2) },
        { id: "c", rating: 1, tags: [], comment: "Oculta", created_at: dia(3), hidden: true },
      ],
    });
    const r = await tallerMock.listMyWorkshopReviews();
    expect(r.total).toBe(2);
    expect(r.items.map((x) => x.id)).toEqual(["b", "a"]);
    expect(Object.keys(r.items[1]).sort()).toEqual(["comment", "created_at", "id", "rating", "tags"]);
    expect((await tallerMock.listMyWorkshopReviews({ limit: 1, offset: 1 })).items.map((x) => x.id)).toEqual(["a"]);
    expect(await codigoDe(tallerMock.listMyWorkshopReviews({ limit: 0 }))).toBe("invalid_input");
  });

  test("sin taller: not_found; cliente, sin rol y admin: forbidden; inactivo y anónimo", async () => {
    expect(await codigoDe(tallerMock.getMyWorkshopStats())).toBe("not_found");
    expect(await codigoDe(tallerMock.listMyWorkshopReviews())).toBe("not_found");
    await conTaller();
    for (const rol of ["client", null, "admin"]) {
      tallerMock.fijarSesionSimulada({ rol });
      expect(await codigoDe(tallerMock.getMyWorkshopStats())).toBe("forbidden");
      expect(await codigoDe(tallerMock.listMyWorkshopReviews())).toBe("forbidden");
    }
    tallerMock.fijarSesionSimulada({ rol: "craftsman", activo: false });
    expect(await codigoDe(tallerMock.getMyWorkshopStats())).toBe("inactive_user");
    tallerMock.fijarSesionSimulada({ activo: true, sesion: false });
    expect(await codigoDe(tallerMock.getMyWorkshopStats())).toBe("not_authenticated");
  });
});

describe("notificaciones: contador y marcar todas (real)", () => {
  test("countUnreadNotifications cuenta solo las no leídas sin traer filas", async () => {
    falso.respuestas.push({ count: 3, error: null });
    await expect(solicitudes.countUnreadNotifications()).resolves.toBe(3);
    expect(falso.llamadas).toContainEqual(["select", "id", { count: "exact", head: true }]);
    expect(falso.llamadas).toContainEqual(["is", "read_at", null]);
    falso.respuestas.push({ count: null, error: null });
    await expect(solicitudes.countUnreadNotifications()).resolves.toBe(0);
  });

  test("markAllNotificationsRead marca solo las pendientes y devuelve cuántas", async () => {
    falso.respuestas.push({ data: [{ id: "1" }, { id: "2" }], error: null });
    await expect(solicitudes.markAllNotificationsRead()).resolves.toEqual({ updated: 2 });
    expect(falso.llamadas).toContainEqual(["is", "read_at", null]);
    const marca = falso.llamadas.find((l) => l[0] === "update");
    expect(Object.keys(marca?.[1] ?? {})).toEqual(["read_at"]);
    falso.respuestas.push({ data: [], error: null });
    await expect(solicitudes.markAllNotificationsRead()).resolves.toEqual({ updated: 0 });
  });

  test("traduce el error del servidor", async () => {
    falso.respuestas.push({ count: null, error: { code: "42501", message: "denied" } });
    expect(await codigoDe(solicitudes.countUnreadNotifications())).toBe("forbidden");
  });
});

describe("notificaciones: contador y marcar todas (simulado)", () => {
  test("el contador baja al marcar una y a 0 al marcar todas; solo cuenta las propias", async () => {
    sim.notificar(sim.UID_CLIENTE, "quote_received", {});
    sim.notificar(sim.UID_CLIENTE, "order_ready", {});
    sim.notificar(sim.UID_ARTESANO, "request_received", {});
    expect(await solicitudesMock.countUnreadNotifications()).toBe(2);
    const [primera] = await solicitudesMock.listMyNotifications();
    await solicitudesMock.markNotificationRead(primera.id);
    expect(await solicitudesMock.countUnreadNotifications()).toBe(1);
    expect(await solicitudesMock.markAllNotificationsRead()).toEqual({ updated: 1 });
    expect(await solicitudesMock.countUnreadNotifications()).toBe(0);
    expect(await solicitudesMock.markAllNotificationsRead()).toEqual({ updated: 0 });
    // Las del artesano siguen sin leer.
    solicitudesMock.fijarSesionSimulada({ rol: "craftsman" });
    expect(await solicitudesMock.countUnreadNotifications()).toBe(1);
  });

  test("sin sesión: not_authenticated", async () => {
    solicitudesMock.fijarSesionSimulada({ sesion: false });
    expect(await codigoDe(solicitudesMock.countUnreadNotifications())).toBe("not_authenticated");
    expect(await codigoDe(solicitudesMock.markAllNotificationsRead())).toBe("not_authenticated");
  });
});
