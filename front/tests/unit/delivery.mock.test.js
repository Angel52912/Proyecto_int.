import { jest } from "@jest/globals";

jest.unstable_mockModule("../../js/supabaseClient.js", () => ({ obtenerCliente: () => ({}) }));
const realOrders = await import("../../js/features/orders/api.js");
const quotes = await import("../../js/features/quotes/api.mock.js");
const orders = await import("../../js/features/orders/api.mock.js");
const solicitudes = await import("../../js/features/requests/api.mock.js");
const sim = await import("../../js/features/requests/simulacion.js");
const { fechaDeHoy } = await import("../../js/features/quotes/validar.js");
const { extraerPin, validarResena } = await import("../../js/features/orders/validar.js");

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

/** Crea una orden `ready` y deja la sesión como cliente. @returns {Promise<string>} id de la orden */
async function ordenLista() {
  const s = await solicitudes.createRequestDraft({ workshop_id: sim.ID_TALLER_SIMULADO, service_type: "repair", description: "Suela" });
  await solicitudes.addRequestPhoto(s.id, FOTO);
  await solicitudes.submitRequest(s.id);
  sim.fijarSesionSimulada({ rol: "craftsman" });
  const q = await quotes.sendQuote(s.id, { amount_mxn: 300, delivery_date: MANANA });
  sim.fijarSesionSimulada({ rol: "client" });
  const r = await quotes.respondQuote(q.id, true);
  const id = /** @type {string} */ (r.order_id);
  sim.fijarSesionSimulada({ rol: "craftsman" });
  for (const phase of [2, 3, 4]) await orders.advanceOrderPhase(id, { phase, photo: FOTO });
  await orders.markOrderReady(id);
  sim.fijarSesionSimulada({ rol: "client" });
  return id;
}

/** Orden `ready` con PIN generado; deja la sesión como artesano. @returns {Promise<{ id: string, pin: string }>} */
async function ordenConPin() {
  const id = await ordenLista();
  const { pin } = await orders.revealDeliveryPin(id);
  sim.fijarSesionSimulada({ rol: "craftsman" });
  return { id, pin };
}

/** @param {string} pin @returns {string} un PIN distinto de pin */
const otroPin = (pin) => (pin === "000000" ? "111111" : "000000");

beforeEach(() => {
  sim.reiniciarSimulacion();
});

describe("entrega y reseñas: contrato", () => {
  test.each(["revealDeliveryPin", "verifyDeliveryPin", "createReview", "getOrderReview", "listPendingReviews"])("real y simulado exportan %s", (nombre) => {
    expect(typeof realOrders[nombre]).toBe("function");
    expect(typeof orders[nombre]).toBe("function");
  });
});

describe("extraerPin y validarResena", () => {
  const ID = "11111111-1111-4111-8111-111111111111";
  test("acepta el PIN o el QR del mismo pedido", () => {
    expect(extraerPin(ID, "123456")).toBe("123456");
    expect(extraerPin(ID, ` ${ID}:654321 `)).toBe("654321");
  });
  test("rechaza formato inválido, QR de otro pedido y tipos incorrectos", () => {
    for (const malo of ["12345", "1234567", "abcdef", "", `${UUID_AJENO}:123456`, null, 123456]) {
      expect(() => extraerPin(ID, malo)).toThrow(expect.objectContaining({ code: "invalid_input" }));
    }
  });
  test("reseña: normaliza comentario y etiquetas; rechaza valores fuera de rango", () => {
    expect(validarResena({ rating: 5, comment: "  Excelente  ", tags: [" Puntual "] })).toEqual({ rating: 5, comment: "Excelente", tags: ["Puntual"] });
    expect(validarResena({ rating: 3, comment: "   " })).toEqual({ rating: 3, comment: null, tags: [] });
    const malos = [
      { rating: 0 },
      { rating: 6 },
      { rating: 4.5 },
      { rating: "5" },
      { rating: 5, comment: "x".repeat(1001) },
      { rating: 5, tags: ["a", "b", "c", "d", "e", "f"] },
      { rating: 5, tags: [""] },
      { rating: 5, tags: ["x".repeat(31)] },
      { rating: 5, tags: [1] },
    ];
    for (const malo of malos) expect(() => validarResena(/** @type {any} */ (malo))).toThrow(expect.objectContaining({ code: "invalid_input" }));
  });
});

