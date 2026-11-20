import { jest } from "@jest/globals";

jest.unstable_mockModule("../../js/supabaseClient.js", () => ({ obtenerCliente: () => ({}) }));
const real = await import("../../js/features/auth/api.js");
const mock = await import("../../js/features/auth/api.mock.js");

const FUNCIONES_DEL_CONTRATO = [
  "signInWithGoogle",
  "signInWithEmail",
  "verifyEmailCode",
  "resendEmailCode",
  "getMyProfile",
  "setMyRole",
  "updateMyProfile",
  "getMyClientPrivate",
  "saveMyClientPrivate",
  "signOut",
];

/** @param {Promise<unknown>} promesa @returns {Promise<string>} */
async function codigoDe(promesa) {
  try {
    await promesa;
  } catch (error) {
    return /** @type {any} */ (error).code;
  }
  return "sin_error";
}

async function iniciarSesion() {
  await mock.signInWithEmail("a@b.co");
  await mock.verifyEmailCode("a@b.co", mock.CODIGO_SIMULADO);
}

beforeEach(() => mock.reiniciarSimulacion());

describe("api.mock.js de auth", () => {
  test.each(FUNCIONES_DEL_CONTRATO)("%s existe en api.js y api.mock.js", (nombre) => {
    expect(typeof real[nombre]).toBe("function");
    expect(typeof mock[nombre]).toBe("function");
  });

  test("sin sesión, el perfil lanza not_authenticated", async () => {
    expect(await codigoDe(mock.getMyProfile())).toBe("not_authenticated");
  });

  test("código incorrecto lanza invalid_code; correcto crea el perfil sin rol", async () => {
    await mock.signInWithEmail("a@b.co");
    expect(await codigoDe(mock.verifyEmailCode("a@b.co", "000000"))).toBe("invalid_code");
    await mock.verifyEmailCode("a@b.co", mock.CODIGO_SIMULADO);
    expect(await mock.getMyProfile()).toMatchObject({ role: null, active: true });
  });

  test("el rol se elige una sola vez y admin se rechaza", async () => {
    await iniciarSesion();
    expect(await codigoDe(mock.setMyRole("admin"))).toBe("invalid_input");
    await expect(mock.setMyRole("craftsman")).resolves.toEqual({ role: "craftsman" });
    expect(await codigoDe(mock.setMyRole("client"))).toBe("role_already_set");
  });

  test("sin rol no puede editar el perfil (forbidden)", async () => {
    await iniciarSesion();
    expect(await codigoDe(mock.updateMyProfile({ full_name: "Ana" }))).toBe("forbidden");
  });

  test("el cliente guarda y lee sus datos privados; el artesano no puede", async () => {
    await iniciarSesion();
    await mock.setMyRole("client");
    await mock.saveMyClientPrivate({ age: 30, address: "Calle 60" });
    await expect(mock.getMyClientPrivate()).resolves.toMatchObject({ age: 30, address: "Calle 60" });

    mock.reiniciarSimulacion();
    await iniciarSesion();
    await mock.setMyRole("craftsman");
    expect(await codigoDe(mock.saveMyClientPrivate({ age: 30, address: "X" }))).toBe("forbidden");
    await expect(mock.getMyClientPrivate()).resolves.toBeNull();
  });

  test("signOut limpia la sesión", async () => {
    await iniciarSesion();
    await mock.signOut();
    expect(await codigoDe(mock.getMyProfile())).toBe("not_authenticated");
  });
});
