import { jest } from "@jest/globals";

jest.unstable_mockModule("../../js/supabaseClient.js", () => ({ obtenerCliente: () => ({}) }));
const realQuotes = await import("../../js/features/quotes/api.js");
const realOrders = await import("../../js/features/orders/api.js");
const quotes = await import("../../js/features/quotes/api.mock.js");
const orders = await import("../../js/features/orders/api.mock.js");
const solicitudes = await import("../../js/features/requests/api.mock.js");
const chat = await import("../../js/features/chat/api.mock.js");
const sim = await import("../../js/features/requests/simulacion.js");
const { fechaDeHoy, validarDatosPresupuesto } = await import("../../js/features/quotes/validar.js");

const FOTO = { type: "image/png", size: 1000 };
const UUID_AJENO = "99999999-9999-4999-8999-999999999999";
const MANANA = fechaDeHoy(new Date(Date.now() + 86_400_000));
const PRESUPUESTO = { amount_mxn: 350.5, delivery_date: MANANA, detail: { note: "Cambio de suela" } };

/** @param {Promise<unknown>} promesa @returns {Promise<string>} */
async function codigoDe(promesa) {
  try {
    await promesa;
  } catch (error) {
    return /** @type {any} */ (error).code;
  }
  return "sin_error";
}

/** @returns {Promise<string>} id de una solicitud abierta (sesión de cliente) */
async function abrirSolicitud() {
  const s = await solicitudes.createRequestDraft({ workshop_id: sim.ID_TALLER_SIMULADO, service_type: "repair", description: "Suela" });
  await solicitudes.addRequestPhoto(s.id, FOTO);
  await solicitudes.submitRequest(s.id);
  return s.id;
}

/** Abre una solicitud y el artesano envía un presupuesto; deja la sesión como cliente. @returns {Promise<{ requestId: string, quoteId: string }>} */
async function cotizar() {
  const requestId = await abrirSolicitud();
  sim.fijarSesionSimulada({ rol: "craftsman" });
  const q = await quotes.sendQuote(requestId, PRESUPUESTO);
  sim.fijarSesionSimulada({ rol: "client" });
  return { requestId, quoteId: q.id };
}

beforeEach(() => {
  sim.reiniciarSimulacion();
});

describe("presupuestos y órdenes: contrato", () => {
  test.each(["sendQuote", "respondQuote", "getQuote", "listQuotes"])("real y simulado exportan %s", (nombre) => {
    expect(typeof realQuotes[nombre]).toBe("function");
    expect(typeof quotes[nombre]).toBe("function");
  });
  test.each(["listMyOrders", "getOrder"])("real y simulado exportan %s", (nombre) => {
    expect(typeof realOrders[nombre]).toBe("function");
    expect(typeof orders[nombre]).toBe("function");
  });
});

describe("validarDatosPresupuesto", () => {
  test("acepta un presupuesto válido y completa el detalle vacío", () => {
    expect(validarDatosPresupuesto({ amount_mxn: 100, delivery_date: MANANA })).toEqual({ amount_mxn: 100, delivery_date: MANANA, detail: {} });
  });
  test.each([0, -5, NaN, Infinity, 100000000, 10.123, "100"])("rechaza el monto %p", (monto) => {
    expect(() => validarDatosPresupuesto({ amount_mxn: /** @type {any} */ (monto), delivery_date: MANANA })).toThrow(
      expect.objectContaining({ code: "invalid_input" }),
    );
  });
  test.each(["2020-01-01", "2026-02-30", "mañana", "2026-1-1", ""])("rechaza la fecha %p", (fecha) => {
    expect(() => validarDatosPresupuesto({ amount_mxn: 100, delivery_date: fecha })).toThrow(expect.objectContaining({ code: "invalid_input" }));
  });
  test("acepta la fecha de hoy y rechaza el detalle que no es objeto o es muy largo", () => {
    expect(() => validarDatosPresupuesto({ amount_mxn: 100, delivery_date: fechaDeHoy() })).not.toThrow();
    expect(() => validarDatosPresupuesto({ amount_mxn: 100, delivery_date: MANANA, detail: /** @type {any} */ ([1]) })).toThrow();
    expect(() => validarDatosPresupuesto({ amount_mxn: 100, delivery_date: MANANA, detail: { x: "a".repeat(2000) } })).toThrow();
  });
});

