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
  test("al cambiar de pantalla enfoca el h1 (no en la primera) y vuelve arriba", async () => {
    const contenedor = /** @type {HTMLElement} */ (document.getElementById("app"));
    const vista = (/** @type {string} */ titulo) => () => {
      const div = document.createElement("div");
      const h1 = document.createElement("h1");
      h1.textContent = titulo;
      div.append(h1);
      return div;
    };
    window.location.hash = "#/uno";
    const router = crearRouter({ rutas: [{ path: "/uno", render: vista("Uno") }, { path: "/dos", render: vista("Dos") }], contenedor, obtenerSesion: async () => null });
    await router.iniciar();
    expect(document.activeElement).toBe(document.body);
    document.documentElement.scrollTop = 300;
    window.location.hash = "#/dos";
    await new Promise((r) => setTimeout(r, 20));
    const h1 = contenedor.querySelector("h1");
    expect(h1?.textContent).toBe("Dos");
    expect(document.activeElement).toBe(h1);
    expect(h1?.getAttribute("tabindex")).toBe("-1");
    expect(document.documentElement.scrollTop).toBe(0);
  });
  test("marca si se avanza o se regresa a la pantalla anterior", async () => {
    const contenedor = /** @type {HTMLElement} */ (document.getElementById("app"));
    const vista = () => document.createElement("div");
    window.location.hash = "#/lista";
    const router = crearRouter({ rutas: [{ path: "/lista", render: vista }, { path: "/detalle", render: vista }], contenedor, obtenerSesion: async () => null });
    await router.iniciar();
    window.location.hash = "#/detalle";
    await new Promise((r) => setTimeout(r, 20));
    expect(document.documentElement.dataset.navegacion).toBe("adelante");
    window.location.hash = "#/lista";
    await new Promise((r) => setTimeout(r, 20));
    expect(document.documentElement.dataset.navegacion).toBe("atras");
  });
});
