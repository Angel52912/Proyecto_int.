import { guardarFotoSimulada, urlFotoSimulada } from "../../../apis/lib/fotoSimulada.js";

describe("fotos del modo simulado", () => {
  test("la ilustración es data: (la CSP la permite) e incluye carpeta/path", () => {
    const url = urlFotoSimulada("request-photos", "abc/123");
    expect(url.startsWith("data:image/svg+xml")).toBe(true);
    expect(url).toContain("request-photos/abc/123");
    expect(url).not.toMatch(/^https?:/);
  });

  test("una foto subida de verdad se muestra tal cual con su URL local", () => {
    const original = URL.createObjectURL;
    URL.createObjectURL = () => "blob:foto-subida";
    try {
      guardarFotoSimulada("taller/foto-1", new Blob(["x"], { type: "image/png" }));
      expect(urlFotoSimulada("workshop-photos", "taller/foto-1")).toBe("blob:foto-subida");
    } finally {
      URL.createObjectURL = original;
    }
  });

  test("sin archivo real (pruebas) sigue la ilustración", () => {
    guardarFotoSimulada("x/sin-archivo", { type: "image/jpeg", size: 10 });
    expect(urlFotoSimulada("avatars", "x/sin-archivo")).toContain("avatars/x/sin-archivo");
  });
});