describe("sendQuote", () => {
  test("flujo principal: crea el presupuesto, deja la solicitud cotizada, pone la tarjeta en el chat y avisa al cliente", async () => {
    const requestId = await abrirSolicitud();
    sim.fijarSesionSimulada({ rol: "craftsman" });
    const q = await quotes.sendQuote(requestId, PRESUPUESTO);
    expect(q).toMatchObject({ request_id: requestId, amount_mxn: 350.5, delivery_date: MANANA, status: "sent", responded_at: null });
    expect((await solicitudes.getRequest(requestId)).status).toBe("quoted");
    const tarjeta = (await chat.listMessages(requestId)).find((m) => m.kind === "quote_card");
    expect(tarjeta).toMatchObject({ quote_id: q.id, sender_id: sim.UID_ARTESANO });
    sim.fijarSesionSimulada({ rol: "client" });
    expect((await solicitudes.listMyNotifications()).map((n) => n.type)).toContain("quote_received");
  });

  test("A2: un segundo envío rectifica y deja el anterior en superseded (solo uno vigente)", async () => {
    const { requestId, quoteId } = await cotizar();
    sim.fijarSesionSimulada({ rol: "craftsman" });
    const nuevo = await quotes.sendQuote(requestId, { ...PRESUPUESTO, amount_mxn: 400 });
    const lista = await quotes.listQuotes(requestId);
    expect(lista.map((q) => [q.id, q.status])).toEqual([
      [quoteId, "superseded"],
      [nuevo.id, "sent"],
    ]);
  });

  test("el cliente no puede enviar presupuestos (forbidden) y sin sesión lanza not_authenticated", async () => {
    const requestId = await abrirSolicitud();
    expect(await codigoDe(quotes.sendQuote(requestId, PRESUPUESTO))).toBe("forbidden");
    sim.fijarSesionSimulada({ sesion: false });
    expect(await codigoDe(quotes.sendQuote(requestId, PRESUPUESTO))).toBe("not_authenticated");
  });

  test("artesano inactivo lanza inactive_user y sin rol lanza forbidden", async () => {
    const requestId = await abrirSolicitud();
    sim.fijarSesionSimulada({ rol: "craftsman", activo: false });
    expect(await codigoDe(quotes.sendQuote(requestId, PRESUPUESTO))).toBe("inactive_user");
    sim.fijarSesionSimulada({ rol: null, activo: true });
    expect(await codigoDe(quotes.sendQuote(requestId, PRESUPUESTO))).toBe("forbidden");
  });

  test("solicitud inexistente: not_found; datos inválidos: invalid_input; id mal formado: invalid_input", async () => {
    sim.fijarSesionSimulada({ rol: "craftsman" });
    expect(await codigoDe(quotes.sendQuote(UUID_AJENO, PRESUPUESTO))).toBe("not_found");
    expect(await codigoDe(quotes.sendQuote(UUID_AJENO, { ...PRESUPUESTO, amount_mxn: 0 }))).toBe("invalid_input");
    expect(await codigoDe(quotes.sendQuote("x", PRESUPUESTO))).toBe("invalid_input");
  });

  test("una solicitud en borrador no existe para el artesano (not_found)", async () => {
    const s = await solicitudes.createRequestDraft({ workshop_id: sim.ID_TALLER_SIMULADO, service_type: "repair", description: "Suela" });
    sim.fijarSesionSimulada({ rol: "craftsman" });
    expect(await codigoDe(quotes.sendQuote(s.id, PRESUPUESTO))).toBe("not_found");
  });

  test("solicitud cancelada o aceptada: invalid_state; taller suspendido: forbidden", async () => {
    const a = await abrirSolicitud();
    await solicitudes.cancelRequest(a);
    sim.fijarSesionSimulada({ rol: "craftsman" });
    expect(await codigoDe(quotes.sendQuote(a, PRESUPUESTO))).toBe("invalid_state");

    sim.fijarSesionSimulada({ rol: "client" });
    const b = await abrirSolicitud();
    sim.fijarTallerSimulado({ suspended: true });
    sim.fijarSesionSimulada({ rol: "craftsman" });
    expect(await codigoDe(quotes.sendQuote(b, PRESUPUESTO))).toBe("forbidden");
  });
});

