import { jest } from "@jest/globals";

jest.unstable_mockModule("../../js/supabaseClient.js", () => ({ obtenerCliente: () => ({}) }));
const realOrders = await import("../../js/features/orders/api.js");
const quotes = await import("../../js/features/quotes/api.mock.js");
const orders = await import("../../js/features/orders/api.mock.js");
const solicitudes = await import("../../js/features/requests/api.mock.js");
const sim = await import("../../js/features/requests/simulacion.js");
const { fechaDeHoy } = await import("../../js/features/quotes/validar.js");

const FOTO = { type: "image/png", size: 1000 };
const MANANA = fechaDeHoy(new Date(Date.now() + 86_400_000));
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

/** Crea una orden en fase 1 y deja la sesión como artesano. @returns {Promise<string>} id de la orden */
async function crearOrden() {
  const s = await solicitudes.createRequestDraft({ workshop_id: sim.ID_TALLER_SIMULADO, service_type: "repair", description: "Suela" });
  await solicitudes.addRequestPhoto(s.id, FOTO);
  await solicitudes.submitRequest(s.id);
  sim.fijarSesionSimulada({ rol: "craftsman" });
  const q = await quotes.sendQuote(s.id, { amount_mxn: 300, delivery_date: MANANA });
  sim.fijarSesionSimulada({ rol: "client" });
  const r = await quotes.respondQuote(q.id, true);
  sim.fijarSesionSimulada({ rol: "craftsman" });
  return /** @type {string} */ (r.order_id);
}

beforeEach(() => {
  sim.reiniciarSimulacion();
});

describe("fases del pedido: contrato", () => {
  test.each(["advanceOrderPhase", "markOrderReady", "listOrderUpdates", "subscribeToOrderUpdates"])("real y simulado exportan %s", (nombre) => {
    expect(typeof realOrders[nombre]).toBe("function");
    expect(typeof orders[nombre]).toBe("function");
  });
});

describe("advanceOrderPhase (simulado)", () => {
  test("flujo principal: avanza de una en una, guarda el avance y notifica al cliente", async () => {
    const id = await crearOrden();
    const r = await orders.advanceOrderPhase(id, { phase: 2, photo: FOTO, note: "Limpieza inicial" });
    expect(r).toMatchObject({ order_id: id, phase: 2, status: "in_progress", update: { phase: 2, corrected: false, note: "Limpieza inicial" } });
    expect((await orders.getOrder(id)).phase).toBe(2);
    expect(sim.estado.notificaciones.map((n) => n.type)).toContain("order_phase_changed");

    sim.fijarSesionSimulada({ rol: "client" });
    const avances = await orders.listOrderUpdates(id);
    expect(avances).toHaveLength(1);
    expect(avances[0].url).toContain(avances[0].photo_path);
  });

  test("sin foto: photo_required; foto no válida: invalid_input", async () => {
    const id = await crearOrden();
    expect(await codigoDe(orders.advanceOrderPhase(id, { phase: 2 }))).toBe("photo_required");
    expect(await codigoDe(orders.advanceOrderPhase(id, { phase: 2, photo: { type: "application/pdf", size: 10 } }))).toBe("invalid_input");
    expect(await codigoDe(orders.advanceOrderPhase(id, { phase: 2, photo: { type: "image/png", size: 6 * 1024 * 1024 } }))).toBe("invalid_input");
  });

  test("A1: un salto o retroceso exige confirmación y nota; con ellas queda corrected", async () => {
    const id = await crearOrden();
    expect(await codigoDe(orders.advanceOrderPhase(id, { phase: 3, photo: FOTO }))).toBe("confirmation_required");
    expect(await codigoDe(orders.advanceOrderPhase(id, { phase: 3, photo: FOTO, confirm: true }))).toBe("confirmation_required");
    expect(await codigoDe(orders.advanceOrderPhase(id, { phase: 3, photo: FOTO, note: "Salté la 2", confirm: false }))).toBe("confirmation_required");
    const salto = await orders.advanceOrderPhase(id, { phase: 3, photo: FOTO, note: "Salté la 2", confirm: true });
    expect(salto.update.corrected).toBe(true);
    const atras = await orders.advanceOrderPhase(id, { phase: 1, photo: FOTO, note: "Error de captura", confirm: true });
    expect(atras).toMatchObject({ phase: 1, update: { corrected: true } });
  });

  test("misma fase, fase fuera de rango o nota larga: invalid_input", async () => {
    const id = await crearOrden();
    expect(await codigoDe(orders.advanceOrderPhase(id, { phase: 1, photo: FOTO }))).toBe("invalid_input");
    expect(await codigoDe(orders.advanceOrderPhase(id, { phase: 5, photo: FOTO }))).toBe("invalid_input");
    expect(await codigoDe(orders.advanceOrderPhase(id, { phase: 2, photo: FOTO, note: "x".repeat(501) }))).toBe("invalid_input");
    expect(await codigoDe(orders.advanceOrderPhase("no-es-uuid", { phase: 2, photo: FOTO }))).toBe("invalid_input");
  });

  test("cliente, sin rol y admin: forbidden; anónimo: not_authenticated; inactivo: inactive_user", async () => {
    const id = await crearOrden();
    for (const rol of ["client", null, "admin"]) {
      sim.fijarSesionSimulada({ rol });
      expect(await codigoDe(orders.advanceOrderPhase(id, { phase: 2, photo: FOTO }))).toBe("forbidden");
    }
    sim.fijarSesionSimulada({ rol: "craftsman", activo: false });
    expect(await codigoDe(orders.advanceOrderPhase(id, { phase: 2, photo: FOTO }))).toBe("inactive_user");
    sim.fijarSesionSimulada({ activo: true, sesion: false });
    expect(await codigoDe(orders.advanceOrderPhase(id, { phase: 2, photo: FOTO }))).toBe("not_authenticated");
  });

  test("orden inexistente: not_found; taller suspendido: forbidden; orden lista: invalid_state", async () => {
    const id = await crearOrden();
    expect(await codigoDe(orders.advanceOrderPhase(UUID_AJENO, { phase: 2, photo: FOTO }))).toBe("not_found");
    sim.fijarTallerSimulado({ suspended: true });
    expect(await codigoDe(orders.advanceOrderPhase(id, { phase: 2, photo: FOTO }))).toBe("forbidden");
    sim.fijarTallerSimulado({ suspended: false });
    sim.estado.ordenes[0].status = "ready";
    expect(await codigoDe(orders.advanceOrderPhase(id, { phase: 2, photo: FOTO }))).toBe("invalid_state");
  });
});

