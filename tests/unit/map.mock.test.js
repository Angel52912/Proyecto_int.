import { jest } from "@jest/globals";

jest.unstable_mockModule("../../js/supabaseClient.js", () => ({ obtenerCliente: () => ({}) }));
const real = await import("../../js/features/map/api.js");
const mapa = await import("../../js/features/map/api.mock.js");
const { ID_TALLER_SIMULADO } = await import("../../js/features/requests/simulacion.js");
const { distanciaKm, estaAbierto, validarFiltros } = await import("../../js/features/map/validar.js");

const CENTRO = { lat: 20.9674, lng: -89.5926 };
const UUID_AJENO = "99999999-9999-4999-8999-999999999999";
const ID_GINERES = "00000000-0000-4000-8000-0000000000a2";
const ID_ITZIMNA = "00000000-0000-4000-8000-0000000000a3";
const ID_MONTEJO = "00000000-0000-4000-8000-0000000000a4";
const ID_SUSPENDIDO = "00000000-0000-4000-8000-0000000000a5";

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
const ids = (lista) => lista.map((t) => t.id);

beforeEach(() => {
  mapa.reiniciarSimulacion();
});

describe("mapa: contrato", () => {
  test.each(["searchWorkshops", "getWorkshopProfile"])("real y simulado exportan %s", (nombre) => {
    expect(typeof real[nombre]).toBe("function");
    expect(typeof mapa[nombre]).toBe("function");
  });
});

describe("estaAbierto (hora de Mérida)", () => {
  const horario = { mon: [{ open: "09:00", close: "18:00" }], tue: [{ open: "10:00", close: "12:00" }, { open: "16:00", close: "20:00" }], sun: [] };

  test("el rango es [open, close): abre a la hora de apertura y a la de cierre ya está cerrado", () => {
    expect(estaAbierto(horario, new Date("2026-11-16T15:00:00Z"))).toBe(true); // lunes 09:00 en Mérida (UTC-6)
    expect(estaAbierto(horario, new Date("2026-11-16T14:59:00Z"))).toBe(false); // 08:59
    expect(estaAbierto(horario, new Date("2026-11-16T23:59:00Z"))).toBe(true); // 17:59
    expect(estaAbierto(horario, new Date("2026-11-17T00:00:00Z"))).toBe(false); // 18:00
  });

  test("usa el día local de Mérida, no el de UTC", () => {
    // 2026-11-17T02:00Z es lunes 20:00 en Mérida: lunes cerrado a esa hora, martes aún no abre.
    expect(estaAbierto(horario, new Date("2026-11-17T02:00:00Z"))).toBe(false);
    // 2026-11-17T17:00Z es martes 11:00 en Mérida: primer rango.
    expect(estaAbierto(horario, new Date("2026-11-17T17:00:00Z"))).toBe(true);
  });

  test("dos rangos en el día, día ausente, día vacío y horario nulo", () => {
    expect(estaAbierto(horario, new Date("2026-11-17T20:00:00Z"))).toBe(false); // martes 14:00, entre rangos
    expect(estaAbierto(horario, new Date("2026-11-17T23:00:00Z"))).toBe(true); // martes 17:00, segundo rango
    expect(estaAbierto(horario, new Date("2026-11-18T17:00:00Z"))).toBe(false); // miércoles ausente
    expect(estaAbierto(horario, new Date("2026-11-22T17:00:00Z"))).toBe(false); // domingo []
    expect(estaAbierto(null, new Date())).toBe(false);
  });
});

describe("distanciaKm", () => {
  test("cero en el mismo punto y simétrica; 1 grado de longitud en el ecuador son unos 111 km", () => {
    expect(distanciaKm(20.9, -89.6, 20.9, -89.6)).toBe(0);
    expect(distanciaKm(0, 0, 0, 1)).toBeCloseTo(111.19, 1);
    expect(distanciaKm(20.9674, -89.5926, 21.0014, -89.6001)).toBe(distanciaKm(21.0014, -89.6001, 20.9674, -89.5926));
  });
});