describe("respondQuote", () => {
  test("aceptar: crea la orden, acepta la solicitud, avisa a ambas partes y cierra el presupuesto", async () => {
    const { requestId, quoteId } = await cotizar();
    const r = await quotes.respondQuote(quoteId, true);
    expect(r).toMatchObject({ quote_id: quoteId, status: "accepted" });
    expect(typeof r.order_id).toBe("string");

    expect((await solicitudes.getRequest(requestId)).status).toBe("accepted");
    expect((await quotes.getQuote(quoteId)).status).toBe("accepted");
    expect(await orders.getOrder(/** @type {string} */ (r.order_id))).toMatchObject({
      quote_id: quoteId,
      request_id: requestId,
      phase: 1,
      status: "in_progress",
      due_date: MANANA,
    });
    expect((await solicitudes.listMyNotifications()).map((n) => n.type)).toContain("order_created");
    // El chat sigue abierto con la solicitud aceptada.
    await expect(chat.sendMessage(requestId, "Gracias")).resolves.toMatchObject({ kind: "text" });
    sim.fijarSesionSimulada({ rol: "craftsman" });
    expect((await solicitudes.listMyNotifications()).map((n) => n.type)).toContain("quote_accepted");
    expect((await orders.listMyOrders()).map((o) => o.id)).toEqual([r.order_id]);
  });

  test("A1: rechazar deja la solicitud cotizada, sin orden, con el chat abierto y permite un nuevo presupuesto", async () => {
    const { requestId, quoteId } = await cotizar();
    expect(await quotes.respondQuote(quoteId, false)).toEqual({ quote_id: quoteId, status: "rejected", order_id: null });
    expect((await solicitudes.getRequest(requestId)).status).toBe("quoted");
    expect(await orders.listMyOrders()).toEqual([]);
    await expect(chat.sendMessage(requestId, "Está caro, ¿puede bajar?")).resolves.toMatchObject({ kind: "text" });
    sim.fijarSesionSimulada({ rol: "craftsman" });
    expect((await solicitudes.listMyNotifications()).map((n) => n.type)).toContain("quote_rejected");
    // Intercambio: el artesano envía otro presupuesto, el cliente lo rechaza de nuevo y luego acepta el tercero.
    const segundo = await quotes.sendQuote(requestId, { ...PRESUPUESTO, amount_mxn: 300 });
    sim.fijarSesionSimulada({ rol: "client" });
    await quotes.respondQuote(segundo.id, false);
    sim.fijarSesionSimulada({ rol: "craftsman" });
    const tercero = await quotes.sendQuote(requestId, { ...PRESUPUESTO, amount_mxn: 250 });
    sim.fijarSesionSimulada({ rol: "client" });
    expect((await quotes.respondQuote(tercero.id, true)).status).toBe("accepted");
    expect((await quotes.listQuotes(requestId)).map((q) => q.status)).toEqual(["rejected", "rejected", "accepted"]);
    expect((await solicitudes.getRequest(requestId)).status).toBe("accepted");
  });

  test("responder dos veces o un presupuesto reemplazado lanza invalid_state", async () => {
    const { requestId, quoteId } = await cotizar();
    sim.fijarSesionSimulada({ rol: "craftsman" });
    await quotes.sendQuote(requestId, { ...PRESUPUESTO, amount_mxn: 400 });
    sim.fijarSesionSimulada({ rol: "client" });
    expect(await codigoDe(quotes.respondQuote(quoteId, true))).toBe("invalid_state");
    const vigente = (await quotes.listQuotes(requestId)).find((q) => q.status === "sent");
    await quotes.respondQuote(/** @type {any} */ (vigente).id, true);
    expect(await codigoDe(quotes.respondQuote(/** @type {any} */ (vigente).id, false))).toBe("invalid_state");
  });

  test("errores: id mal formado, aceptar no booleano, inexistente, sin sesión, artesano e inactivo", async () => {
    const { quoteId } = await cotizar();
    expect(await codigoDe(quotes.respondQuote("x", true))).toBe("invalid_input");
    expect(await codigoDe(quotes.respondQuote(quoteId, /** @type {any} */ ("si")))).toBe("invalid_input");
    expect(await codigoDe(quotes.respondQuote(UUID_AJENO, true))).toBe("not_found");
    sim.fijarSesionSimulada({ rol: "craftsman" });
    expect(await codigoDe(quotes.respondQuote(quoteId, true))).toBe("forbidden");
    sim.fijarSesionSimulada({ rol: "client", activo: false });
    expect(await codigoDe(quotes.respondQuote(quoteId, true))).toBe("inactive_user");
    sim.fijarSesionSimulada({ activo: true, sesion: false });
    expect(await codigoDe(quotes.respondQuote(quoteId, true))).toBe("not_authenticated");
  });
});

describe("cancelRequest con presupuesto vigente", () => {
  test("marca el presupuesto como rechazado", async () => {
    const { requestId, quoteId } = await cotizar();
    await solicitudes.cancelRequest(requestId);
    expect((await quotes.getQuote(quoteId)).status).toBe("rejected");
  });
});

describe("lectura: getQuote, listQuotes y órdenes", () => {
  test("sin sesión: not_authenticated; presupuesto inexistente o ajeno: not_found", async () => {
    const { quoteId } = await cotizar();
    sim.fijarSesionSimulada({ rol: null });
    expect(await codigoDe(quotes.getQuote(quoteId))).toBe("not_found");
    expect(await quotes.listQuotes(quoteId)).toEqual([]);
    sim.fijarSesionSimulada({ rol: "client", sesion: false });
    expect(await codigoDe(quotes.getQuote(quoteId))).toBe("not_authenticated");
    expect(await codigoDe(orders.listMyOrders())).toBe("not_authenticated");
    sim.fijarSesionSimulada({ sesion: true });
    expect(await codigoDe(quotes.getQuote(UUID_AJENO))).toBe("not_found");
    expect(await codigoDe(orders.getOrder(UUID_AJENO))).toBe("not_found");
    expect(await codigoDe(orders.getOrder("x"))).toBe("invalid_input");
  });

  test("una orden no es visible para un usuario sin rol ni para un cliente inactivo", async () => {
    const { quoteId } = await cotizar();
    const r = await quotes.respondQuote(quoteId, true);
    sim.fijarSesionSimulada({ rol: null });
    expect(await orders.listMyOrders()).toEqual([]);
    expect(await codigoDe(orders.getOrder(/** @type {string} */ (r.order_id)))).toBe("not_found");
    sim.fijarSesionSimulada({ rol: "client", activo: false });
    expect(await orders.listMyOrders()).toEqual([]);
  });
});
