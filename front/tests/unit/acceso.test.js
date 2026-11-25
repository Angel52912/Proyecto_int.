// Pantallas de acceso (CU-01) y guardia por rol contra el api simulado.
import { ApiError } from "../../../apis/lib/apiError.js";
import { reiniciarSimulacion as reiniciarAuth } from "../../../apis/api-inicio-sesion/api.mock.js";
import { datosAcceso, guardarDatosAcceso, limpiarDatosAcceso } from "../../js/features/auth/flujo.js";
import { destinoPorPerfil, soloPara } from "../../js/features/auth/guardia.js";
import { crearPasosRegistro, renderBienvenida } from "../../js/features/auth/pages/bienvenida.js";
import { formatoCuenta, repartirCodigo } from "../../js/features/auth/pages/codigo.js";
import { validarDatosPerfil } from "../../js/features/auth/pages/completar-perfil.js";
import { renderCorreo, validarFormularioAcceso } from "../../js/features/auth/pages/correo.js";
import { renderRol } from "../../js/features/auth/pages/rol.js";
import { fijarSesionSimulada, reiniciarSimulacion } from "../../../apis/api-mixanab/requests/simulacion.js";
import { mensajeDeError } from "../../js/ui/mensajes.js";

const esperar = () => new Promise((resolver) => setTimeout(resolver, 0));

beforeEach(() => {
  reiniciarSimulacion();
  reiniciarAuth();
  limpiarDatosAcceso();
  window.location.hash = "";
});

describe("destino tras entrar", () => {
  test("sin rol, sin nombre o con rol", () => {
    expect(destinoPorPerfil({ role: null, full_name: "" })).toBe("/acceso/rol");
    expect(destinoPorPerfil({ role: "client", full_name: " " })).toBe("/acceso/perfil");
    expect(destinoPorPerfil({ role: "client", full_name: "Ana" })).toBe("/principal");
    expect(destinoPorPerfil({ role: "craftsman", full_name: "Luis" })).toBe("/artesano/tablero");
    expect(destinoPorPerfil({ role: "admin", full_name: "" })).toBe("/admin");
  });
});

describe("guardia por rol", () => {
  const vista = () => document.createElement("section");

  test("deja pasar al rol indicado", async () => {
    const nodo = await soloPara(["client"], vista)({ params: {}, consulta: new URLSearchParams() });
    expect(nodo.nodeName).toBe("SECTION");
  });

  test("manda al cliente a su inicio si abre una ruta de artesano", async () => {
    const nodo = await soloPara(["craftsman"], vista)({ params: {}, consulta: new URLSearchParams() });
    expect(nodo.nodeName).not.toBe("SECTION");
    expect(window.location.hash).toBe("#/principal");
  });

  test("al artesano lo manda a su tablero", async () => {
    fijarSesionSimulada({ rol: "craftsman" });
    await soloPara(["client"], vista)({ params: {}, consulta: new URLSearchParams() });
    expect(window.location.hash).toBe("#/artesano/tablero");
  });

  test("sin sesión manda a Acceso y sin rol a elegirlo", async () => {
    fijarSesionSimulada({ sesion: false });
    await soloPara(["client"], vista)({ params: {}, consulta: new URLSearchParams() });
    expect(window.location.hash).toBe("#/acceso");
    fijarSesionSimulada({ sesion: true, rol: null });
    await soloPara(["client"], vista)({ params: {}, consulta: new URLSearchParams() });
    expect(window.location.hash).toBe("#/acceso/rol");
  });
});

describe("formulario de correo", () => {
  test("al crear cuenta pide nombre, correo válido y términos", () => {
    const mal = validarFormularioAcceso({ modo: "crear", nombre: " ", correo: "x@", acepta: false });
    expect(Object.keys(mal.errores).sort()).toEqual(["acepta", "correo", "nombre"]);
    const bien = validarFormularioAcceso({ modo: "crear", nombre: "  José   Cámara ", correo: " Jose@Correo.COM ", acepta: true });
    expect(bien.errores).toEqual({});
    expect(bien.datos).toEqual({ nombre: "José Cámara", correo: "jose@correo.com" });
  });

  test("al iniciar sesión solo pide el correo", () => {
    expect(validarFormularioAcceso({ modo: "entrar", nombre: "", correo: "ana@correo.com", acepta: false }).errores).toEqual({});
  });

  test("sin campo de contraseña y con términos solo al crear", () => {
    const crear = /** @type {HTMLElement} */ (renderCorreo("crear")());
    expect(crear.querySelector('input[type="password"]')).toBeNull();
    expect(crear.querySelector('input[type="checkbox"]')).not.toBeNull();
    const entrar = /** @type {HTMLElement} */ (renderCorreo("entrar")());
    expect(entrar.querySelector("#nombre")).toBeNull();
    expect(entrar.querySelector('input[type="checkbox"]')).toBeNull();
  });

  test("envía el código y guarda el correo para la verificación", async () => {
    const pantalla = /** @type {HTMLElement} */ (renderCorreo("crear")());
    /** @type {HTMLInputElement} */ (pantalla.querySelector("#nombre")).value = "Ana Pérez";
    /** @type {HTMLInputElement} */ (pantalla.querySelector("#correo")).value = "ana@correo.com";
    /** @type {HTMLInputElement} */ (pantalla.querySelector("#acepta")).checked = true;
    pantalla.querySelector("form")?.dispatchEvent(new Event("submit", { cancelable: true }));
    await esperar();
    expect(window.location.hash).toBe("#/acceso/codigo");
    expect(datosAcceso()).toEqual({ correo: "ana@correo.com", nombre: "Ana Pérez" });
  });
});

