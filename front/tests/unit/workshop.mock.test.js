import { jest } from "@jest/globals";

jest.unstable_mockModule("../../js/supabaseClient.js", () => ({ obtenerCliente: () => ({}) }));
const real = await import("../../js/features/workshop/api.js");
const mock = await import("../../js/features/workshop/api.mock.js");
const { validarHorario } = await import("../../js/features/workshop/validar.js");

const FUNCIONES_DEL_CONTRATO = [
  "getMyWorkshop",
  "saveMyWorkshop",
  "publishMyWorkshop",
  "unpublishMyWorkshop",
  "addWorkshopPhoto",
  "removeWorkshopPhoto",
];

const HORARIO = { mon: [{ open: "09:00", close: "18:00" }], sat: [{ open: "09:00", close: "14:00" }] };
const COMPLETO = {
  name: "Taller El Cuero",
  address: "Calle 60 #123",
  colonia: "Centro",
  lat: 20.9674,
  lng: -89.5926,
  services: ["repair"],
  hours: HORARIO,
  price_from: 150,
};
const FOTO = { type: "image/jpeg", size: 1000 };

/** @param {Promise<unknown>} promesa @returns {Promise<string>} */
async function codigoDe(promesa) {
  try {
    await promesa;
  } catch (error) {
    return /** @type {any} */ (error).code;
  }
  return "sin_error";
}

beforeEach(() => {
  mock.reiniciarSimulacion();
});

describe("workshop: contrato", () => {
  test.each(FUNCIONES_DEL_CONTRATO)("real y simulado exportan %s", (nombre) => {
    expect(typeof real[nombre]).toBe("function");
    expect(typeof mock[nombre]).toBe("function");
  });
});

