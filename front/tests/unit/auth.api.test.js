import { jest } from "@jest/globals";

/** Cliente falso: registra llamadas y devuelve respuestas encoladas. */
function crearFalso({ uid = "u-1" } = {}) {
  /** @type {any[]} */
  const respuestas = [];
  /** @type {any[]} */
  const llamadas = [];
  const builder = {
    select: (...a) => (llamadas.push(["select", ...a]), builder),
    update: (...a) => (llamadas.push(["update", ...a]), builder),
    insert: (...a) => (llamadas.push(["insert", ...a]), builder),
    eq: (...a) => (llamadas.push(["eq", ...a]), builder),
    maybeSingle: async () => respuestas.shift(),
  };
  const cliente = {
    auth: {
      getSession: async () => ({ data: { session: uid ? { user: { id: uid } } : null }, error: null }),
      signInWithOtp: jest.fn(async () => respuestas.shift()),
      signInWithOAuth: jest.fn(async () => respuestas.shift()),
      verifyOtp: jest.fn(async () => respuestas.shift()),
      signOut: jest.fn(async () => respuestas.shift()),
    },
    from: jest.fn((tabla) => (llamadas.push(["from", tabla]), builder)),
    rpc: jest.fn(async () => respuestas.shift()),
  };
  return { cliente, respuestas, llamadas };
}

let falso = crearFalso();
jest.unstable_mockModule("../../js/supabaseClient.js", () => ({ obtenerCliente: () => falso.cliente }));
const api = await import("../../js/features/auth/api.js");

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
  falso = crearFalso();
});

