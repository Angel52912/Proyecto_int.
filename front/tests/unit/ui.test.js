import { createRequire } from "node:module";
import { diasHasta, formatearFecha, formatearHace, formatearHora } from "../../js/lib/fechas.js";
import { ApiError } from "../../../apis/lib/apiError.js";
import { crear, enlace } from "../../js/ui/dom.js";
import { cargarEn, crearError, crearEsqueleto, crearVacio } from "../../js/ui/estados.js";
import { crearFoto } from "../../js/ui/foto.js";
import { crearEstrellas, crearPantalla, crearProgreso, iniciales } from "../../js/ui/layout.js";
import { mensajeDeError } from "../../js/ui/mensajes.js";
import { crearQr, matrizQr } from "../../js/ui/qr.js";

describe("dom", () => {
  test("crear asigna texto con textContent y no interpreta HTML", () => {
    const p = crear("p", { clase: "x", texto: "<b>hola</b>" });
    expect(p.textContent).toBe("<b>hola</b>");
    expect(p.querySelector("b")).toBeNull();
    expect(p.className).toBe("x");
  });
  test("crear omite atributos falsos e hijos vacíos", () => {
    const div = crear("div", { attrs: { hidden: false, title: null, "aria-label": "a" } }, [null, "t", false, undefined]);
    expect(div.hasAttribute("hidden")).toBe(false);
    expect(div.hasAttribute("title")).toBe(false);
    expect(div.textContent).toBe("t");
  });
  test("enlace usa el router por hash", () => {
    expect(enlace("/pedido/1").getAttribute("href")).toBe("#/pedido/1");
  });
});

describe("mensajes", () => {
  test("traduce códigos y permite precisarlos", () => {
    expect(mensajeDeError(new ApiError("limit_reached"))).toMatch(/límite/);
    expect(mensajeDeError(new ApiError("invalid_state"), { invalid_state: "Otro" })).toBe("Otro");
    expect(mensajeDeError(new Error("x"))).toMatch(/Algo salió mal/);
  });
});

describe("estados", () => {
  test("cargarEn pinta el resultado y omite entradas vacías", async () => {
    const destino = document.createElement("div");
    await cargarEn(destino, async () => "ok", (v) => [crear("p", { texto: v }), null]);
    expect(destino.textContent).toBe("ok");
    expect(destino.textContent).not.toContain("null");
  });
  test("cargarEn muestra el error con Reintentar", async () => {
    const destino = document.createElement("div");
    let intentos = 0;
    await cargarEn(
      destino,
      async () => {
        intentos += 1;
        throw new ApiError("not_found");
      },
      () => crear("p"),
      { not_found: "No está" },
    );
    expect(destino.textContent).toContain("No está");
    destino.querySelector("button")?.click();
    await Promise.resolve();
    expect(intentos).toBe(2);
  });
  test("vacío y error tienen roles accesibles", () => {
    expect(crearError("x").getAttribute("role")).toBe("alert");
    expect(crearVacio("nada").textContent).toBe("nada");
  });
});

