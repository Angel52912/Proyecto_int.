import { mostrarErrorCampo, validarEnVivo } from "../../js/ui/validacion.js";

/** Campo con la misma forma que usan las pantallas: .campo > input + .campo__error. */
function campo() {
  const contenedor = document.createElement("div");
  contenedor.className = "campo";
  const input = document.createElement("input");
  const error = document.createElement("p");
  error.className = "campo__error";
  contenedor.append(input, error);
  document.body.append(contenedor);
  return { contenedor, input, error };
}

/** @param {HTMLInputElement} input @param {string} valor */
function escribir(input, valor) {
  input.value = valor;
  input.dispatchEvent(new Event("input"));
}

beforeEach(() => {
  document.body.innerHTML = "";
});

describe("validarEnVivo", () => {
  test("no marca error al pasar por un campo vacío sin escribir", () => {
    const { input, error } = campo();
    validarEnVivo({ cp: input }, () => (/^\d{5}$/.test(input.value) ? {} : { cp: "Cinco dígitos." }));
    input.dispatchEvent(new Event("blur"));
    expect(error.textContent).toBe("");
  });

  test("marca el error al salir del campo y lo quita en cuanto se corrige", () => {
    const { contenedor, input, error } = campo();
    validarEnVivo({ cp: input }, () => (/^\d{5}$/.test(input.value) ? {} : { cp: "Cinco dígitos." }));
    escribir(input, "97");
    expect(error.textContent).toBe("");
    input.dispatchEvent(new Event("blur"));
    expect(error.textContent).toBe("Cinco dígitos.");
    expect(contenedor.classList.contains("campo--error")).toBe(true);
    expect(input.getAttribute("aria-invalid")).toBe("true");
    escribir(input, "97000");
    expect(error.textContent).toBe("");
    expect(contenedor.classList.contains("campo--error")).toBe(false);
    expect(input.hasAttribute("aria-invalid")).toBe(false);
  });

  test("solo muestra errores de los campos ya tocados", () => {
    const a = campo();
    const b = campo();
    validarEnVivo({ a: a.input, b: b.input }, () => ({ a: "Error A", b: "Error B" }));
    escribir(a.input, "x");
    a.input.dispatchEvent(new Event("blur"));
    expect(a.error.textContent).toBe("Error A");
    expect(b.error.textContent).toBe("");
  });

  test("mostrarErrorCampo escribe con textContent", () => {
    const { input, error } = campo();
    mostrarErrorCampo(input, "<b>mal</b>");
    expect(error.textContent).toBe("<b>mal</b>");
    expect(error.querySelector("b")).toBeNull();
  });
});