describe("auth/api.js real", () => {
  test("signInWithEmail envía el código y responde { sent: true }", async () => {
    falso.respuestas.push({ error: null });
    await expect(api.signInWithEmail("a@b.co")).resolves.toEqual({ sent: true });
    expect(falso.cliente.auth.signInWithOtp).toHaveBeenCalledWith({ email: "a@b.co", options: { shouldCreateUser: true } });
  });

  test("signInWithEmail rechaza correos inválidos sin llamar a Supabase", async () => {
    expect(await codigoDe(api.signInWithEmail("no-es-correo"))).toBe("invalid_input");
    expect(falso.cliente.auth.signInWithOtp).not.toHaveBeenCalled();
  });

  test("signInWithEmail traduce el límite de envíos (429) a rate_limited", async () => {
    falso.respuestas.push({ error: { status: 429, code: "over_email_send_rate_limit", message: "x" } });
    expect(await codigoDe(api.signInWithEmail("a@b.co"))).toBe("rate_limited");
  });

  test("resendEmailCode reenvía y respeta rate_limited (A2)", async () => {
    falso.respuestas.push({ error: { status: 429, message: "x" } });
    expect(await codigoDe(api.resendEmailCode("a@b.co"))).toBe("rate_limited");
  });

  test("verifyEmailCode devuelve la sesión con user_id", async () => {
    falso.respuestas.push({ data: { user: { id: "u-9" } }, error: null });
    await expect(api.verifyEmailCode("a@b.co", "123456")).resolves.toEqual({ session: { user_id: "u-9" } });
  });

  test.each(["12345", "1234567", "abcdef", ""])("verifyEmailCode rechaza el código %p con invalid_input", async (codigo) => {
    expect(await codigoDe(api.verifyEmailCode("a@b.co", codigo))).toBe("invalid_input");
  });

  test("verifyEmailCode traduce un código vencido o incorrecto a invalid_code (A1)", async () => {
    falso.respuestas.push({ data: null, error: { code: "otp_expired", message: "Token has expired" } });
    expect(await codigoDe(api.verifyEmailCode("a@b.co", "123456"))).toBe("invalid_code");
  });

  test("signInWithGoogle traduce fallas a auth_failed", async () => {
    falso.respuestas.push({ error: { message: "boom" } });
    expect(await codigoDe(api.signInWithGoogle())).toBe("auth_failed");
  });

  test("getMyProfile sin sesión lanza not_authenticated", async () => {
    falso = crearFalso({ uid: "" });
    expect(await codigoDe(api.getMyProfile())).toBe("not_authenticated");
  });

  test("getMyProfile devuelve el perfil propio", async () => {
    const perfil = { id: "u-1", role: null, full_name: "", avatar_path: null, active: true };
    falso.respuestas.push({ data: perfil, error: null });
    await expect(api.getMyProfile()).resolves.toEqual(perfil);
    expect(falso.llamadas).toContainEqual(["eq", "id", "u-1"]);
  });

  test("setMyRole llama al RPC set_my_role y devuelve { role }", async () => {
    falso.respuestas.push({ data: "client", error: null });
    await expect(api.setMyRole("client")).resolves.toEqual({ role: "client" });
    expect(falso.cliente.rpc).toHaveBeenCalledWith("set_my_role", { p_role: "client" });
  });

  test.each(["admin", "otro", ""])("setMyRole rechaza %p en el cliente sin llamar al RPC", async (rol) => {
    expect(await codigoDe(api.setMyRole(rol))).toBe("invalid_input");
    expect(falso.cliente.rpc).not.toHaveBeenCalled();
  });

  test.each(["role_already_set", "inactive_user", "not_authenticated", "invalid_input"])(
    "setMyRole traduce el mensaje SQL %s",
    async (mensaje) => {
      falso.respuestas.push({ data: null, error: { code: "P0001", message: mensaje } });
      expect(await codigoDe(api.setMyRole("client"))).toBe(mensaje);
    },
  );

  test("updateMyProfile actualiza solo nombre y foto", async () => {
    const perfil = { id: "u-1", role: "client", full_name: "Ana", avatar_path: null, active: true };
    falso.respuestas.push({ data: perfil, error: null });
    await expect(api.updateMyProfile({ full_name: "  Ana  " })).resolves.toEqual(perfil);
    expect(falso.llamadas).toContainEqual(["update", { full_name: "Ana" }]);
  });

  test("updateMyProfile no envía role ni active aunque se los pasen", async () => {
    falso.respuestas.push({ data: { id: "u-1" }, error: null });
    await api.updateMyProfile(/** @type {any} */ ({ full_name: "Ana", role: "admin", active: false }));
    expect(falso.llamadas).toContainEqual(["update", { full_name: "Ana" }]);
  });

  test("updateMyProfile devuelve forbidden si RLS no afecta ninguna fila (sin rol, admin, desactivado)", async () => {
    falso.respuestas.push({ data: null, error: null });
    expect(await codigoDe(api.updateMyProfile({ full_name: "Ana" }))).toBe("forbidden");
  });

  test.each([{}, { full_name: "" }, { full_name: "x".repeat(101) }, { avatar_path: "" }])(
    "updateMyProfile rechaza %j con invalid_input",
    async (cambios) => {
      expect(await codigoDe(api.updateMyProfile(cambios))).toBe("invalid_input");
    },
  );

  test("getMyClientPrivate devuelve null si no hay datos", async () => {
    falso.respuestas.push({ data: null, error: null });
    await expect(api.getMyClientPrivate()).resolves.toBeNull();
  });

  test("saveMyClientPrivate inserta la primera vez y actualiza después", async () => {
    const fila = { user_id: "u-1", age: 30, address: "Calle 60" };
    falso.respuestas.push({ data: null, error: null }, { data: fila, error: null });
    await expect(api.saveMyClientPrivate({ age: 30, address: " Calle 60 " })).resolves.toEqual(fila);
    expect(falso.llamadas).toContainEqual(["insert", fila]);

    falso = crearFalso();
    falso.respuestas.push({ data: fila, error: null }, { data: { ...fila, age: 31 }, error: null });
    await api.saveMyClientPrivate({ age: 31, address: "Calle 60" });
    expect(falso.llamadas).toContainEqual(["update", { age: 31, address: "Calle 60" }]);
  });

  test("saveMyClientPrivate traduce permiso denegado (artesano o admin) a forbidden", async () => {
    falso.respuestas.push({ data: null, error: null }, { data: null, error: { code: "42501", message: "rls" } });
    expect(await codigoDe(api.saveMyClientPrivate({ age: 30, address: "X" }))).toBe("forbidden");
  });

  test.each([{ age: 0, address: "X" }, { age: 121, address: "X" }, { age: 30.5, address: "X" }, { age: 30, address: " " }])(
    "saveMyClientPrivate rechaza %j con invalid_input",
    async (datos) => {
      expect(await codigoDe(api.saveMyClientPrivate(datos))).toBe("invalid_input");
    },
  );

  test("errores desconocidos se traducen a unexpected", async () => {
    falso.respuestas.push({ data: null, error: { code: "XX000", message: "algo raro" } });
    expect(await codigoDe(api.getMyProfile())).toBe("unexpected");
  });
});
