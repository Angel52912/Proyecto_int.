import { jest } from "@jest/globals";

// El flujo se ejecuta contra los mocks: no se necesita Supabase ni Docker.
jest.unstable_mockModule("../../../apis/supabaseClient.js", () => ({ obtenerCliente: () => ({}) }));

const solicitudes = await import("../../../apis/api-mixanab/requests/api.mock.js");
const chat = await import("../../../apis/api-mixanab/chat/api.mock.js");
const quotes = await import("../../../apis/api-mixanab/quotes/api.mock.js");
const orders = await import("../../../apis/api-mixanab/orders/api.mock.js");
const sim = await import("../../../apis/api-mixanab/requests/simulacion.js");
const { fechaDeHoy } = await import("../../../apis/api-mixanab/quotes/validar.js");

const FOTO = { type: "image/jpeg", size: 2048 };
const ENTREGA = fechaDeHoy(new Date(Date.now() + 86_400_000));

const comoCliente = () => sim.fijarSesionSimulada({ sesion: true, rol: "client", activo: true });
const comoArtesano = () => sim.fijarSesionSimulada({ sesion: true, rol: "craftsman", activo: true });

beforeEach(() => {
  sim.reiniciarSimulacion();
});

test("flujo completo: el cliente hace el pedido, el artesano responde y se entrega y califica", async () => {
  // 1) El cliente crea la solicitud con foto y la envía.
  comoCliente();
  const borrador = await solicitudes.createRequestDraft({
    workshop_id: sim.ID_TALLER_SIMULADO,
    service_type: "repair",
    description: "  Se despegó la suela derecha  ",
  });
  await solicitudes.addRequestPhoto(borrador.id, FOTO);
  expect(await solicitudes.submitRequest(borrador.id)).toEqual({ id: borrador.id, status: "open" });

  // 2) El cliente escribe por el chat y se suscribe para recibir la respuesta.
  const recibidas = [];
  const dejarDeEscuchar = await chat.subscribeToMessages(borrador.id, (mensaje) => recibidas.push(mensaje.body));
  const pregunta = await chat.sendMessage(borrador.id, "Buen día, ¿pueden reparar la suela?");
  expect(pregunta).toMatchObject({ sender_id: sim.UID_CLIENTE, body: "Buen día, ¿pueden reparar la suela?" });

  // 3) El artesano recibe el aviso, ve la solicitud y responde por chat.
  comoArtesano();
  expect((await solicitudes.listMyNotifications({ unreadOnly: true })).map((n) => n.type)).toContain("request_received");
  expect((await solicitudes.getRequest(borrador.id)).counterpart).toMatchObject({ full_name: "Cliente Simulado" });
  const respuesta = await chat.sendMessage(borrador.id, "Buen día, sí la reparamos. Le paso el costo.");
  expect(respuesta).toMatchObject({ kind: "text", sender_id: sim.UID_ARTESANO });
  expect(recibidas).toContain(respuesta.body);

  // 4) El artesano envía el presupuesto: la solicitud queda cotizada y aparece la tarjeta en el chat.
  const presupuesto = await quotes.sendQuote(borrador.id, {
    amount_mxn: 350,
    delivery_date: ENTREGA,
    detail: { note: "Cambio de suela y pegado" },
  });
  expect((await solicitudes.getRequest(borrador.id)).status).toBe("quoted");
  const mensajes = await chat.listMessages(borrador.id);
  expect(mensajes.some((m) => m.kind === "quote_card" && m.quote_id === presupuesto.id)).toBe(true);
  dejarDeEscuchar();

  // 5) El cliente acepta: nace el pedido en fase 1.
  comoCliente();
  expect((await solicitudes.listMyNotifications({ unreadOnly: true })).map((n) => n.type)).toContain("quote_received");
  const aceptacion = await quotes.respondQuote(presupuesto.id, true);
  const pedidoId = /** @type {string} */ (aceptacion.order_id);
  expect(aceptacion).toMatchObject({ quote_id: presupuesto.id, status: "accepted" });
  expect(await orders.getOrder(pedidoId)).toMatchObject({
    quote_id: presupuesto.id,
    request_id: borrador.id,
    phase: 1,
    status: "in_progress",
    due_date: ENTREGA,
  });

  // 6) El artesano avanza las fases con foto de progreso y marca el pedido listo.
  comoArtesano();
  for (const fase of [2, 3, 4]) {
    const avance = await orders.advanceOrderPhase(pedidoId, { phase: fase, photo: FOTO, note: `Avance ${fase}` });
    expect(avance).toMatchObject({ order_id: pedidoId, phase: fase, status: "in_progress" });
  }
  expect((await orders.listOrderUpdates(pedidoId)).map((u) => u.phase)).toEqual([2, 3, 4]);
  expect(await orders.markOrderReady(pedidoId)).toMatchObject({ status: "ready", phase: 4 });
  expect((await chat.listMessages(borrador.id)).at(-1)?.body).toBe("Tu pedido está listo para entrega");

  // 7) El cliente ve el PIN y el artesano confirma la entrega con él.
  comoCliente();
  const { pin } = await orders.revealDeliveryPin(pedidoId);
  expect(pin).toMatch(/^\d{6}$/);
  comoArtesano();
  expect(await orders.verifyDeliveryPin(pedidoId, pin)).toMatchObject({ ok: true, status: "delivered" });

  // 8) El cliente califica: se guarda la reseña y se recalcula el promedio del taller.
  comoCliente();
  const resena = await orders.createReview(pedidoId, { rating: 5, comment: "Quedó como nuevo", tags: ["Puntual"] });
  expect(resena).toMatchObject({ rating: 5, comment: "Quedó como nuevo", tags: ["Puntual"] });
  expect((await orders.getOrderReview(pedidoId))?.id).toBe(resena.id);
  expect((await solicitudes.listMyNotifications({ unreadOnly: true })).map((n) => n.type)).toContain("order_delivered");
  expect(sim.estado.taller).toMatchObject({ rating_avg: 5, rating_count: 1 });
  expect(await orders.listPendingReviews()).toEqual([]);
});
