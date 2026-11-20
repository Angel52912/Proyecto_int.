import { analizarHash, compilarRuta, crearRouter, resolverRuta } from "../../js/router.js";

describe("analizarHash", () => {
  test("hash vacío es la raíz", () => {
    expect(analizarHash("").ruta).toBe("/");
    expect(analizarHash("#").ruta).toBe("/");
  });
  test("separa ruta y consulta", () => {
    const { ruta, consulta } = analizarHash("#/mapa?tipo=repair");
    expect(ruta).toBe("/mapa");
    expect(consulta.get("tipo")).toBe("repair");
  });
});

describe("compilarRuta y resolverRuta", () => {
  const rutas = [
    { path: "/", render: () => document.createElement("div") },
    { path: "/pedido/:id", render: () => document.createElement("div") },
  ];
  test("extrae parámetros", () => {
    expect(compilarRuta("/pedido/:id").claves).toEqual(["id"]);
    expect(resolverRuta(rutas, "/pedido/abc%20d")?.params).toEqual({ id: "abc d" });
  });
  test("no coincide con rutas desconocidas ni segmentos extra", () => {
    expect(resolverRuta(rutas, "/nada")).toBeNull();
    expect(resolverRuta(rutas, "/pedido/1/extra")).toBeNull();
  });
  test("escapa caracteres especiales del patrón", () => {
    expect(resolverRuta([{ path: "/a.b", render: () => document.createElement("div") }], "/axb")).toBeNull();
  });
});

describe("crearRouter", () => {
  beforeEach(() => {
    document.body.innerHTML = '<main id="app"></main>';
    window.location.hash = "";
  });

  test("redirige a /acceso si la ruta requiere sesión y no hay", async () => {
    const contenedor = /** @type {HTMLElement} */ (document.getElementById("app"));
    window.location.hash = "#/mapa";
    const router = crearRouter({
      rutas: [{ path: "/mapa", requiereSesion: true, render: () => document.createElement("div") }],
      contenedor,
      obtenerSesion: async () => null,
    });
    await router.iniciar();
    expect(window.location.hash).toBe("#/acceso");
    expect(contenedor.children).toHaveLength(0);
  });

  test("renderiza con sesión y muestra error si render falla", async () => {
    const contenedor = /** @type {HTMLElement} */ (document.getElementById("app"));
    window.location.hash = "#/mapa";
    const ok = crearRouter({
      rutas: [
        {
          path: "/mapa",
          requiereSesion: true,
          render: () => {
            const nodo = document.createElement("p");
            nodo.textContent = "<b>mapa</b>";
            return nodo;
          },
        },
      ],
      contenedor,
      obtenerSesion: async () => ({}),
    });
    await ok.iniciar();
    expect(contenedor.textContent).toBe("<b>mapa</b>");
    expect(contenedor.querySelector("b")).toBeNull();

    window.location.hash = "#/falla";
    const mal = crearRouter({
      rutas: [
        {
          path: "/falla",
          render: () => {
            throw new Error("x");
          },
        },
      ],
      contenedor,
      obtenerSesion: async () => null,
    });
    await mal.iniciar();
    expect(contenedor.textContent).toBe("Algo salió mal. Intenta de nuevo.");
  });
});
