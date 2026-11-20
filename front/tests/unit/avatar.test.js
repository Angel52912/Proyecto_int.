import { webcrypto } from "node:crypto";
import { jest } from "@jest/globals";

const UID = "11111111-1111-4111-8111-111111111111";
const ACTUAL = `${UID}/22222222-2222-4222-8222-222222222222`;
const OTRO_UID = "33333333-3333-4333-8333-333333333333";
const FOTO = { type: "image/png", size: 1000 };

/** Cliente falso con Storage: registra llamadas y devuelve respuestas encoladas. */
function crearFalso() {
  /** @type {any[]} */
  const respuestas = [];
  /** @type {any[]} */
  const llamadas = [];
  const builder = {
    select: (...a) => (llamadas.push(["select", ...a]), builder),
    update: (...a) => (llamadas.push(["update", ...a]), builder),
    eq: (...a) => (llamadas.push(["eq", ...a]), builder),
    maybeSingle: async () => respuestas.shift(),
  };
  /** @type {Record<string, any>} */
  const almacen = {
    list: jest.fn(async (...a) => (llamadas.push(["list", ...a]), { data: [], error: null })),
    upload: jest.fn(async (...a) => (llamadas.push(["upload", ...a]), { data: {}, error: null })),
    remove: jest.fn(async (...a) => (llamadas.push(["remove", ...a]), { data: [], error: null })),
    createSignedUrl: jest.fn(async (...a) => (llamadas.push(["firmar", ...a]), { data: { signedUrl: "https://firmada.test/x" }, error: null })),
  };
  const cliente = {
    auth: { getSession: async () => ({ data: { session: { user: { id: UID } } }, error: null }) },
    from: jest.fn((tabla) => (llamadas.push(["from", tabla]), builder)),
    storage: { from: jest.fn((bucket) => (llamadas.push(["bucket", bucket]), almacen)) },
  };
  return { cliente, respuestas, llamadas, almacen };
}

// jsdom no trae crypto.randomUUID (los navegadores sí): se completa con el de Node.
if (!globalThis.crypto?.randomUUID) Object.defineProperty(globalThis, "crypto", { value: webcrypto, configurable: true });

let falso = crearFalso();
jest.unstable_mockModule("../../js/supabaseClient.js", () => ({ obtenerCliente: () => falso.cliente }));
const api = await import("../../js/features/auth/api.js");
const mock = await import("../../js/features/auth/api.mock.js");
const { esRutaAvatar } = await import("../../js/features/auth/validar.js");

/** @param {Promise<unknown>} promesa @returns {Promise<string>} */
async function codigoDe(promesa) {
  try {
    await promesa;
  } catch (error) {
    return /** @type {any} */ (error).code;
  }
  return "sin_error";
}

const perfil = (/** @type {string | null} */ avatar) => ({ id: UID, role: "client", full_name: "Ana", avatar_path: avatar, active: true });

beforeEach(() => {
  falso = crearFalso();
  mock.reiniciarSimulacion();
});

describe("esRutaAvatar", () => {
  test("acepta {uid}/{uuid} en minúsculas y rechaza lo demás", () => {
    expect(esRutaAvatar(ACTUAL)).toBe(true);
    expect(esRutaAvatar(`${UID}/abcdefab-cdef-4def-8def-abcdefabcdef`)).toBe(true);
    const enMayusculas = `${UID}/ABCDEFAB-CDEF-4DEF-8DEF-ABCDEFABCDEF`;
    for (const mala of ["", "x/y", UID, `${UID}/`, enMayusculas, `${ACTUAL}/extra`, `../${ACTUAL}`, null, 5]) {
      expect(esRutaAvatar(mala)).toBe(false);
    }
  });
});

