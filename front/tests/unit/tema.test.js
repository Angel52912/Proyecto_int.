import { aplicarTema, CLAVE_TEMA, crearSelectorTema, obtenerTema } from "../../js/ui/tema.js";

beforeEach(() => {
  localStorage.clear();
  delete document.documentElement.dataset.tema;
  document.body.innerHTML = "";
});

describe("tema de color", () => {
  test("por omisión sigue al sistema (sin data-tema ni preferencia guardada)", () => {
    expect(obtenerTema()).toBe("auto");
    expect(document.documentElement.dataset.tema).toBeUndefined();
  });

  test("aplicarTema marca <html data-tema> y lo guarda; Automático lo quita", () => {
    aplicarTema("oscuro");
    expect(document.documentElement.dataset.tema).toBe("oscuro");
    expect(localStorage.getItem(CLAVE_TEMA)).toBe("oscuro");
    expect(obtenerTema()).toBe("oscuro");
    aplicarTema("auto");
    expect(document.documentElement.dataset.tema).toBeUndefined();
    expect(localStorage.getItem(CLAVE_TEMA)).toBeNull();
  });

  test("un valor guardado desconocido cuenta como Automático", () => {
    localStorage.setItem(CLAVE_TEMA, "morado");
    expect(obtenerTema()).toBe("auto");
  });

  test("el selector marca la opción actual y cambia el tema al tocar otra", () => {
    aplicarTema("claro");
    const selector = crearSelectorTema();
    document.body.append(selector);
    const opciones = [...selector.querySelectorAll("button")];
    expect(opciones.map((b) => b.textContent)).toEqual(["Automático", "Claro", "Oscuro"]);
    expect(opciones.map((b) => b.getAttribute("aria-pressed"))).toEqual(["false", "true", "false"]);
    opciones[2].click();
    expect(document.documentElement.dataset.tema).toBe("oscuro");
    expect(opciones.map((b) => b.getAttribute("aria-pressed"))).toEqual(["false", "false", "true"]);
    expect(selector.querySelector('[role="group"]')?.getAttribute("aria-labelledby")).toBe("selector-tema-titulo");
  });
});
