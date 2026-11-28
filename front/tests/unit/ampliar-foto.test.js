// Fotos que se pueden ampliar (ui/ampliar-foto.js).
import { abrirVisor, esAmpliable, marcarFotos } from "../../js/ui/ampliar-foto.js";

beforeEach(() => {
  document.body.innerHTML = `
    <main id="app">
      <img class="foto" id="suelta" src="a.jpg" alt="Avance de la fase 2">
      <a href="#/taller/1"><img class="foto" id="en-enlace" src="b.jpg" alt="Taller"></a>
      <span class="avatar"><img class="foto" id="avatar" src="c.jpg" alt=""></span>
      <img class="foto" id="otra" src="d.jpg" alt="Avance de la fase 3">
    </main>`;
});

test("solo se amplían las fotos que no llevan a otra pantalla ni son avatares", () => {
  expect(esAmpliable(/** @type {Element} */ (document.getElementById("suelta")))).toBe(true);
  expect(esAmpliable(/** @type {Element} */ (document.getElementById("en-enlace")))).toBe(false);
  expect(esAmpliable(/** @type {Element} */ (document.getElementById("avatar")))).toBe(false);
});

test("las fotos ampliables se pueden enfocar y el lector dice qué hacen", () => {
  marcarFotos(document);
  const suelta = /** @type {HTMLElement} */ (document.getElementById("suelta"));
  expect(suelta.getAttribute("tabindex")).toBe("0");
  expect(suelta.getAttribute("role")).toBe("button");
  expect(suelta.getAttribute("aria-label")).toBe("Ampliar foto: Avance de la fase 2");
  expect(document.getElementById("en-enlace")?.hasAttribute("tabindex")).toBe(false);
});

test("el visor muestra la foto elegida y pasa a la siguiente", () => {
  const fotos = /** @type {HTMLImageElement[]} */ ([document.getElementById("suelta"), document.getElementById("otra")]);
  const visor = abrirVisor(fotos, 1);
  expect(visor.querySelector(".visor-foto__contador")?.textContent).toBe("2 de 2");
  expect(visor.querySelector("img")?.getAttribute("alt")).toBe("Avance de la fase 3");
  /** @type {HTMLButtonElement} */ (visor.querySelector(".visor-foto__siguiente")).click();
  expect(visor.querySelector(".visor-foto__contador")?.textContent).toBe("1 de 2");
  /** @type {HTMLButtonElement} */ (visor.querySelector(".visor-foto__cerrar")).click();
  expect(document.querySelector(".visor-foto")).toBeNull();
});
