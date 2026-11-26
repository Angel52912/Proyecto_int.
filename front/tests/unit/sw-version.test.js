import { archivosFaltantes, calcularVersion, versionEscrita } from "../../scripts/version-cache.mjs";

describe("service worker", () => {
  test("todos los archivos de la interfaz están en INTERFAZ (si no, no funcionan sin red)", () => {
    expect(archivosFaltantes()).toEqual([]);
  });

  test("CACHE_VERSION corresponde al contenido actual de la interfaz (corre `npm run cache:version`)", () => {
    expect(versionEscrita()).toBe(calcularVersion());
  });
});
