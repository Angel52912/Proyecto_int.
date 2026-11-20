import { jest } from "@jest/globals";

jest.unstable_mockModule("../../js/supabaseClient.js", () => ({ obtenerCliente: () => ({}) }));
const real = await import("../../js/features/admin/api.js");
const admin = await import("../../js/features/admin/api.mock.js");
const sim = await import("../../js/features/requests/simulacion.js");
const { ID_TALLER_SIMULADO } = sim;

const UUID_AJENO = "99999999-9999-4999-8999-999999999999";
const T1 = ID_TALLER_SIMULADO;
const T2 = "00000000-0000-4000-8000-0000000000a2";

/** @param {Promise<unknown>} promesa @returns {Promise<string>} */
async function codigoDe(promesa) {
  try {
    await promesa;
  } catch (error) {
    return /** @type {any} */ (error).code;
  }
  return "sin_error";
}

/** @param {{ id: string }[]} lista */
const ids = (lista) => lista.map((x) => x.id);

beforeEach(() => {
  admin.reiniciarSimulacion();
});

describe("administración: contrato", () => {
  test.each([
    "getDashboard", "listUsers", "setUserActive", "listWorkshops", "setWorkshopSuspended",
    "listReviews", "setReviewHidden", "listRequests", "listOrders", "listActions",
  ])("real y simulado exportan %s", (nombre) => {
    expect(typeof real[nombre]).toBe("function");
    expect(typeof admin[nombre]).toBe("function");
  });
});

describe("acceso: solo el admin activo", () => {
  /** Llamadas de lectura y de escritura de cada función. */
  const llamadas = () => [
    () => admin.getDashboard(),
    () => admin.listUsers(),
    () => admin.setUserActive(admin.UID_ADMIN2, false),
    () => admin.listWorkshops(),
    () => admin.setWorkshopSuspended(T1, true),
    () => admin.listReviews(),
    () => admin.setReviewHidden(admin.datosSimulados().resenas[0].id, true),
    () => admin.listRequests(),
    () => admin.listOrders(),
    () => admin.listActions(),
  ];

  test("cliente, artesano y usuario sin rol: forbidden en todas las funciones", async () => {
    for (const rol of ["client", "craftsman", null]) {
      admin.fijarSesionSimulada({ rol });
      for (const llamar of llamadas()) expect(await codigoDe(llamar())).toBe("forbidden");
    }
  });

  test("admin inactivo: inactive_user; anónimo: not_authenticated", async () => {
    admin.fijarSesionSimulada({ activo: false });
    for (const llamar of llamadas()) expect(await codigoDe(llamar())).toBe("inactive_user");
    admin.fijarSesionSimulada({ activo: true, sesion: false });
    for (const llamar of llamadas()) expect(await codigoDe(llamar())).toBe("not_authenticated");
  });

  test("las acciones denegadas no cambian datos ni escriben la bitácora", async () => {
    admin.fijarSesionSimulada({ rol: "client" });
    await codigoDe(admin.setUserActive(admin.UID_ADMIN2, false));
    await codigoDe(admin.setWorkshopSuspended(T1, true));
    expect(admin.datosSimulados().acciones).toEqual([]);
    expect(admin.datosSimulados().usuarios.every((u) => u.active)).toBe(true);
  });
});

describe("getDashboard", () => {
  test("totales de usuarios, talleres, solicitudes, pedidos y calificación promedio", async () => {
    expect(await admin.getDashboard()).toEqual({
      users: { total: 7, active: 7, clients: 2, craftsmen: 2, admins: 2, without_role: 1 },
      workshops: { total: 3, published: 2, suspended: 0 },
      requests: { total: 4, open: 1, quoted: 1, accepted: 1, cancelled: 1 },
      orders: { total: 3, in_progress: 1, ready: 1, delivered: 1, cancelled: 0 },
      reviews: { count: 3, rating_avg: 4 },
    });
  });

  test("las solicitudes en borrador no cuentan y las reseñas ocultas salen del promedio", async () => {
    admin.datosSimulados().solicitudes.push({ ...admin.datosSimulados().solicitudes[0], id: "x", status: "draft" });
    const resena = admin.datosSimulados().resenas[0];
    await admin.setReviewHidden(resena.id, true);
    const panel = await admin.getDashboard();
    expect(panel.requests.total).toBe(4);
    expect(panel.reviews).toEqual({ count: 2, rating_avg: 3.5 });
  });
});