describe("markOrderReady (simulado)", () => {
  test("solo en fase 4: marca listo, avisa al cliente y agrega mensaje de sistema", async () => {
    const id = await crearOrden();
    expect(await codigoDe(orders.markOrderReady(id))).toBe("invalid_state");
    for (const phase of [2, 3, 4]) await orders.advanceOrderPhase(id, { phase, photo: FOTO });
    const r = await orders.markOrderReady(id);
    expect(r).toMatchObject({ order_id: id, status: "ready", phase: 4 });
    expect(r.ready_at).toEqual(expect.any(String));
    expect(sim.estado.notificaciones.map((n) => n.type)).toContain("order_ready");
    expect(sim.estado.mensajes.at(-1)).toMatchObject({ kind: "system", sender_id: null });
    expect(await codigoDe(orders.markOrderReady(id))).toBe("invalid_state");
  });

  test("cliente: forbidden; orden inexistente: not_found", async () => {
    const id = await crearOrden();
    expect(await codigoDe(orders.markOrderReady(UUID_AJENO))).toBe("not_found");
    sim.fijarSesionSimulada({ rol: "client" });
    expect(await codigoDe(orders.markOrderReady(id))).toBe("forbidden");
  });
});

describe("listOrderUpdates y subscribeToOrderUpdates (simulado)", () => {
  test("ven los participantes; el admin y los sin rol reciben []", async () => {
    const id = await crearOrden();
    await orders.advanceOrderPhase(id, { phase: 2, photo: FOTO });
    expect(await orders.listOrderUpdates(id)).toHaveLength(1);
    sim.fijarSesionSimulada({ rol: "client" });
    expect(await orders.listOrderUpdates(id)).toHaveLength(1);
    for (const rol of ["admin", null]) {
      sim.fijarSesionSimulada({ rol });
      expect(await orders.listOrderUpdates(id)).toEqual([]);
    }
    sim.fijarSesionSimulada({ sesion: false });
    expect(await codigoDe(orders.listOrderUpdates(id))).toBe("not_authenticated");
  });

  test("el cliente recibe en vivo cada avance y deja de recibir al cancelar", async () => {
    const id = await crearOrden();
    sim.fijarSesionSimulada({ rol: "client" });
    /** @type {number[]} */
    const fases = [];
    const cancelar = await orders.subscribeToOrderUpdates(id, (a) => fases.push(a.phase));
    sim.fijarSesionSimulada({ rol: "craftsman" });
    await orders.advanceOrderPhase(id, { phase: 2, photo: FOTO });
    cancelar();
    await orders.advanceOrderPhase(id, { phase: 3, photo: FOTO });
    expect(fases).toEqual([2]);
  });

  test("quien no participa no recibe avances", async () => {
    const id = await crearOrden();
    sim.fijarSesionSimulada({ rol: "admin" });
    const recibidos = [];
    await orders.subscribeToOrderUpdates(id, (a) => recibidos.push(a));
    sim.fijarSesionSimulada({ rol: "craftsman" });
    await orders.advanceOrderPhase(id, { phase: 2, photo: FOTO });
    expect(recibidos).toEqual([]);
  });
});
