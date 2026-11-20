import { jest } from "@jest/globals";

jest.unstable_mockModule("../../js/supabaseClient.js", () => ({ obtenerCliente: () => ({}) }));
const real = await import("../../js/features/chat/api.js");
const chat = await import("../../js/features/chat/api.mock.js");
const solicitudes = await import("../../js/features/requests/api.mock.js");
const sim = await import("../../js/features/requests/simulacion.js");

const FUNCIONES_DEL_CONTRATO = ["listMessages", "sendMessage", "subscribeToMessages"];
const FOTO = { type: "image/png", size: 1000 };
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

/** @returns {Promise<string>} id de una solicitud abierta (sesión de cliente) */
async function abrirSolicitud() {
  const s = await solicitudes.createRequestDraft({ workshop_id: sim.ID_TALLER_SIMULADO, service_type: "cleaning", description: "Limpieza" });
  await solicitudes.addRequestPhoto(s.id, FOTO);
  await solicitudes.submitRequest(s.id);
  return s.id;
}

beforeEach(() => {
  chat.reiniciarSimulacion();
});

describe("chat: contrato", () => {
  test.each(FUNCIONES_DEL_CONTRATO)("real y simulado exportan %s", (nombre) => {
    expect(typeof real[nombre]).toBe("function");
    expect(typeof chat[nombre]).toBe("function");
  });
});

describe("chat/api.mock.js", () => {
  test("al enviar la solicitud el chat nace con el mensaje de sistema", async () => {
    const id = await abrirSolicitud();
    const mensajes = await chat.listMessages(id);
    expect(mensajes).toHaveLength(1);
    expect(mensajes[0]).toMatchObject({ kind: "system", sender_id: null, body: "Solicitud enviada", quote_id: null });
  });

  test("cliente y artesano conversan; el remitente es siempre el usuario con sesión", async () => {
    const id = await abrirSolicitud();
    const mio = await chat.sendMessage(id, "  Hola, ¿cuánto cuesta?  ");
    expect(mio).toMatchObject({ kind: "text", sender_id: sim.UID_CLIENTE, body: "Hola, ¿cuánto cuesta?" });
    chat.fijarSesionSimulada({ rol: "craftsman" });
    const respuesta = await chat.sendMessage(id, "Son $300");
    expect(respuesta.sender_id).toBe(sim.UID_ARTESANO);
    expect((await chat.listMessages(id)).map((m) => m.kind)).toEqual(["system", "text", "text"]);
  });

  test("el texto se guarda tal cual, sin interpretarlo como HTML", async () => {
    const id = await abrirSolicitud();
    const m = await chat.sendMessage(id, "<img src=x onerror=alert(1)>");
    expect(m.body).toBe("<img src=x onerror=alert(1)>");
  });

  test.each([
    ["vacío", ""],
    ["solo espacios", "   "],
    ["más de 2000", "x".repeat(2001)],
    ["no es texto", 42],
  ])("mensaje inválido: %s", async (_nombre, cuerpo) => {
    const id = await abrirSolicitud();
    expect(await codigoDe(chat.sendMessage(id, /** @type {any} */ (cuerpo)))).toBe("invalid_input");
  });

  test("límites: 2000 caracteres sí; id que no es uuid, no", async () => {
    const id = await abrirSolicitud();
    expect((await chat.sendMessage(id, "x".repeat(2000))).body).toHaveLength(2000);
    expect(await codigoDe(chat.sendMessage("no-uuid", "hola"))).toBe("invalid_input");
  });

  test("solo los dos participantes: admin, sin rol y desactivado no leen ni escriben", async () => {
    const id = await abrirSolicitud();
    for (const cambios of [{ rol: "admin" }, { rol: null }, { rol: "client", activo: false }]) {
      chat.fijarSesionSimulada({ activo: true, ...cambios });
      expect(await codigoDe(chat.listMessages(id))).toBe("not_found");
      expect(await codigoDe(chat.sendMessage(id, "hola"))).toBe("forbidden");
    }
    chat.fijarSesionSimulada({ rol: "client", activo: true, sesion: false });
    expect(await codigoDe(chat.sendMessage(id, "hola"))).toBe("not_authenticated");
    expect(await codigoDe(chat.listMessages(id))).toBe("not_authenticated");
  });

  test("no se escribe en una solicitud inexistente o cancelada", async () => {
    const id = await abrirSolicitud();
    expect(await codigoDe(chat.sendMessage(UUID_AJENO, "hola"))).toBe("forbidden");
    expect(await codigoDe(chat.listMessages(UUID_AJENO))).toBe("not_found");
    await solicitudes.cancelRequest(id);
    expect(await codigoDe(chat.sendMessage(id, "hola"))).toBe("forbidden");
    expect((await chat.listMessages(id)).at(-1)?.body).toBe("Solicitud cancelada por el cliente");
  });

  test("el artesano no ve el chat de un borrador", async () => {
    const borrador = await solicitudes.createRequestDraft({ workshop_id: sim.ID_TALLER_SIMULADO, service_type: "repair", description: "x" });
    chat.fijarSesionSimulada({ rol: "craftsman" });
    expect(await codigoDe(chat.listMessages(borrador.id))).toBe("not_found");
  });

  test("paginación: limit trae los últimos y before pagina hacia atrás", async () => {
    const id = await abrirSolicitud();
    for (let i = 1; i <= 4; i++) await chat.sendMessage(id, `m${i}`);
    expect((await chat.listMessages(id, { limit: 2 })).map((m) => m.body)).toEqual(["m3", "m4"]);
    const mensajes = await chat.listMessages(id);
    for (const [i, m] of sim.estado.mensajes.entries()) m.created_at = new Date(1_700_000_000_000 + i * 1000).toISOString();
    const antes = sim.estado.mensajes[3].created_at;
    expect((await chat.listMessages(id, { before: antes })).map((m) => m.body)).toEqual(["Solicitud enviada", "m1", "m2"]);
    expect(mensajes).toHaveLength(5);
    expect(await codigoDe(chat.listMessages(id, { limit: 0 }))).toBe("invalid_input");
    expect(await codigoDe(chat.listMessages(id, { limit: 101 }))).toBe("invalid_input");
    expect(await codigoDe(chat.listMessages(id, { before: "ayer" }))).toBe("invalid_input");
  });

  test("la suscripción recibe mensajes nuevos de esa solicitud y se cancela", async () => {
    const id = await abrirSolicitud();
    chat.fijarSesionSimulada({ rol: "craftsman" });
    const recibidos = [];
    const cancelar = await chat.subscribeToMessages(id, (m) => recibidos.push(m.body));
    await chat.sendMessage(id, "hola");
    chat.fijarSesionSimulada({ rol: "client" });
    await chat.sendMessage(id, "adiós");
    expect(recibidos).toEqual(["hola", "adiós"]);
    cancelar();
    await chat.sendMessage(id, "otro");
    expect(recibidos).toHaveLength(2);
  });

  test("quien no participa no recibe nada por la suscripción", async () => {
    const id = await abrirSolicitud();
    chat.fijarSesionSimulada({ rol: "admin" });
    const recibidos = [];
    await chat.subscribeToMessages(id, (m) => recibidos.push(m));
    chat.fijarSesionSimulada({ rol: "client" });
    await chat.sendMessage(id, "hola");
    expect(recibidos).toEqual([]);
  });
});