describe("usuarios", () => {
  test("lista paginada con total, del más reciente al más antiguo, con correo y sin datos privados", async () => {
    const r = await admin.listUsers({ limit: 3 });
    expect(r.total).toBe(7);
    expect(r.items).toHaveLength(3);
    expect(Object.keys(r.items[0]).sort()).toEqual(["active", "created_at", "email", "full_name", "id", "role"]);
    expect(r.items[0].full_name).toBe(""); // el más reciente es el usuario sin rol
    expect(ids((await admin.listUsers({ limit: 3, offset: 6 })).items)).toHaveLength(1);
  });

  test("busca por nombre o correo sin distinguir mayúsculas y filtra por rol y estado", async () => {
    expect(ids((await admin.listUsers({ search: "SOPORTE" })).items)).toEqual([admin.UID_ADMIN2]);
    expect(ids((await admin.listUsers({ search: "cliente1@" })).items)).toHaveLength(1);
    expect((await admin.listUsers({ role: "craftsman" })).total).toBe(2);
    expect((await admin.listUsers({ active: false })).total).toBe(0);
    expect((await admin.listUsers({ search: "no-existe" })).items).toEqual([]);
  });

  test("filtros inválidos: invalid_input", async () => {
    for (const filtros of [{ role: "otro" }, { active: "si" }, { limit: 0 }, { limit: 101 }, { offset: -1 }, { search: "x".repeat(101) }, []]) {
      expect(await codigoDe(admin.listUsers(/** @type {any} */ (filtros)))).toBe("invalid_input");
    }
  });

  test("desactivar y reactivar: cambia el estado, guarda el motivo en la bitácora y no elimina al usuario", async () => {
    const objetivo = admin.UID_ARTESANO2;
    expect(await admin.setUserActive(objetivo, false, "  Reportes de abuso  ")).toEqual({ id: objetivo, active: false });
    expect(admin.datosSimulados().usuarios.find((u) => u.id === objetivo)).toMatchObject({ active: false });
    expect(await admin.setUserActive(objetivo, true)).toEqual({ id: objetivo, active: true });
    const { items } = await admin.listActions();
    expect(items.map((a) => a.action)).toEqual(["user_reactivated", "user_deactivated"]);
    expect(items[1]).toMatchObject({ admin_id: admin.UID_ADMIN, admin_name: "Admin Principal", target_table: "profiles", target_id: objetivo });
    expect(items[1].details).toMatchObject({ reason: "Reportes de abuso", previous_active: true, role: "craftsman" });
    expect(admin.datosSimulados().usuarios).toHaveLength(7);
  });

  test("A1: no puede desactivarse a sí mismo (forbidden) y no queda registrado", async () => {
    expect(await codigoDe(admin.setUserActive(admin.UID_ADMIN, false))).toBe("forbidden");
    expect(admin.datosSimulados().acciones).toEqual([]);
    expect(admin.datosSimulados().usuarios.find((u) => u.id === admin.UID_ADMIN)?.active).toBe(true);
  });

  test("A1: siempre queda al menos un admin activo (se revierte el cambio)", async () => {
    // Caso límite: el otro admin es el único que quedaría activo si el actor no contara; se simula quitando al actor.
    admin.datosSimulados().usuarios = admin.datosSimulados().usuarios.filter((u) => u.id !== admin.UID_ADMIN);
    expect(await codigoDe(admin.setUserActive(admin.UID_ADMIN2, false))).toBe("invalid_state");
    expect(admin.datosSimulados().usuarios.find((u) => u.id === admin.UID_ADMIN2)?.active).toBe(true);
    expect(admin.datosSimulados().acciones).toEqual([]);
  });

  test("un admin sí puede desactivar a otro admin mientras él siga activo", async () => {
    expect(await admin.setUserActive(admin.UID_ADMIN2, false)).toEqual({ id: admin.UID_ADMIN2, active: false });
  });

  test("mismo estado: invalid_state; inexistente: not_found; datos inválidos: invalid_input", async () => {
    expect(await codigoDe(admin.setUserActive(admin.UID_ARTESANO2, true))).toBe("invalid_state");
    expect(await codigoDe(admin.setUserActive(UUID_AJENO, false))).toBe("not_found");
    expect(await codigoDe(admin.setUserActive("x", false))).toBe("invalid_input");
    expect(await codigoDe(admin.setUserActive(admin.UID_ARTESANO2, "no"))).toBe("invalid_input");
    expect(await codigoDe(admin.setUserActive(admin.UID_ARTESANO2, false, "x".repeat(301)))).toBe("invalid_input");
  });
});