describe("validarFiltros", () => {
  test("normaliza los filtros a los parámetros del RPC", () => {
    expect(validarFiltros({ service: "repair", colonia: "  Centro ", ...CENTRO, max_distance_km: 5 })).toEqual({
      p_service: "repair",
      p_lat: CENTRO.lat,
      p_lng: CENTRO.lng,
      p_max_distance_km: 5,
      p_colonia: "Centro",
      p_postal_code: null,
      p_min_rating: null,
      p_open_now: false,
      p_max_price: null,
      p_limit: 50,
      p_offset: 0,
    });
    expect(validarFiltros({ service: "cleaning", colonia: "   " }).p_colonia).toBeNull();
  });

  test.each([
    ["sin servicio", {}],
    ["servicio inválido", { service: "otro" }],
    ["lat sin lng", { service: "repair", lat: 20 }],
    ["lng sin lat", { service: "repair", lng: -89 }],
    ["coordenadas fuera de rango", { service: "repair", lat: 91, lng: 0 }],
    ["distancia sin ubicación", { service: "repair", max_distance_km: 5 }],
    ["distancia cero", { service: "repair", ...CENTRO, max_distance_km: 0 }],
    ["distancia mayor a 500", { service: "repair", ...CENTRO, max_distance_km: 501 }],
    ["código postal inválido", { service: "repair", postal_code: "123" }],
    ["calificación menor a 1", { service: "repair", min_rating: 0 }],
    ["calificación mayor a 5", { service: "repair", min_rating: 6 }],
    ["open_now no booleano", { service: "repair", open_now: "si" }],
    ["precio cero", { service: "repair", max_price: 0 }],
    ["precio NaN", { service: "repair", max_price: Number.NaN }],
    ["colonia de más de 100 caracteres", { service: "repair", colonia: "x".repeat(101) }],
    ["límite cero", { service: "repair", limit: 0 }],
    ["límite mayor a 100", { service: "repair", limit: 101 }],
    ["offset negativo", { service: "repair", offset: -1 }],
  ])("rechaza %s con invalid_input", (_nombre, filtros) => {
    expect(() => validarFiltros(/** @type {any} */ (filtros))).toThrow(expect.objectContaining({ code: "invalid_input" }));
  });
});

describe("searchWorkshops (simulado)", () => {
  test("solo servicio: sin ubicación ordena por calificación y excluye al suspendido", async () => {
    const r = await mapa.searchWorkshops({ service: "repair" });
    expect(ids(r)).toEqual([ID_TALLER_SIMULADO, ID_GINERES, ID_MONTEJO]);
    expect(r.every((t) => t.distance_km === null)).toBe(true);
    expect(ids(await mapa.searchWorkshops({ service: "cleaning" }))).toEqual([ID_TALLER_SIMULADO, ID_MONTEJO, ID_ITZIMNA]);
  });

  test("no devuelve owner_id, published ni suspended", async () => {
    const [primero] = await mapa.searchWorkshops({ service: "repair" });
    expect(Object.keys(primero).sort()).toEqual(
      [
        "address", "colonia", "distance_km", "hours", "id", "is_open", "lat", "lng", "name", "postal_code",
        "price_from", "profile_photo_url", "rating_avg", "rating_count", "services",
      ].sort(),
    );
    expect(primero.profile_photo_url).toContain(ID_TALLER_SIMULADO);
  });

  test("con ubicación ordena por cercanía y calcula la distancia", async () => {
    const r = await mapa.searchWorkshops({ service: "repair", ...CENTRO });
    expect(r[0]).toMatchObject({ id: ID_TALLER_SIMULADO, distance_km: 0 });
    const distancias = r.map((t) => /** @type {number} */ (t.distance_km));
    expect(distancias).toEqual([...distancias].sort((a, b) => a - b));
  });

  test("filtra por distancia máxima", async () => {
    expect(ids(await mapa.searchWorkshops({ service: "repair", ...CENTRO, max_distance_km: 1 }))).toEqual([ID_TALLER_SIMULADO]);
    expect(ids(await mapa.searchWorkshops({ service: "repair", ...CENTRO, max_distance_km: 500 }))).toHaveLength(3);
  });

  test("filtra por colonia (subcadena sin distinguir mayúsculas) y por código postal", async () => {
    expect(ids(await mapa.searchWorkshops({ service: "repair", colonia: "GINER" }))).toEqual([ID_GINERES]);
    expect(ids(await mapa.searchWorkshops({ service: "repair", colonia: "centro" }))).toEqual([ID_TALLER_SIMULADO]);
    expect(await mapa.searchWorkshops({ service: "repair", colonia: "%" })).toEqual([]); // el comodín se toma literal
    expect(ids(await mapa.searchWorkshops({ service: "repair", postal_code: "97070" }))).toEqual([ID_GINERES]);
  });

  test("filtra por calificación mínima (excluye los sin calificación) y por precio máximo", async () => {
    expect(ids(await mapa.searchWorkshops({ service: "repair", min_rating: 4.5 }))).toEqual([ID_TALLER_SIMULADO]);
    expect(ids(await mapa.searchWorkshops({ service: "cleaning", min_rating: 1 }))).not.toContain(ID_ITZIMNA);
    expect(ids(await mapa.searchWorkshops({ service: "repair", max_price: 100 }))).toEqual([ID_GINERES]);
  });

  test("open_now deja solo los abiertos ahora", async () => {
    const todos = await mapa.searchWorkshops({ service: "repair" });
    const abiertos = await mapa.searchWorkshops({ service: "repair", open_now: true });
    expect(abiertos.every((t) => t.is_open)).toBe(true);
    expect(ids(abiertos)).toContain(ID_GINERES); // abierto todo el día
    expect(ids(abiertos)).not.toContain(ID_MONTEJO); // cerrado siempre
    expect(abiertos.length).toBe(todos.filter((t) => t.is_open).length);
  });

  test("limit y offset paginan sobre el orden", async () => {
    expect(ids(await mapa.searchWorkshops({ service: "repair", limit: 1 }))).toEqual([ID_TALLER_SIMULADO]);
    expect(ids(await mapa.searchWorkshops({ service: "repair", limit: 1, offset: 1 }))).toEqual([ID_GINERES]);
    expect(await mapa.searchWorkshops({ service: "repair", offset: 10 })).toEqual([]);
  });

  test("A2: sin resultados devuelve [] y no lanza", async () => {
    expect(await mapa.searchWorkshops({ service: "repair", colonia: "no existe" })).toEqual([]);
    mapa.fijarTalleresSimulados([]);
    expect(await mapa.searchWorkshops({ service: "repair" })).toEqual([]);
  });

  test("A1: sin ubicación se busca por colonia o código postal", async () => {
    expect(ids(await mapa.searchWorkshops({ service: "cleaning", postal_code: "97100" }))).toEqual([ID_ITZIMNA]);
  });

  test("un taller no publicado no aparece", async () => {
    mapa.fijarTalleresSimulados([]);
    expect(await mapa.searchWorkshops({ service: "repair" })).toEqual([]);
  });

  test("artesano, admin y sin rol: forbidden; inactivo: inactive_user; anónimo: not_authenticated", async () => {
    for (const rol of ["craftsman", "admin", null]) {
      mapa.fijarSesionSimulada({ rol });
      expect(await codigoDe(mapa.searchWorkshops({ service: "repair" }))).toBe("forbidden");
    }
    mapa.fijarSesionSimulada({ rol: "client", activo: false });
    expect(await codigoDe(mapa.searchWorkshops({ service: "repair" }))).toBe("inactive_user");
    mapa.fijarSesionSimulada({ activo: true, sesion: false });
    expect(await codigoDe(mapa.searchWorkshops({ service: "repair" }))).toBe("not_authenticated");
  });

  test("filtros inválidos lanzan invalid_input antes de revisar la sesión", async () => {
    expect(await codigoDe(mapa.searchWorkshops(/** @type {any} */ ({})))).toBe("invalid_input");
  });
});

