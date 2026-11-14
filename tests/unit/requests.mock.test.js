import { jest } from "@jest/globals";

jest.unstable_mockModule("../../js/supabaseClient.js", () => ({ obtenerCliente: () => ({}) }));
const real = await import("../../js/features/requests/api.js");
const mock = await import("../../js/features/requests/api.mock.js");

const FUNCIONES_DEL_CONTRATO = [
  "createRequestDraft",
  "addRequestPhoto",
  "removeRequestPhoto",
  "submitRequest",
  "cancelRequest",
  "listMyRequests",
  "getRequest",
  "listMyNotifications",
  "markNotificationRead",
  "subscribeToNotifications",
];

const TALLER = mock.ID_TALLER_SIMULADO;
const DATOS = { workshop_id: TALLER, service_type: "repair", description: "  Se despegó la suela  " };
const FOTO = { type: "image/jpeg", size: 1000 };
const UUID_AJENO = "99999999-9999-4999-8999-999999999999";

/** @param {Promise<unknown>} promesa @returns {Promise<string>} */
async function codigoDe(promesa) {
  try {
    await promesa;
  } catch (error) {
    return /** @type {any} */ (error).code;
  }
  return "sin_error";
}

/** Crea un borrador con una foto y lo envía. */
async function solicitudAbierta(datos = DATOS) {
  const borrador = await mock.createRequestDraft(datos);
  await mock.addRequestPhoto(borrador.id, FOTO);
  await mock.submitRequest(borrador.id);
  return borrador;
}

beforeEach(() => {
  mock.reiniciarSimulacion();
});

describe("requests: contrato", () => {
  test.each(FUNCIONES_DEL_CONTRATO)("real y simulado exportan %s", (nombre) => {
    expect(typeof real[nombre]).toBe("function");
    expect(typeof mock[nombre]).toBe("function");
  });
});

describe("requests/api.mock.js: borrador y fotos", () => {
  test("crea el borrador con la descripción recortada", async () => {
    const s = await mock.createRequestDraft(DATOS);
    expect(s).toMatchObject({ status: "draft", description: "Se despegó la suela", photo_count: 0, submitted_at: null });
  });

  test("un segundo borrador al mismo taller reutiliza el existente", async () => {
    const a = await mock.createRequestDraft(DATOS);
    const b = await mock.createRequestDraft({ ...DATOS, description: "Otra" });
    expect(b.id).toBe(a.id);
    expect(b.description).toBe("Otra");
  });

  test.each([
    ["descripción vacía", { ...DATOS, description: "   " }],
    ["descripción de más de 1000", { ...DATOS, description: "x".repeat(1001) }],
    ["servicio inválido", { ...DATOS, service_type: "pintura" }],
    ["taller que no es uuid", { ...DATOS, workshop_id: "abc" }],
  ])("datos inválidos: %s", async (_nombre, datos) => {
    expect(await codigoDe(mock.createRequestDraft(/** @type {any} */ (datos)))).toBe("invalid_input");
  });

  test("taller inexistente, suspendido, sin publicar o sin ese servicio: forbidden", async () => {
    expect(await codigoDe(mock.createRequestDraft({ ...DATOS, workshop_id: UUID_AJENO }))).toBe("forbidden");
    mock.fijarTallerSimulado({ suspended: true });
    expect(await codigoDe(mock.createRequestDraft(DATOS))).toBe("forbidden");
    mock.fijarTallerSimulado({ suspended: false, published: false });
    expect(await codigoDe(mock.createRequestDraft(DATOS))).toBe("forbidden");
    mock.fijarTallerSimulado({ published: true, services: ["cleaning"] });
    expect(await codigoDe(mock.createRequestDraft(DATOS))).toBe("forbidden");
  });

  test("solo un cliente activo crea solicitudes", async () => {
    mock.fijarSesionSimulada({ rol: "craftsman" });
    expect(await codigoDe(mock.createRequestDraft(DATOS))).toBe("forbidden");
    mock.fijarSesionSimulada({ rol: "client", activo: false });
    expect(await codigoDe(mock.createRequestDraft(DATOS))).toBe("forbidden");
    mock.fijarSesionSimulada({ activo: true, sesion: false });
    expect(await codigoDe(mock.createRequestDraft(DATOS))).toBe("not_authenticated");
  });

  test("A1: rechaza archivos que no son jpeg, png o webp, o de más de 5 MB", async () => {
    const s = await mock.createRequestDraft(DATOS);
    expect(await codigoDe(mock.addRequestPhoto(s.id, { type: "image/svg+xml", size: 10 }))).toBe("invalid_input");
    expect(await codigoDe(mock.addRequestPhoto(s.id, { type: "application/pdf", size: 10 }))).toBe("invalid_input");
    expect(await codigoDe(mock.addRequestPhoto(s.id, { type: "image/png", size: 5 * 1024 * 1024 + 1 }))).toBe("invalid_input");
    expect((await mock.addRequestPhoto(s.id, { type: "image/webp", size: 5 * 1024 * 1024 })).url).toContain("request-photos");
  });

  test("máximo 5 fotos: la sexta lanza limit_reached", async () => {
    const s = await mock.createRequestDraft(DATOS);
    for (let i = 0; i < 5; i++) await mock.addRequestPhoto(s.id, FOTO);
    expect(await codigoDe(mock.addRequestPhoto(s.id, FOTO))).toBe("limit_reached");
  });

  test("solo se suben y quitan fotos de borradores propios", async () => {
    const abierta = await solicitudAbierta();
    expect(await codigoDe(mock.addRequestPhoto(abierta.id, FOTO))).toBe("forbidden");
    expect(await codigoDe(mock.addRequestPhoto(UUID_AJENO, FOTO))).toBe("forbidden");
    const { photos } = await mock.getRequest(abierta.id);
    expect(await codigoDe(mock.removeRequestPhoto(photos[0].id))).toBe("not_found");
  });

  test("quita una foto del borrador", async () => {
    const s = await mock.createRequestDraft(DATOS);
    const foto = await mock.addRequestPhoto(s.id, FOTO);
    await mock.removeRequestPhoto(foto.id);
    expect((await mock.getRequest(s.id)).photo_count).toBe(0);
    expect(await codigoDe(mock.removeRequestPhoto(foto.id))).toBe("not_found");
  });
});