describe("talleres", () => {
  test("lista con dueño y filtros; busca por nombre, colonia o dueño", async () => {
    const todos = await admin.listWorkshops();
    expect(todos.total).toBe(3);
    expect(todos.items[0]).toHaveProperty("owner_name");
    expect(todos.items[0]).not.toHaveProperty("lat");
    expect(ids((await admin.listWorkshops({ search: "ginerés" })).items)).toEqual([T2]);
    expect(ids((await admin.listWorkshops({ search: "artesano uno" })).items)).toEqual([T1]);
    expect((await admin.listWorkshops({ published: false })).total).toBe(1);
    expect((await admin.listWorkshops({ suspended: true })).total).toBe(0);
  });

  test("suspender y reactivar: cambia el estado, avisa al dueño y queda en la bitácora", async () => {
    expect(await admin.setWorkshopSuspended(T1, true, "Fraude")).toEqual({ id: T1, suspended: true });
    expect(sim.estado.notificaciones.at(-1)).toMatchObject({ type: "workshop_suspended", payload: { workshop_id: T1 } });
    expect(sim.estado.notificaciones.at(-1)?.payload).not.toHaveProperty("reason");
    expect((await admin.getDashboard()).workshops).toEqual({ total: 3, published: 1, suspended: 1 });
    expect(await admin.setWorkshopSuspended(T1, false)).toEqual({ id: T1, suspended: false });
    expect(sim.estado.notificaciones.at(-1)?.type).toBe("workshop_reactivated");
    expect((await admin.listActions({ action: "workshop_suspended" })).items[0].details).toMatchObject({ reason: "Fraude" });
  });

  test("mismo estado: invalid_state; inexistente: not_found; datos inválidos: invalid_input", async () => {
    expect(await codigoDe(admin.setWorkshopSuspended(T1, false))).toBe("invalid_state");
    expect(await codigoDe(admin.setWorkshopSuspended(UUID_AJENO, true))).toBe("not_found");
    expect(await codigoDe(admin.setWorkshopSuspended("x", true))).toBe("invalid_input");
    expect(await codigoDe(admin.setWorkshopSuspended(T1, null))).toBe("invalid_input");
  });
});

describe("reseñas", () => {
  test("lista con nombre del taller y filtros", async () => {
    const todas = await admin.listReviews();
    expect(todas.total).toBe(3);
    expect(todas.items[0]).toMatchObject({ workshop_name: "Talabartería Yucatán" });
    expect((await admin.listReviews({ workshop_id: T1 })).total).toBe(2);
    expect((await admin.listReviews({ hidden: true })).total).toBe(0);
    expect(await codigoDe(admin.listReviews({ workshop_id: "x" }))).toBe("invalid_input");
  });

  test("ocultar recalcula el promedio del taller; restaurar lo devuelve", async () => {
    const [primera] = (await admin.listReviews({ workshop_id: T1 })).items.sort((a, b) => b.rating - a.rating);
    expect(await admin.setReviewHidden(primera.id, true, "Insultos")).toEqual({ id: primera.id, hidden: true, workshop_id: T1, rating_avg: 4, rating_count: 1 });
    expect((await admin.listReviews({ hidden: true })).total).toBe(1);
    expect(await admin.setReviewHidden(primera.id, false)).toMatchObject({ hidden: false, rating_avg: 4.5, rating_count: 2 });
    expect((await admin.listActions()).items.map((a) => a.action)).toEqual(["review_restored", "review_hidden"]);
  });

  test("ocultar la única reseña deja el promedio en null", async () => {
    const unica = (await admin.listReviews({ workshop_id: T2 })).items[0];
    expect(await admin.setReviewHidden(unica.id, true)).toMatchObject({ rating_avg: null, rating_count: 0 });
  });

  test("mismo estado: invalid_state; inexistente: not_found; datos inválidos: invalid_input", async () => {
    const r = admin.datosSimulados().resenas[0].id;
    expect(await codigoDe(admin.setReviewHidden(r, false))).toBe("invalid_state");
    expect(await codigoDe(admin.setReviewHidden(UUID_AJENO, true))).toBe("not_found");
    expect(await codigoDe(admin.setReviewHidden("x", true))).toBe("invalid_input");
    expect(await codigoDe(admin.setReviewHidden(r, 1))).toBe("invalid_input");
  });
});