describe("workshop/api.mock.js", () => {
  test("sin taller devuelve null; guardar crea el borrador", async () => {
    expect(await mock.getMyWorkshop()).toBeNull();
    const taller = await mock.saveMyWorkshop({ name: "  Mi taller " });
    expect(taller).toMatchObject({ name: "Mi taller", published: false, services: [], photos: [] });
    expect((await mock.getMyWorkshop())?.name).toBe("Mi taller");
  });

  test("A1: publicar incompleto devuelve los campos faltantes sin lanzar", async () => {
    await mock.saveMyWorkshop({ name: "Mi taller" });
    expect(await mock.publishMyWorkshop()).toEqual({
      published: false,
      missing: ["address", "colonia", "location", "services", "hours", "price_from"],
    });
  });

  test("publicar completo y retirar del mapa", async () => {
    await mock.saveMyWorkshop(COMPLETO);
    expect(await mock.publishMyWorkshop()).toEqual({ published: true, missing: [] });
    expect((await mock.getMyWorkshop())?.published).toBe(true);
    expect(await mock.unpublishMyWorkshop()).toEqual({ published: false, missing: [] });
  });

  test("un horario sin rangos no cuenta para publicar", async () => {
    await mock.saveMyWorkshop({ ...COMPLETO, hours: { mon: [] } });
    expect((await mock.publishMyWorkshop()).missing).toEqual(["hours"]);
  });

  test("no deja incompleto un taller ya publicado", async () => {
    await mock.saveMyWorkshop(COMPLETO);
    await mock.publishMyWorkshop();
    expect(await codigoDe(mock.saveMyWorkshop({ services: [] }))).toBe("invalid_input");
  });

  test.each([
    ["sin campos", {}],
    ["campo desconocido", { published: true }],
    ["nombre vacío", { name: " " }],
    ["precio 0", { price_from: 0 }],
    ["lat sin lng", { lat: 20 }],
    ["servicio inválido", { services: ["otro"] }],
    ["servicios repetidos", { services: ["repair", "repair"] }],
    ["código postal inválido", { postal_code: "977" }],
    ["horario con día inválido", { hours: { xxx: [] } }],
  ])("rechaza %s con invalid_input", async (_n, datos) => {
    expect(await codigoDe(mock.saveMyWorkshop(/** @type {any} */ (datos)))).toBe("invalid_input");
  });

  test("fotos: perfil reemplaza al anterior y trabajos tienen límite de 10", async () => {
    await mock.saveMyWorkshop({ name: "Mi taller" });
    const a = await mock.addWorkshopPhoto(FOTO, "profile");
    const b = await mock.addWorkshopPhoto(FOTO, "profile");
    expect((await mock.getMyWorkshop())?.photos.map((f) => f.id)).toEqual([b.id]);
    expect(a.id).not.toBe(b.id);
    for (let i = 0; i < 10; i++) await mock.addWorkshopPhoto(FOTO, "work");
    expect(await codigoDe(mock.addWorkshopPhoto(FOTO, "work"))).toBe("limit_reached");
  });

  test("fotos: rechaza tipo, tamaño y kind inválidos; sin taller es not_found", async () => {
    expect(await codigoDe(mock.addWorkshopPhoto(FOTO, "work"))).toBe("not_found");
    await mock.saveMyWorkshop({ name: "Mi taller" });
    expect(await codigoDe(mock.addWorkshopPhoto({ type: "image/svg+xml", size: 10 }, "work"))).toBe("invalid_input");
    expect(await codigoDe(mock.addWorkshopPhoto({ type: "image/png", size: 6 * 1024 * 1024 }, "work"))).toBe("invalid_input");
    expect(await codigoDe(mock.addWorkshopPhoto(FOTO, /** @type {any} */ ("otra")))).toBe("invalid_input");
  });

  test("removeWorkshopPhoto borra la foto y not_found si no existe", async () => {
    await mock.saveMyWorkshop({ name: "Mi taller" });
    const foto = await mock.addWorkshopPhoto(FOTO, "work");
    await mock.removeWorkshopPhoto(foto.id);
    expect((await mock.getMyWorkshop())?.photos).toEqual([]);
    expect(await codigoDe(mock.removeWorkshopPhoto(foto.id))).toBe("not_found");
  });

  test("roles: anónimo, cliente, sin rol, admin y desactivado", async () => {
    mock.fijarSesionSimulada({ sesion: false });
    expect(await codigoDe(mock.getMyWorkshop())).toBe("not_authenticated");
    expect(await codigoDe(mock.saveMyWorkshop({ name: "X" }))).toBe("not_authenticated");
    for (const rol of ["client", "admin", null]) {
      mock.fijarSesionSimulada({ sesion: true, rol });
      expect(await mock.getMyWorkshop()).toBeNull();
      expect(await codigoDe(mock.saveMyWorkshop({ name: "X" }))).toBe("forbidden");
      expect(await codigoDe(mock.publishMyWorkshop())).toBe("forbidden");
    }
    mock.fijarSesionSimulada({ rol: "craftsman", activo: false });
    expect(await codigoDe(mock.saveMyWorkshop({ name: "X" }))).toBe("inactive_user");
  });
});

describe("validarHorario", () => {
  test.each([
    [{}, true],
    [HORARIO, true],
    [{ mon: [{ open: "09:00", close: "13:00" }, { open: "15:00", close: "19:00" }] }, true],
    [{ mon: [{ open: "18:00", close: "09:00" }] }, false],
    [{ mon: [{ open: "9:00", close: "18:00" }] }, false],
    [{ mon: [{ open: "09:00", close: "24:00" }] }, false],
    [{ mon: [{ open: "09:00", close: "18:00", extra: 1 }] }, false],
    [{ mon: [{ open: "01:00", close: "02:00" }, { open: "03:00", close: "04:00" }, { open: "05:00", close: "06:00" }] }, false],
    [{ lunes: [] }, false],
    [[], false],
    [null, false],
  ])("%j es %s", (horario, esperado) => {
    expect(validarHorario(horario)).toBe(esperado);
  });
});