describe("layout", () => {
  test("pantalla con navegación marca la pestaña activa", () => {
    const pantalla = crearPantalla({ rol: "client", activa: "pedidos", titulo: "T", volver: "/inicio" }, [crear("p")]);
    expect(pantalla.querySelector("h1")?.textContent).toBe("T");
    expect(pantalla.querySelector('[aria-current="page"]')?.getAttribute("href")).toBe("#/pedidos");
    expect(pantalla.querySelectorAll(".nav-inferior a")).toHaveLength(4);
  });
  test("navegación del artesano", () => {
    const pantalla = crearPantalla({ rol: "craftsman", activa: "tablero" }, []);
    expect(pantalla.querySelector('[aria-current="page"]')?.getAttribute("href")).toBe("#/artesano/tablero");
  });
  test("progreso, estrellas e iniciales", () => {
    expect(crearProgreso(0.75, "x").getAttribute("aria-valuenow")).toBe("75");
    expect(crearProgreso(3, "x").getAttribute("aria-valuenow")).toBe("100");
    expect(crearEstrellas(4).getAttribute("aria-label")).toBe("4 de 5 estrellas");
    expect(crearEstrellas(null).getAttribute("aria-label")).toBe("Sin calificaciones");
    expect(iniciales("José Cámara Pérez")).toBe("JC");
    expect(iniciales("")).toBe("?");
    expect(iniciales("Limpieza de Tenis Itzimná")).toBe("LT");
    expect(iniciales("José de la Cruz")).toBe("JC");
    expect(iniciales("De")).toBe("D");
  });
  test("foto sin URL muestra respaldo", () => {
    expect(crearFoto(null, "x").classList.contains("foto--vacia")).toBe(true);
    expect(crearFoto("https://a/b.png", "alt").getAttribute("alt")).toBe("alt");
  });
  test("foto sin URL con nombre muestra iniciales y etiqueta accesible", () => {
    const foto = crearFoto(null, "Foto de Taller Sol", "extra", "Taller Sol");
    expect(foto.classList.contains("foto--inicial")).toBe(true);
    expect(foto.classList.contains("extra")).toBe(true);
    expect(foto.textContent).toBe("TS");
    expect(foto.getAttribute("aria-label")).toBe("Sin foto de Taller Sol");
  });
  test("foto que no carga cae al respaldo con iniciales", () => {
    const padre = document.createElement("div");
    const imagen = crearFoto("https://a/rota.png", "alt", undefined, "Zapatería Montejo");
    padre.append(imagen);
    imagen.dispatchEvent(new Event("error"));
    expect(padre.querySelector(".foto--inicial")?.textContent).toBe("ZM");
  });
});

describe("esqueleto y vacío", () => {
  test("el esqueleto anuncia la carga solo a lectores de pantalla", () => {
    const esqueleto = crearEsqueleto(2);
    expect(esqueleto.getAttribute("role")).toBe("status");
    expect(esqueleto.textContent).toBe("Cargando…");
    expect(esqueleto.querySelectorAll(".esqueleto__tarjeta")).toHaveLength(2);
  });
  test("el vacío lleva ícono decorativo en círculo y la acción", () => {
    const vacio = crearVacio("nada", crear("a", { texto: "Ir" }), { icono: "pedidos" });
    expect(vacio.querySelector(".estado-vacio__icono")?.getAttribute("aria-hidden")).toBe("true");
    expect(vacio.textContent).toBe("nadaIr");
  });
});

describe("fechas", () => {
  const ahora = new Date(2026, 10, 14, 12, 0);
  test("fecha corta y hora", () => {
    expect(formatearFecha("2026-11-18", ahora)).toBe("18 nov");
    expect(formatearFecha("2027-01-02", ahora)).toBe("2 ene 2027");
    expect(formatearHora(new Date(2026, 10, 14, 9, 5))).toBe("09:05");
  });
  test("días hasta una fecha sin desfase de zona", () => {
    expect(diasHasta("2026-11-19", ahora)).toBe(5);
    expect(diasHasta("2026-11-14", ahora)).toBe(0);
  });
  test("hace cuánto", () => {
    expect(formatearHace(new Date(2026, 10, 14, 11, 50), ahora)).toBe("Hace 10 min");
    expect(formatearHace(new Date(2026, 10, 14, 9, 0), ahora)).toBe("Hace 3 h");
    expect(formatearHace(new Date(2026, 10, 13, 9, 0), ahora)).toBe("Ayer");
  });
});

describe("qr", () => {
  test("sin la librería devuelve null", () => {
    delete globalThis.qrcode;
    expect(crearQr("x", "QR")).toBeNull();
  });
  test("con la librería dibuja un SVG cuadrado con zona silenciosa", () => {
    const require = createRequire(import.meta.url);
    globalThis.qrcode = require("qrcode-generator");
    const texto = "00000000-0000-4000-8000-000000000011:123456";
    const matriz = /** @type {boolean[][]} */ (matrizQr(texto));
    expect(matriz.length).toBeGreaterThanOrEqual(21);
    expect(matriz.every((fila) => fila.length === matriz.length)).toBe(true);
    // Patrón de posición en la esquina superior izquierda.
    expect(matriz[0].slice(0, 7).every(Boolean)).toBe(true);
    const svg = /** @type {SVGSVGElement} */ (crearQr(texto, "QR de entrega"));
    expect(svg.getAttribute("viewBox")).toBe(`0 0 ${matriz.length + 8} ${matriz.length + 8}`);
    expect(svg.getAttribute("aria-label")).toBe("QR de entrega");
    delete globalThis.qrcode;
  });
});