describe("revealDeliveryPin (simulado)", () => {
  test("flujo principal: devuelve 6 dígitos solo con el pedido listo y cada llamada rota el PIN", async () => {
    const id = await ordenLista();
    const primero = await orders.revealDeliveryPin(id);
    expect(primero).toEqual({ order_id: id, pin: expect.stringMatching(/^\d{6}$/) });
    let segundo = await orders.revealDeliveryPin(id);
    for (let i = 0; i < 5 && segundo.pin === primero.pin; i += 1) segundo = await orders.revealDeliveryPin(id);
    expect(segundo.pin).not.toBe(primero.pin);
    expect(await orders.getOrder(id)).not.toHaveProperty("pin");
  });

  test("pedido no listo: invalid_state; ajeno: not_found; id inválido: invalid_input", async () => {
    const id = await ordenLista();
    sim.estado.ordenes[0].status = "in_progress";
    expect(await codigoDe(orders.revealDeliveryPin(id))).toBe("invalid_state");
    expect(await codigoDe(orders.revealDeliveryPin(UUID_AJENO))).toBe("not_found");
    expect(await codigoDe(orders.revealDeliveryPin("x"))).toBe("invalid_input");
  });

  test("artesano, sin rol y admin: forbidden; inactivo: inactive_user; anónimo: not_authenticated", async () => {
    const id = await ordenLista();
    for (const rol of ["craftsman", null, "admin"]) {
      sim.fijarSesionSimulada({ rol });
      expect(await codigoDe(orders.revealDeliveryPin(id))).toBe("forbidden");
    }
    sim.fijarSesionSimulada({ rol: "client", activo: false });
    expect(await codigoDe(orders.revealDeliveryPin(id))).toBe("inactive_user");
    sim.fijarSesionSimulada({ activo: true, sesion: false });
    expect(await codigoDe(orders.revealDeliveryPin(id))).toBe("not_authenticated");
  });

  test("un bloqueo vigente no se levanta al rotar el PIN", async () => {
    const { id, pin } = await ordenConPin();
    for (let i = 0; i < 5; i += 1) await orders.verifyDeliveryPin(id, otroPin(pin));
    sim.fijarSesionSimulada({ rol: "client" });
    const nuevo = await orders.revealDeliveryPin(id);
    sim.fijarSesionSimulada({ rol: "craftsman" });
    const r = await orders.verifyDeliveryPin(id, nuevo.pin);
    expect(r).toMatchObject({ ok: false, attempts_left: 0 });
    expect(r.locked_until).toEqual(expect.any(String));
  });
});