describe("addAvatar (real)", () => {
  test("flujo principal: limpia huérfanos, sube a {uid}/{uuid}, guarda la ruta, borra la foto anterior y devuelve la URL firmada", async () => {
    falso.almacen.list.mockResolvedValueOnce({ data: [{ name: "huerfano" }, { name: ACTUAL.split("/")[1] }], error: null });
    falso.respuestas.push({ data: perfil(ACTUAL), error: null }); // getMyProfile
    falso.respuestas.push({ data: perfil("nueva"), error: null }); // update
    const r = await api.addAvatar(FOTO);
    expect(r.url).toBe("https://firmada.test/x");
    expect(esRutaAvatar(r.path)).toBe(true);
    expect(r.path.startsWith(`${UID}/`)).toBe(true);
    expect(falso.llamadas).toContainEqual(["bucket", "avatars"]);
    expect(falso.almacen.list).toHaveBeenCalledWith(UID);
    expect(falso.almacen.upload).toHaveBeenCalledWith(r.path, FOTO, { contentType: "image/png", upsert: false });
    expect(falso.llamadas).toContainEqual(["update", { avatar_path: r.path }]);
    // Primero borra el huérfano (no la foto vigente) y al final la foto anterior.
    expect(falso.almacen.remove.mock.calls).toEqual([[[`${UID}/huerfano`]], [[ACTUAL]]]);
  });

  test("sin foto previa ni archivos no borra nada", async () => {
    falso.respuestas.push({ data: perfil(null), error: null });
    falso.respuestas.push({ data: perfil("nueva"), error: null });
    await api.addAvatar(FOTO);
    expect(falso.almacen.remove).not.toHaveBeenCalled();
  });

  test("si el perfil no se actualiza (RLS) borra el archivo nuevo y lanza forbidden", async () => {
    falso.respuestas.push({ data: perfil(ACTUAL), error: null });
    falso.respuestas.push({ data: null, error: null });
    expect(await codigoDe(api.addAvatar(FOTO))).toBe("forbidden");
    const subida = falso.almacen.upload.mock.calls[0][0];
    expect(falso.almacen.remove).toHaveBeenCalledWith([subida]);
    expect(falso.almacen.remove).not.toHaveBeenCalledWith([ACTUAL]); // la foto vigente se conserva
  });

  test("error 403 de Storage (política): forbidden; no actualiza el perfil", async () => {
    falso.respuestas.push({ data: perfil(null), error: null });
    falso.almacen.upload.mockResolvedValueOnce({ data: null, error: { statusCode: "403", message: "denied" } });
    expect(await codigoDe(api.addAvatar(FOTO))).toBe("forbidden");
    expect(falso.llamadas.some((l) => l[0] === "update")).toBe(false);
  });

  test.each([
    ["tipo no permitido", { type: "application/pdf", size: 10 }],
    ["más de 5 MB", { type: "image/png", size: 6 * 1024 * 1024 }],
    ["sin archivo", null],
  ])("%s: invalid_input sin tocar Storage", async (_nombre, archivo) => {
    expect(await codigoDe(api.addAvatar(/** @type {any} */ (archivo)))).toBe("invalid_input");
    expect(falso.almacen.upload).not.toHaveBeenCalled();
  });
});

describe("removeAvatar y getAvatarUrl (real)", () => {
  test("removeAvatar pone la ruta en null y borra el archivo", async () => {
    falso.respuestas.push({ data: perfil(ACTUAL), error: null });
    falso.respuestas.push({ data: perfil(null), error: null });
    await expect(api.removeAvatar()).resolves.toMatchObject({ avatar_path: null });
    expect(falso.llamadas).toContainEqual(["update", { avatar_path: null }]);
    expect(falso.almacen.remove).toHaveBeenCalledWith([ACTUAL]);
  });

  test("removeAvatar sin foto no borra archivos; con RLS sin filas: forbidden", async () => {
    falso.respuestas.push({ data: perfil(null), error: null });
    falso.respuestas.push({ data: perfil(null), error: null });
    await api.removeAvatar();
    expect(falso.almacen.remove).not.toHaveBeenCalled();
    falso.respuestas.push({ data: perfil(ACTUAL), error: null });
    falso.respuestas.push({ data: null, error: null });
    expect(await codigoDe(api.removeAvatar())).toBe("forbidden");
  });

  test("getAvatarUrl devuelve la URL firmada por una hora y rechaza rutas mal formadas", async () => {
    await expect(api.getAvatarUrl(ACTUAL)).resolves.toBe("https://firmada.test/x");
    expect(falso.llamadas).toContainEqual(["firmar", ACTUAL, 3600]);
    for (const mala of ["x", "", `${UID}/..`, 5]) expect(await codigoDe(api.getAvatarUrl(/** @type {any} */ (mala)))).toBe("invalid_input");
  });

  test("getAvatarUrl traduce el error de Storage (sin permiso): forbidden", async () => {
    falso.almacen.createSignedUrl.mockResolvedValueOnce({ data: null, error: { statusCode: "403", message: "denied" } });
    expect(await codigoDe(api.getAvatarUrl(ACTUAL))).toBe("forbidden");
  });

  test("updateMyProfile solo acepta rutas {su_uid}/{uuid}", async () => {
    expect(await codigoDe(api.updateMyProfile({ avatar_path: `${OTRO_UID}/22222222-2222-4222-8222-222222222222` }))).toBe("invalid_input");
    expect(await codigoDe(api.updateMyProfile({ avatar_path: "x/y" }))).toBe("invalid_input");
    falso.respuestas.push({ data: perfil(ACTUAL), error: null });
    await expect(api.updateMyProfile({ avatar_path: ACTUAL })).resolves.toMatchObject({ avatar_path: ACTUAL });
  });
});

