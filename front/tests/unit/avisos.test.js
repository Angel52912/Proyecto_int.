import { jest } from "@jest/globals";
import { DURACION_AVISO, mostrarAvisoFlotante } from "../../js/ui/aviso-flotante.js";
import { instalarAvisoConexion, TEXTO_SIN_CONEXION } from "../../js/ui/conexion.js";
import { cargarEn, TEXTO_SIN_INTERNET } from "../../js/ui/estados.js";

/** @param {boolean} valor */
const fijarEnLinea = (valor) => Object.defineProperty(window.navigator, "onLine", { configurable: true, get: () => valor });

beforeEach(() => {
  document.body.innerHTML = "";
  fijarEnLinea(true);
});

afterEach(() => {
  jest.useRealTimers();
});

describe("avisos flotantes", () => {
  test("aparece en una región aria-live, con el texto escapado, y se va solo", () => {
    jest.useFakeTimers();
    const aviso = mostrarAvisoFlotante("<b>Cambios guardados.</b>");
    const region = document.querySelector(".avisos-flotantes");
    expect(region?.getAttribute("aria-live")).toBe("polite");
    expect(aviso.textContent).toBe("<b>Cambios guardados.</b>");
    expect(aviso.querySelector("b")).toBeNull();
    expect(aviso.classList.contains("aviso-flotante--exito")).toBe(true);
    jest.advanceTimersByTime(DURACION_AVISO + 250);
    expect(region?.children).toHaveLength(0);
  });

  test("varios avisos comparten la misma región", () => {
    mostrarAvisoFlotante("Uno");
    mostrarAvisoFlotante("Dos", { tono: "error" });
    expect(document.querySelectorAll(".avisos-flotantes")).toHaveLength(1);
    expect(document.querySelectorAll(".aviso-flotante")).toHaveLength(2);
  });
});

describe("aviso de conexión", () => {
  test("la franja aparece sin internet y se oculta al volver, con aviso de regreso", () => {
    instalarAvisoConexion();
    const franja = /** @type {HTMLElement} */ (document.querySelector(".franja-conexion"));
    expect(franja.hidden).toBe(true);
    fijarEnLinea(false);
    window.dispatchEvent(new Event("offline"));
    expect(franja.hidden).toBe(false);
    expect(franja.textContent).toBe(TEXTO_SIN_CONEXION);
    fijarEnLinea(true);
    window.dispatchEvent(new Event("online"));
    expect(franja.hidden).toBe(true);
    expect(document.querySelector(".aviso-flotante")?.textContent).toBe("Conexión recuperada.");
  });

  test("cargarEn sin internet avisa y reintenta solo al volver la conexión", async () => {
    const destino = document.createElement("div");
    document.body.append(destino);
    fijarEnLinea(false);
    let intentos = 0;
    await cargarEn(
      destino,
      async () => {
        intentos += 1;
        if (intentos === 1) throw new TypeError("Failed to fetch");
        return "listo";
      },
      (v) => document.createTextNode(v),
    );
    expect(destino.textContent).toContain(TEXTO_SIN_INTERNET);
    fijarEnLinea(true);
    window.dispatchEvent(new Event("online"));
    await new Promise((r) => setTimeout(r, 0));
    expect(destino.textContent).toBe("listo");
  });
});