describe("requests/api.mock.js: enviar y cancelar", () => {
  test("enviar pasa a open, abre el chat y notifica al artesano", async () => {
    const s = await solicitudAbierta();
    expect((await mock.getRequest(s.id)).status).toBe("open");
    mock.fijarSesionSimulada({ rol: "craftsman" });
    const [nota] = await mock.listMyNotifications();
    expect(nota).toMatchObject({ type: "request_received", payload: { request_id: s.id }, read_at: null });
    expect(nota).not.toHaveProperty("user_id");
  });

  test("sin fotos lanza photo_required", async () => {
    const s = await mock.createRequestDraft(DATOS);
    expect(await codigoDe(mock.submitRequest(s.id))).toBe("photo_required");
  });

  test("no se envía dos veces ni una solicitud ajena o inexistente", async () => {
    const s = await solicitudAbierta();
    expect(await codigoDe(mock.submitRequest(s.id))).toBe("invalid_state");
    expect(await codigoDe(mock.submitRequest(UUID_AJENO))).toBe("not_found");
    expect(await codigoDe(mock.submitRequest("no-uuid"))).toBe("invalid_input");
  });

  test("si el taller deja de estar disponible, enviar lanza invalid_state", async () => {
    const s = await mock.createRequestDraft(DATOS);
    await mock.addRequestPhoto(s.id, FOTO);
    mock.fijarTallerSimulado({ suspended: true });
    expect(await codigoDe(mock.submitRequest(s.id))).toBe("invalid_state");
  });

  test("máximo 5 activas por cliente: la sexta lanza limit_reached", async () => {
    // Un solo taller simulado: se llenan las activas con solicitudes de otros talleres sembradas en el estado.
    const sim = await import("../../js/features/requests/simulacion.js");
    for (let i = 0; i < 5; i++) {
      sim.estado.solicitudes.push({
        id: sim.idSimulado(),
        client_id: sim.UID_CLIENTE,
        workshop_id: sim.idSimulado(),
        service_type: "repair",
        description: "x",
        status: i % 2 === 0 ? "open" : "quoted",
        submitted_at: null,
        created_at: new Date().toISOString(),
      });
    }
    const s = await mock.createRequestDraft(DATOS);
    await mock.addRequestPhoto(s.id, FOTO);
    expect(await codigoDe(mock.submitRequest(s.id))).toBe("limit_reached");
  });

  test("solo cuentan como activas open y quoted (cancelada libera el cupo)", async () => {
    const s = await solicitudAbierta();
    await mock.cancelRequest(s.id);
    const otra = await solicitudAbierta();
    expect(otra.id).not.toBe(s.id);
  });

  test("A2: cancelar desde open notifica y deja el chat sin mensajes nuevos", async () => {
    const s = await solicitudAbierta();
    expect(await mock.cancelRequest(s.id)).toEqual({ id: s.id, status: "cancelled" });
    mock.fijarSesionSimulada({ rol: "craftsman" });
    expect((await mock.listMyNotifications()).map((n) => n.type)).toEqual(["request_cancelled", "request_received"]);
  });

  test("A2: desde draft o ya cancelada lanza invalid_state; ajena, not_found", async () => {
    const borrador = await mock.createRequestDraft(DATOS);
    expect(await codigoDe(mock.cancelRequest(borrador.id))).toBe("invalid_state");
    await mock.addRequestPhoto(borrador.id, FOTO);
    await mock.submitRequest(borrador.id);
    await mock.cancelRequest(borrador.id);
    expect(await codigoDe(mock.cancelRequest(borrador.id))).toBe("invalid_state");
    expect(await codigoDe(mock.cancelRequest(UUID_AJENO))).toBe("not_found");
  });

  test("el artesano, el admin y un usuario sin rol no envían ni cancelan", async () => {
    const s = await solicitudAbierta();
    for (const rol of ["craftsman", "admin", null]) {
      mock.fijarSesionSimulada({ rol });
      expect(await codigoDe(mock.submitRequest(s.id))).toBe("forbidden");
      expect(await codigoDe(mock.cancelRequest(s.id))).toBe("forbidden");
    }
    mock.fijarSesionSimulada({ rol: "client", activo: false });
    expect(await codigoDe(mock.cancelRequest(s.id))).toBe("inactive_user");
    mock.fijarSesionSimulada({ activo: true, sesion: false });
    expect(await codigoDe(mock.cancelRequest(s.id))).toBe("not_authenticated");
  });
});