describe("verifyDeliveryPin (simulado)", () => {
  test("flujo principal: el PIN correcto entrega el pedido, avisa al cliente y deja mensaje de sistema", async () => {
    const { id, pin } = await ordenConPin();
    const r = await orders.verifyDeliveryPin(id, pin);
    expect(r).toEqual({ ok: true, attempts_left: 5, locked_until: null, status: "delivered" });
    const orden = await orders.getOrder(id);
    expect(orden).toMatchObject({ status: "delivered" });
    expect(orden.delivered_at).toEqual(expect.any(String));
    expect(sim.estado.notificaciones.at(-1)).toMatchObject({ type: "order_delivered", payload: { review_pending: true } });
    expect(sim.estado.mensajes.at(-1)).toMatchObject({ kind: "system", sender_id: null });
    expect(await codigoDe(orders.verifyDeliveryPin(id, pin))).toBe("invalid_state"); // ya entregado
  });

  test("también acepta el texto del QR `order_id:pin`", async () => {
    const { id, pin } = await ordenConPin();
    expect((await orders.verifyDeliveryPin(id, `${id}:${pin}`)).ok).toBe(true);
  });

  test("A1: PIN mal formado lanza invalid_input y no cuenta como intento; QR de otro pedido también", async () => {
    const { id, pin } = await ordenConPin();
    for (const malo of ["12345", "abcdef", `${UUID_AJENO}:${pin}`]) expect(await codigoDe(orders.verifyDeliveryPin(id, malo))).toBe("invalid_input");
    expect(sim.estado.pins.get(id)?.attempts).toBe(0);
  });

  test("un PIN incorrecto no lanza: devuelve los intentos restantes y al quinto bloquea 15 minutos", async () => {
    const { id, pin } = await ordenConPin();
    const malo = otroPin(pin);
    for (const restantes of [4, 3, 2, 1]) {
      expect(await orders.verifyDeliveryPin(id, malo)).toEqual({ ok: false, attempts_left: restantes, locked_until: null, status: "ready" });
    }
    const quinto = await orders.verifyDeliveryPin(id, malo);
    expect(quinto).toMatchObject({ ok: false, attempts_left: 0 });
    const minutos = (Date.parse(/** @type {string} */ (quinto.locked_until)) - Date.now()) / 60_000;
    expect(minutos).toBeGreaterThan(14);
    expect(minutos).toBeLessThanOrEqual(15);
    // Con el bloqueo vigente ni el PIN correcto entrega.
    expect(await orders.verifyDeliveryPin(id, pin)).toMatchObject({ ok: false, attempts_left: 0 });
    expect((await orders.getOrder(id)).status).toBe("ready");
  });

  test("pasado el bloqueo se puede entregar de nuevo con el PIN correcto", async () => {
    const { id, pin } = await ordenConPin();
    for (let i = 0; i < 5; i += 1) await orders.verifyDeliveryPin(id, otroPin(pin));
    const registro = /** @type {{ lockedUntil: number | null }} */ (sim.estado.pins.get(id));
    registro.lockedUntil = Date.now() - 1000;
    expect(await orders.verifyDeliveryPin(id, otroPin(pin))).toMatchObject({ ok: false, attempts_left: 4 });
    expect((await orders.verifyDeliveryPin(id, pin)).ok).toBe(true);
  });

  test("sin PIN generado o pedido no listo: invalid_state", async () => {
    const id = await ordenLista();
    sim.fijarSesionSimulada({ rol: "craftsman" });
    expect(await codigoDe(orders.verifyDeliveryPin(id, "123456"))).toBe("invalid_state");
    sim.estado.ordenes[0].status = "in_progress";
    expect(await codigoDe(orders.verifyDeliveryPin(id, "123456"))).toBe("invalid_state");
  });

  test("cliente, sin rol y admin: forbidden; inexistente: not_found; taller suspendido: forbidden; inactivo; anónimo", async () => {
    const { id } = await ordenConPin();
    for (const rol of ["client", null, "admin"]) {
      sim.fijarSesionSimulada({ rol });
      expect(await codigoDe(orders.verifyDeliveryPin(id, "123456"))).toBe("forbidden");
    }
    sim.fijarSesionSimulada({ rol: "craftsman" });
    expect(await codigoDe(orders.verifyDeliveryPin(UUID_AJENO, "123456"))).toBe("not_found");
    sim.fijarTallerSimulado({ suspended: true });
    expect(await codigoDe(orders.verifyDeliveryPin(id, "123456"))).toBe("forbidden");
    sim.fijarTallerSimulado({ suspended: false });
    sim.fijarSesionSimulada({ activo: false });
    expect(await codigoDe(orders.verifyDeliveryPin(id, "123456"))).toBe("inactive_user");
    sim.fijarSesionSimulada({ activo: true, sesion: false });
    expect(await codigoDe(orders.verifyDeliveryPin(id, "123456"))).toBe("not_authenticated");
  });
});

