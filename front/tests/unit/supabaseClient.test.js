import { jest } from "@jest/globals";
import { crearCliente } from "../../js/supabaseClient.js";

describe("crearCliente", () => {
  test("falla si supabase-js no está cargado", () => {
    expect(() => crearCliente(undefined, "https://x.supabase.co", "clave")).toThrow(/no está cargado/);
  });

  test("falla con la configuración de ejemplo", () => {
    const fabrica = jest.fn();
    expect(() => crearCliente(fabrica, "https://REEMPLAZAR.supabase.co", "REEMPLAZAR")).toThrow(/js\/config\.js/);
    expect(fabrica).not.toHaveBeenCalled();
  });

  test("usa PKCE y sesión persistente", () => {
    const fabrica = jest.fn(() => ({}));
    crearCliente(fabrica, "https://abc.supabase.co", "anon");
    expect(fabrica).toHaveBeenCalledWith(
      "https://abc.supabase.co",
      "anon",
      expect.objectContaining({ auth: expect.objectContaining({ flowType: "pkce", persistSession: true }) }),
    );
  });
});