describe("avatar (simulado)", () => {
  /** Inicia sesión y elige rol. */
  async function sesion(rol = "client") {
    await mock.signInWithGoogle();
    await mock.setMyRole(rol);
    return (await mock.getMyProfile()).id;
  }

  test("contrato: real y simulado exportan addAvatar, removeAvatar y getAvatarUrl", () => {
    for (const nombre of ["addAvatar", "removeAvatar", "getAvatarUrl"]) {
      expect(typeof api[nombre]).toBe("function");
      expect(typeof mock[nombre]).toBe("function");
    }
  });

  test("addAvatar guarda la ruta {uid}/{uuid} en el perfil y devuelve la URL; cada subida cambia la ruta", async () => {
    const uid = await sesion("craftsman");
    const a = await mock.addAvatar(FOTO);
    expect(a.path.startsWith(`${uid}/`)).toBe(true);
    expect(esRutaAvatar(a.path)).toBe(true);
    expect(a.url).toContain(a.path);
    expect((await mock.getMyProfile()).avatar_path).toBe(a.path);
    const b = await mock.addAvatar(FOTO);
    expect(b.path).not.toBe(a.path);
    expect((await mock.getMyProfile()).avatar_path).toBe(b.path);
  });

  test("addAvatar: tipo o tamaño inválidos: invalid_input; sin sesión: not_authenticated; sin rol: forbidden", async () => {
    expect(await codigoDe(mock.addAvatar(FOTO))).toBe("not_authenticated");
    await mock.signInWithGoogle();
    expect(await codigoDe(mock.addAvatar(FOTO))).toBe("forbidden"); // sin rol
    await mock.setMyRole("client");
    expect(await codigoDe(mock.addAvatar({ type: "image/gif", size: 10 }))).toBe("invalid_input");
    expect(await codigoDe(mock.addAvatar({ type: "image/png", size: 6 * 1024 * 1024 }))).toBe("invalid_input");
  });

  test("removeAvatar deja la ruta en null; getAvatarUrl valida la ruta", async () => {
    await sesion();
    await mock.addAvatar(FOTO);
    await expect(mock.removeAvatar()).resolves.toMatchObject({ avatar_path: null });
    await expect(mock.removeAvatar()).resolves.toMatchObject({ avatar_path: null }); // no falla si no había
    await expect(mock.getAvatarUrl(ACTUAL)).resolves.toContain(ACTUAL);
    expect(await codigoDe(mock.getAvatarUrl("x/y"))).toBe("invalid_input");
  });

  test("updateMyProfile solo acepta rutas del propio usuario", async () => {
    const uid = await sesion();
    expect(await codigoDe(mock.updateMyProfile({ avatar_path: "x/y" }))).toBe("invalid_input");
    expect(await codigoDe(mock.updateMyProfile({ avatar_path: `${OTRO_UID}/22222222-2222-4222-8222-222222222222` }))).toBe("invalid_input");
    const propia = `${uid}/22222222-2222-4222-8222-222222222222`;
    await expect(mock.updateMyProfile({ avatar_path: propia })).resolves.toMatchObject({ avatar_path: propia });
  });
});
