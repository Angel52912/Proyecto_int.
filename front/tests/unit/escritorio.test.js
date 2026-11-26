import { esEscritorio, instalarDeteccionEscritorio } from "../../js/ui/escritorio.js";

describe("esEscritorio", () => {
  test.each([
    [undefined, true, true],
    [undefined, false, false],
    ["pc", false, true],
    ["pc", true, true],
    ["movil", true, false],
    ["movil", false, false],
  ])("vista %s y ancho de escritorio %s → %s", (vista, ancho, esperado) => {
    expect(esEscritorio(vista, ancho)).toBe(esperado);
  });
});

describe("instalarDeteccionEscritorio", () => {
  afterEach(() => {
    delete document.documentElement.dataset.vista;
    document.documentElement.removeAttribute("data-escritorio");
  });

  test("sigue a la vista forzada aunque no haya matchMedia (jsdom)", async () => {
    instalarDeteccionEscritorio();
    expect(document.documentElement.hasAttribute("data-escritorio")).toBe(false);
    document.documentElement.dataset.vista = "pc";
    await new Promise((r) => setTimeout(r, 0));
    expect(document.documentElement.hasAttribute("data-escritorio")).toBe(true);
    document.documentElement.dataset.vista = "movil";
    await new Promise((r) => setTimeout(r, 0));
    expect(document.documentElement.hasAttribute("data-escritorio")).toBe(false);
  });
});