describe("requests/api.mock.js: consulta por rol", () => {
  test("el cliente ve sus solicitudes (con borradores) de la más reciente a la más antigua", async () => {
    const a = await solicitudAbierta();
    mock.fijarTallerSimulado({ services: ["repair", "cleaning"] });
    const lista = await mock.listMyRequests();
    expect(lista.map((s) => s.id)).toEqual([a.id]);
    expect(lista[0].photo_count).toBe(1);
  });

  test("el artesano no ve borradores; sí las abiertas", async () => {
    const borrador = await mock.createRequestDraft(DATOS);
    mock.fijarSesionSimulada({ rol: "craftsman" });
    expect(await mock.listMyRequests()).toEqual([]);
    expect(await codigoDe(mock.getRequest(borrador.id))).toBe("not_found");
    mock.fijarSesionSimulada({ rol: "client" });
    await mock.addRequestPhoto(borrador.id, FOTO);
    await mock.submitRequest(borrador.id);
    mock.fijarSesionSimulada({ rol: "craftsman" });
    expect((await mock.listMyRequests()).map((s) => s.id)).toEqual([borrador.id]);
    expect((await mock.getRequest(borrador.id)).counterpart).toMatchObject({ full_name: "Cliente Simulado" });
  });

  test.each([["admin"], [null]])("rol %s no ve solicitudes", async (rol) => {
    const s = await solicitudAbierta();
    mock.fijarSesionSimulada({ rol });
    expect(await mock.listMyRequests()).toEqual([]);
    expect(await codigoDe(mock.getRequest(s.id))).toBe("not_found");
  });

  test("anónimo recibe not_authenticated", async () => {
    mock.fijarSesionSimulada({ sesion: false });
    expect(await codigoDe(mock.listMyRequests())).toBe("not_authenticated");
    expect(await codigoDe(mock.getRequest(UUID_AJENO))).toBe("not_authenticated");
  });

  test("la contraparte del cliente es null si el taller ya no está publicado", async () => {
    const s = await solicitudAbierta();
    mock.fijarTallerSimulado({ published: false });
    expect((await mock.getRequest(s.id)).counterpart).toBeNull();
  });
});

describe("requests/api.mock.js: notificaciones", () => {
  test("marcar como leída y filtrar no leídas; solo las propias", async () => {
    await solicitudAbierta();
    mock.fijarSesionSimulada({ rol: "craftsman" });
    const [nota] = await mock.listMyNotifications();
    expect((await mock.markNotificationRead(nota.id)).read_at).not.toBeNull();
    expect(await mock.listMyNotifications({ unreadOnly: true })).toEqual([]);
    mock.fijarSesionSimulada({ rol: "client" });
    expect(await mock.listMyNotifications()).toEqual([]);
    expect(await codigoDe(mock.markNotificationRead(nota.id))).toBe("not_found");
    expect(await codigoDe(mock.markNotificationRead("no-uuid"))).toBe("invalid_input");
  });

  test("la suscripción recibe la notificación nueva y se puede cancelar", async () => {
    mock.fijarSesionSimulada({ rol: "craftsman" });
    const recibidas = [];
    const cancelar = await mock.subscribeToNotifications((n) => recibidas.push(n));
    mock.fijarSesionSimulada({ rol: "client" });
    await solicitudAbierta();
    expect(recibidas.map((n) => n.type)).toEqual(["request_received"]);
    cancelar();
    await mock.cancelRequest((await mock.listMyRequests())[0].id);
    expect(recibidas).toHaveLength(1);
  });
});
