import { renderPortada } from "../../js/features/auth/pages/portada.js";
import { rutas } from "../../js/features/auth/routes.js";
import { instalarAlternadorVista } from "../../js/ui/vista.js";
import { fijarSesionSimulada, reiniciarSimulacion } from "../../../apis/api-mixanab/requests/simulacion.js";

describe("portada pública y adaptación PC", () => {
  afterEach(() => {
    document.querySelector(".alternador-vista")?.remove();
    delete document.documentElement.dataset.vista;
    localStorage.clear();
    reiniciarSimulacion();
  });

  test("muestra marca, eslogan, inicio de sesión y acceso simulado", () => {
    const pantalla = /** @type {HTMLElement} */ (renderPortada());
    expect(pantalla.classList.contains("portada")).toBe(true);
    expect(pantalla.querySelector(".acceso__marca")?.textContent).toContain("MiXanab");
    expect(pantalla.querySelector(".portada__eslogan")?.textContent).toBe("No lo tires, restáuralo.");
    const enlaces = [...pantalla.querySelectorAll("a")];
    expect(enlaces).toHaveLength(2);
    expect(enlaces[0].getAttribute("href")).toBe("#/acceso");
    expect(enlaces[0].textContent).toBe("Iniciar sesión");
    expect(enlaces[1].getAttribute("href")).toBe("#/simulacion");
    expect(enlaces[1].classList.contains("portada__simulado")).toBe(true);
  });

  test("las rutas de inicio son públicas", () => {
    for (const ruta of ["/", "/inicio"]) {
      expect(rutas.find((r) => r.path === ruta)).toMatchObject({ render: renderPortada });
      expect(rutas.find((r) => r.path === ruta)?.requiereSesion).toBeUndefined();
    }
  });

  test("el alternador aparece solo para admin y cambia la vista", async () => {
    await instalarAlternadorVista();
    expect(document.querySelector(".alternador-vista")).toBeNull();

    fijarSesionSimulada({ sesion: true, rol: "admin" });
    await instalarAlternadorVista();
    const boton = /** @type {HTMLButtonElement} */ (document.querySelector(".alternador-vista"));
    expect(boton).not.toBeNull();
    expect(boton.textContent).toContain("Vista Android");

    boton.click();
    expect(document.documentElement.dataset.vista).toBe("pc");
    expect(boton.textContent).toContain("Vista Android");

    boton.click();
    expect(document.documentElement.dataset.vista).toBe("movil");
    expect(boton.textContent).toContain("Vista PC");
  });
});
