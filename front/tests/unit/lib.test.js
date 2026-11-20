import { escaparHtml } from "../../js/lib/escape.js";
import { formatearMxn } from "../../js/lib/money.js";
import {
  MAX_IMAGEN_BYTES,
  validarCalificacion,
  validarCodigo,
  validarContrasena,
  validarCoordenadas,
  validarCorreo,
  validarImagen,
} from "../../js/lib/validate.js";

describe("escaparHtml", () => {
  test("escapa caracteres peligrosos", () => {
    expect(escaparHtml('<img src=x onerror="a()">&\'')).toBe("&lt;img src=x onerror=&quot;a()&quot;&gt;&amp;&#39;");
  });
  test("maneja null, undefined y números", () => {
    expect(escaparHtml(null)).toBe("");
    expect(escaparHtml(undefined)).toBe("");
    expect(escaparHtml(42)).toBe("42");
  });
});

describe("formatearMxn", () => {
  test("da formato de pesos", () => {
    expect(formatearMxn(1234.5)).toBe("$1,234.50");
  });
  test("rechaza valores no finitos", () => {
    expect(() => formatearMxn(Number.NaN)).toThrow(RangeError);
  });
});

describe("validarCodigo (OTP y PIN de 6 dígitos)", () => {
  test.each(["123456", "000000"])("acepta %s", (valor) => expect(validarCodigo(valor)).toBe(true));
  test.each(["1234", "1234567", "12345a", "", " 123456", 123456, null])("rechaza %p", (valor) =>
    expect(validarCodigo(valor)).toBe(false),
  );
});

describe("validarCorreo y validarContrasena", () => {
  test("correo", () => {
    expect(validarCorreo("a@b.mx")).toBe(true);
    expect(validarCorreo("a@b")).toBe(false);
    expect(validarCorreo("a b@c.mx")).toBe(false);
    expect(validarCorreo(undefined)).toBe(false);
  });
  test("contraseña de 8 o más caracteres", () => {
    expect(validarContrasena("12345678")).toBe(true);
    expect(validarContrasena("1234567")).toBe(false);
  });
});

describe("validarImagen", () => {
  test("acepta jpeg, png y webp dentro del límite", () => {
    expect(validarImagen({ type: "image/webp", size: MAX_IMAGEN_BYTES }).valido).toBe(true);
  });
  test("rechaza SVG y otros tipos", () => {
    const resultado = validarImagen({ type: "image/svg+xml", size: 100 });
    expect(resultado.valido).toBe(false);
    expect(resultado.error).toMatch(/JPG, PNG o WebP/);
  });
  test("rechaza archivos de más de 5 MB", () => {
    expect(validarImagen({ type: "image/png", size: MAX_IMAGEN_BYTES + 1 }).valido).toBe(false);
  });
});

describe("validarCalificacion y validarCoordenadas", () => {
  test("calificación entera de 1 a 5", () => {
    expect([1, 5].every(validarCalificacion)).toBe(true);
    expect([0, 6, 3.5, "4", null].some(validarCalificacion)).toBe(false);
  });
  test("coordenadas", () => {
    expect(validarCoordenadas(20.9674, -89.5926)).toBe(true);
    expect(validarCoordenadas(91, 0)).toBe(false);
    expect(validarCoordenadas(Number.NaN, 0)).toBe(false);
    expect(validarCoordenadas("20", "-89")).toBe(false);
  });
});