describe("getWorkshopProfile (simulado)", () => {
  test("flujo principal: datos, calificación, horario, precio y fotos con la de perfil primero", async () => {
    const perfil = await mapa.getWorkshopProfile(ID_TALLER_SIMULADO);
    expect(perfil).toMatchObject({ id: ID_TALLER_SIMULADO, name: "Calzado El Buen Paso", rating_avg: 4.8, price_from: 120, distance_km: null });
    expect(perfil.photos.map((f) => f.kind)).toEqual(["profile", "work"]);
    expect(perfil.photos[0].url).toContain(perfil.photos[0].path);
    expect(perfil).not.toHaveProperty("owner_id");
    expect(typeof perfil.is_open).toBe("boolean");
  });

  test("con ubicación calcula la distancia", async () => {
    expect((await mapa.getWorkshopProfile(ID_TALLER_SIMULADO, CENTRO)).distance_km).toBe(0);
    expect(((await mapa.getWorkshopProfile(ID_ITZIMNA, CENTRO)).distance_km ?? 0) > 0).toBe(true);
  });

  test("suspendido o inexistente: not_found; id o ubicación inválidos: invalid_input", async () => {
    expect(await codigoDe(mapa.getWorkshopProfile(ID_SUSPENDIDO))).toBe("not_found");
    expect(await codigoDe(mapa.getWorkshopProfile(UUID_AJENO))).toBe("not_found");
    expect(await codigoDe(mapa.getWorkshopProfile("x"))).toBe("invalid_input");
    expect(await codigoDe(mapa.getWorkshopProfile(ID_TALLER_SIMULADO, /** @type {any} */ ({ lat: 20 })))).toBe("invalid_input");
  });

  test("artesano, admin y sin rol: forbidden; inactivo: inactive_user; anónimo: not_authenticated", async () => {
    for (const rol of ["craftsman", "admin", null]) {
      mapa.fijarSesionSimulada({ rol });
      expect(await codigoDe(mapa.getWorkshopProfile(ID_TALLER_SIMULADO))).toBe("forbidden");
    }
    mapa.fijarSesionSimulada({ rol: "client", activo: false });
    expect(await codigoDe(mapa.getWorkshopProfile(ID_TALLER_SIMULADO))).toBe("inactive_user");
    mapa.fijarSesionSimulada({ activo: true, sesion: false });
    expect(await codigoDe(mapa.getWorkshopProfile(ID_TALLER_SIMULADO))).toBe("not_authenticated");
  });
});