describe("código de verificación", () => {
  test("cuenta regresiva y reparto del código pegado", () => {
    expect(formatoCuenta(60)).toBe("1:00");
    expect(formatoCuenta(42)).toBe("0:42");
    expect(formatoCuenta(-3)).toBe("0:00");
    expect(repartirCodigo("12 34-56")).toEqual(["1", "2", "3", "4", "5", "6"]);
    expect(repartirCodigo("1234567", 3)).toEqual(["1", "2", "3"]);
  });

  test("mensajes en español para los códigos de acceso", () => {
    expect(mensajeDeError(new ApiError("invalid_code"))).toMatch(/código/);
    expect(mensajeDeError(new ApiError("auth_failed"))).toMatch(/iniciar sesión/);
    expect(mensajeDeError(new ApiError("role_already_set"))).toMatch(/Ya elegiste/);
  });
});

describe("rol y perfil", () => {
  test("elegir rol lleva a completar el perfil", async () => {
    const { signInWithEmail, verifyEmailCode, CODIGO_SIMULADO } = await import("../../../apis/api-inicio-sesion/api.mock.js");
    await signInWithEmail("ana@correo.com");
    await verifyEmailCode("ana@correo.com", CODIGO_SIMULADO);
    const pantalla = /** @type {HTMLElement} */ (renderRol());
    /** @type {HTMLInputElement} */ (pantalla.querySelector('input[value="craftsman"]')).checked = true;
    pantalla.querySelector("form")?.dispatchEvent(new Event("submit", { cancelable: true }));
    await esperar();
    await esperar();
    expect(window.location.hash).toBe("#/acceso/perfil");
  });

  test("valida nombre y, solo para el cliente, edad y dirección", () => {
    expect(validarDatosPerfil({ rol: "craftsman", nombre: "Luis", edad: "", direccion: "" }).errores).toEqual({});
    const mal = validarDatosPerfil({ rol: "client", nombre: "", edad: "200", direccion: " " });
    expect(Object.keys(mal.errores).sort()).toEqual(["direccion", "edad", "nombre"]);
    expect(validarDatosPerfil({ rol: "client", nombre: "Ana", edad: "2.5", direccion: "Centro" }).errores.edad).toBeDefined();
    expect(validarDatosPerfil({ rol: "client", nombre: " Ana ", edad: "30", direccion: " Centro " }).datos).toEqual({ full_name: "Ana", age: 30, address: "Centro" });
  });
});

describe("indicador del registro", () => {
  test("dice el paso y marca los segmentos hechos", () => {
    const indicador = crearPasosRegistro(2);
    expect(indicador.querySelector(".acceso__pasos-texto")?.textContent).toBe("Paso 2 de 4 · Código");
    const barra = indicador.querySelector('[role="progressbar"]');
    expect(barra?.getAttribute("aria-valuenow")).toBe("2");
    expect(indicador.querySelectorAll(".acceso__pasos-segmento--hecho")).toHaveLength(2);
    expect(indicador.querySelectorAll(".acceso__pasos-segmento")).toHaveLength(4);
  });
});

describe("estado del flujo", () => {
  test("guarda y limpia correo y nombre", () => {
    guardarDatosAcceso({ correo: "a@b.com" });
    guardarDatosAcceso({ nombre: "Ana" });
    expect(datosAcceso()).toEqual({ correo: "a@b.com", nombre: "Ana" });
    limpiarDatosAcceso();
    expect(datosAcceso()).toEqual({ correo: "", nombre: "" });
  });

  test("la bienvenida ofrece las tres formas de entrar", () => {
    const pantalla = /** @type {HTMLElement} */ (renderBienvenida());
    const textos = [...pantalla.querySelectorAll("a, button")].map((n) => n.textContent);
    expect(textos).toEqual(["Iniciar sesión", "Crear cuenta", "GContinuar con Google"]);
  });
});