describe("solicitudes y pedidos (solo lectura)", () => {
  test("solicitudes: estatus y fechas, sin descripción, fotos ni chat; los borradores no se listan", async () => {
    admin.datosSimulados().solicitudes.push({ ...admin.datosSimulados().solicitudes[0], id: "borrador", status: "draft" });
    const r = await admin.listRequests();
    expect(r.total).toBe(4);
    expect(Object.keys(r.items[0]).sort()).toEqual(["client_id", "created_at", "id", "service_type", "status", "submitted_at", "updated_at", "workshop_id", "workshop_name"]);
    expect((await admin.listRequests({ status: "quoted" })).total).toBe(1);
    expect(await codigoDe(admin.listRequests({ status: "draft" }))).toBe("invalid_input");
    expect(await codigoDe(admin.listRequests({ status: "otro" }))).toBe("invalid_input");
  });

  test("pedidos: fase, estatus y fechas, sin montos, fotos ni PIN", async () => {
    const r = await admin.listOrders();
    expect(r.total).toBe(3);
    expect(Object.keys(r.items[0]).sort()).toEqual(
      ["client_id", "created_at", "delivered_at", "due_date", "id", "phase", "ready_at", "request_id", "status", "updated_at", "workshop_id", "workshop_name"].sort(),
    );
    expect((await admin.listOrders({ status: "ready" })).total).toBe(1);
    expect((await admin.listOrders({ status: "cancelled" })).items).toEqual([]);
    expect(await codigoDe(admin.listOrders({ status: "otro" }))).toBe("invalid_input");
  });

  test("las consultas no generan entradas en la bitácora", async () => {
    await admin.getDashboard();
    await admin.listUsers();
    await admin.listRequests();
    await admin.listOrders();
    expect((await admin.listActions()).total).toBe(0);
  });
});

describe("bitácora", () => {
  test("registra quién, qué y cuándo; filtra por admin y acción; del más reciente al más antiguo", async () => {
    await admin.setUserActive(admin.UID_ARTESANO2, false);
    await admin.setWorkshopSuspended(T2, true);
    const todas = await admin.listActions();
    expect(todas.total).toBe(2);
    expect(todas.items.map((a) => a.action)).toEqual(["workshop_suspended", "user_deactivated"]);
    expect(Date.parse(todas.items[0].created_at)).toBeGreaterThanOrEqual(Date.parse(todas.items[1].created_at));
    expect((await admin.listActions({ action: "user_deactivated" })).total).toBe(1);
    expect((await admin.listActions({ admin_id: admin.UID_ADMIN2 })).total).toBe(0);
    expect((await admin.listActions({ limit: 1, offset: 1 })).items.map((a) => a.action)).toEqual(["user_deactivated"]);
  });

  test("filtros inválidos: invalid_input", async () => {
    expect(await codigoDe(admin.listActions({ admin_id: "x" }))).toBe("invalid_input");
    expect(await codigoDe(admin.listActions({ action: "x".repeat(101) }))).toBe("invalid_input");
    expect(await codigoDe(admin.listActions({ action: "x".repeat(51) }))).toBe("invalid_input");
  });
});