describe("createReview, getOrderReview y listPendingReviews (simulado)", () => {
  /** Entrega el pedido y deja la sesión como cliente. @returns {Promise<string>} */
  async function ordenEntregada() {
    const { id, pin } = await ordenConPin();
    await orders.verifyDeliveryPin(id, pin);
    sim.fijarSesionSimulada({ rol: "client" });
    return id;
  }

  test("flujo principal: crea la reseña, recalcula el promedio del taller y avisa al artesano", async () => {
    const id = await ordenEntregada();
    const r = await orders.createReview(id, { rating: 4, comment: "  Quedó bien  ", tags: ["Puntual"] });
    expect(r).toMatchObject({ order_id: id, rating: 4, comment: "Quedó bien", tags: ["Puntual"], hidden: false });
    expect(sim.estado.taller).toMatchObject({ rating_avg: 4, rating_count: 1 });
    expect(sim.estado.notificaciones.at(-1)).toMatchObject({ type: "review_received", payload: { order_id: id, rating: 4 } });
    expect(await orders.getOrderReview(id)).toEqual(r);
  });

  test("sin edición: una segunda reseña del mismo pedido lanza invalid_state", async () => {
    const id = await ordenEntregada();
    await orders.createReview(id, { rating: 5 });
    expect(await codigoDe(orders.createReview(id, { rating: 1 }))).toBe("invalid_state");
    expect(sim.estado.taller.rating_count).toBe(1);
  });

  test("pedido no entregado: invalid_state; ajeno: not_found; datos inválidos: invalid_input", async () => {
    const id = await ordenLista();
    expect(await codigoDe(orders.createReview(id, { rating: 5 }))).toBe("invalid_state");
    expect(await codigoDe(orders.createReview(UUID_AJENO, { rating: 5 }))).toBe("not_found");
    expect(await codigoDe(orders.createReview(id, { rating: 9 }))).toBe("invalid_input");
    expect(await codigoDe(orders.createReview("x", { rating: 5 }))).toBe("invalid_input");
  });

  test("artesano, sin rol y admin: forbidden; inactivo: inactive_user; anónimo: not_authenticated", async () => {
    const id = await ordenEntregada();
    for (const rol of ["craftsman", null, "admin"]) {
      sim.fijarSesionSimulada({ rol });
      expect(await codigoDe(orders.createReview(id, { rating: 5 }))).toBe("forbidden");
    }
    sim.fijarSesionSimulada({ rol: "client", activo: false });
    expect(await codigoDe(orders.createReview(id, { rating: 5 }))).toBe("inactive_user");
    sim.fijarSesionSimulada({ activo: true, sesion: false });
    expect(await codigoDe(orders.createReview(id, { rating: 5 }))).toBe("not_authenticated");
  });

  test("getOrderReview: ven cliente y artesano; admin, sin rol e inactivos reciben null; oculta solo la ve su autor", async () => {
    const id = await ordenEntregada();
    await orders.createReview(id, { rating: 5 });
    sim.fijarSesionSimulada({ rol: "craftsman" });
    expect(await orders.getOrderReview(id)).toMatchObject({ rating: 5 });
    for (const rol of ["admin", null]) {
      sim.fijarSesionSimulada({ rol });
      expect(await orders.getOrderReview(id)).toBeNull();
    }
    sim.estado.resenas[0].hidden = true;
    sim.fijarSesionSimulada({ rol: "craftsman" });
    expect(await orders.getOrderReview(id)).toBeNull();
    sim.fijarSesionSimulada({ rol: "client" });
    expect(await orders.getOrderReview(id)).toMatchObject({ hidden: true });
    sim.fijarSesionSimulada({ sesion: false });
    expect(await codigoDe(orders.getOrderReview(id))).toBe("not_authenticated");
  });

  test("A2: listPendingReviews lista los entregados sin calificar y deja de listarlos al calificar", async () => {
    const id = await ordenEntregada();
    expect((await orders.listPendingReviews()).map((o) => o.id)).toEqual([id]);
    await orders.createReview(id, { rating: 5 });
    expect(await orders.listPendingReviews()).toEqual([]);
    for (const rol of ["craftsman", "admin", null]) {
      sim.fijarSesionSimulada({ rol });
      expect(await orders.listPendingReviews()).toEqual([]);
    }
    sim.fijarSesionSimulada({ sesion: false });
    expect(await codigoDe(orders.listPendingReviews())).toBe("not_authenticated");
  });
});
