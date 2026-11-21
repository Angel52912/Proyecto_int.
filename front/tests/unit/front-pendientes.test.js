// Pendientes del frontend: avisos, fotos de perfil, Mi taller con datos del servidor y panel de administración.
import * as adminMock from "../../../apis/api-mixanab/admin/api.mock.js";
import { NOMBRE_ACCION, textoConteo } from "../../js/features/admin/componentes.js";
import { textoDeAccion } from "../../js/features/admin/pages/bitacora.js";
import { renderPanel } from "../../js/features/admin/pages/panel.js";
import { textoPromedioNuevo } from "../../js/features/admin/pages/resenas.js";
import { estadoDelTaller } from "../../js/features/admin/pages/talleres.js";
import { renderUsuarios } from "../../js/features/admin/pages/usuarios.js";
import { crearAvatar, olvidarAvatares, urlDeAvatar } from "../../js/features/auth/avatar.js";
import { crearCampana, textoContador, textoDelAviso } from "../../js/features/requests/avisos.js";
import { renderAvisos } from "../../js/features/requests/pages/avisos.js";
import { fijarSesionSimulada, notificar, reiniciarSimulacion, UID_CLIENTE } from "../../../apis/api-mixanab/requests/simulacion.js";
import * as tallerMock from "../../../apis/api-mixanab/workshop/api.mock.js";
import { renderMiTaller } from "../../js/features/workshop/pages/mi-taller.js";

const esperar = (ms = 0) => new Promise((resolver) => setTimeout(resolver, ms));

beforeEach(() => {
  reiniciarSimulacion();
  window.location.hash = "";
});

describe("avisos", () => {
  test("texto y destino según el tipo", () => {
    expect(textoDelAviso({ type: "quote_received", payload: { quote_id: "q1" } })).toMatchObject({ titulo: "Te enviaron un presupuesto", ruta: "/presupuesto/q1" });
    expect(textoDelAviso({ type: "order_ready", payload: { order_id: "o1" } }).ruta).toBe("/pedido/o1/recoger");
    expect(textoDelAviso({ type: "order_delivered", payload: { order_id: "o1" } }).ruta).toBe("/pedido/o1/calificar");
    expect(textoDelAviso({ type: "order_phase_changed", payload: { order_id: "o1", phase: 2, corrected: false } }).detalle).toBe("Ahora está en Desinfección / pretratamiento.");
    expect(textoDelAviso({ type: "order_phase_changed", payload: { phase: 3, corrected: true } }).detalle).toMatch(/^Se corrigió la fase/);
    expect(textoDelAviso({ type: "request_received", payload: { request_id: "r1" } }).ruta).toBe("/artesano/chat/r1");
    expect(textoDelAviso({ type: "review_received", payload: { rating: 1 } }).detalle).toBe("Te calificaron con 1 estrella.");
    expect(textoDelAviso({ type: "workshop_suspended", payload: {} }).ruta).toBe("/artesano/taller");
    expect(textoDelAviso({ type: "desconocido", payload: {} })).toMatchObject({ titulo: "Aviso", ruta: null });
  });

  test("contador de la campana", () => {
    expect(textoContador(0)).toBe("");
    expect(textoContador(3)).toBe("3");
    expect(textoContador(12)).toBe("9+");
  });

  test("la campana cuenta los no leídos y suma los que llegan en vivo", async () => {
    notificar(UID_CLIENTE, "order_ready", { order_id: "o1", request_id: "r1" });
    const campana = crearCampana("client");
    await esperar();
    expect(campana.getAttribute("href")).toBe("#/avisos");
    expect(campana.querySelector(".contador-avisos")?.textContent).toBe("1");
    notificar(UID_CLIENTE, "order_delivered", { order_id: "o1", request_id: "r1" });
    await esperar();
    expect(campana.getAttribute("aria-label")).toBe("Avisos, 2 sin leer");
  });

  test("la pantalla lista los avisos y marca todos como leídos", async () => {
    notificar(UID_CLIENTE, "quote_received", { request_id: "r1", quote_id: "q1" });
    notificar(UID_CLIENTE, "order_created", { request_id: "r1", order_id: "o1" });
    const pantalla = /** @type {HTMLElement} */ (renderAvisos("client")());
    await esperar();
    const titulos = [...pantalla.querySelectorAll(".aviso-fila__titulo")].map((n) => n.textContent);
    expect(titulos).toEqual(["Pedido confirmado", "Te enviaron un presupuesto"]);
    expect(pantalla.querySelectorAll(".aviso-fila--nueva")).toHaveLength(2);
    /** @type {HTMLButtonElement} */ (pantalla.querySelector(".avisos__acciones button")).click();
    await esperar();
    expect(pantalla.querySelectorAll(".aviso-fila--nueva")).toHaveLength(0);
  });
});

describe("fotos de perfil", () => {
  test("reutiliza la URL firmada mientras sigue vigente", async () => {
    const { api } = await import("../../js/features/auth/index.js");
    const { signInWithEmail, verifyEmailCode, setMyRole, addAvatar, CODIGO_SIMULADO, reiniciarSimulacion: reiniciarAuth } = await import("../../../apis/api-inicio-sesion/api.mock.js");
    reiniciarAuth();
    olvidarAvatares();
    await signInWithEmail("ana@correo.com");
    await verifyEmailCode("ana@correo.com", CODIGO_SIMULADO);
    await setMyRole("client");
    const { path } = await addAvatar({ type: "image/png", size: 100 });
    const primera = urlDeAvatar(path, 0);
    expect(urlDeAvatar(path, 1000)).toBe(primera);
    expect(urlDeAvatar(path, 60 * 60 * 1000)).not.toBe(primera);
    expect(await primera).toBe(await api.getAvatarUrl(path));
  });

  test("sin foto muestra las iniciales", () => {
    const avatar = crearAvatar({ nombre: "Ana Pérez", avatarPath: null, clase: "avatar--chico" });
    expect(avatar.textContent).toBe("AP");
    expect(avatar.className).toBe("avatar avatar--chico");
  });
});

describe("Mi taller con datos del servidor", () => {
  test("muestra cifras, distribución y reseñas anónimas", async () => {
    tallerMock.reiniciarSimulacion();
    await tallerMock.saveMyWorkshop({ name: "Taller", address: "Calle 60", colonia: "Centro", lat: 20.9, lng: -89.6, services: ["repair"], hours: { mon: [{ open: "09:00", close: "18:00" }] }, price_from: 100 });
    tallerMock.fijarDatosMiTallerSimulados({
      pedidos: [
        { status: "delivered", due_date: "2026-11-10", delivered_at: "2026-11-10T18:00:00.000Z" },
        { status: "in_progress", due_date: "2026-11-20", delivered_at: null },
      ],
      solicitudes: [],
      resenas: [
        { id: "a", rating: 5, tags: ["Puntual"], comment: "<b>Excelente</b>", created_at: "2026-11-02T18:00:00.000Z" },
        { id: "b", rating: 4, tags: [], comment: null, created_at: "2026-11-01T18:00:00.000Z" },
      ],
    });
    const pantalla = /** @type {HTMLElement} */ (await renderMiTaller());
    await esperar(10);
    const cifras = [...pantalla.querySelectorAll(".estadistica")].map((n) => n.textContent);
    expect(cifras).toEqual(["1", "100%", "1", "0"]);
    expect(pantalla.querySelector(".reputacion__promedio strong")?.textContent).toBe("4.5");
    expect(pantalla.querySelector('[aria-label="5 estrellas: 1"]')).not.toBeNull();
    expect(pantalla.querySelector(".mi-taller__contenido b")).toBeNull();
    expect(pantalla.textContent).toContain("<b>Excelente</b>");
  });
});

describe("panel de administración", () => {
  beforeEach(() => {
    adminMock.reiniciarSimulacion();
  });

  test("textos de apoyo", () => {
    expect(textoConteo(0, 0)).toBe("Sin resultados");
    expect(textoConteo(1, 1)).toBe("1 resultado");
    expect(textoConteo(20, 45)).toBe("Mostrando 20 de 45");
    expect(estadoDelTaller({ published: true, suspended: true }).texto).toBe("Suspendido");
    expect(estadoDelTaller({ published: true, suspended: false }).texto).toBe("Visible en el mapa");
    expect(estadoDelTaller({ published: false, suspended: false }).texto).toBe("Borrador");
    expect(textoPromedioNuevo({ rating_avg: null, rating_count: 0 })).toMatch(/ya no tiene/);
    expect(textoPromedioNuevo({ rating_avg: 4.25, rating_count: 1 })).toBe("Nuevo promedio del taller: 4.3 (1 reseña).");
    expect(Object.keys(NOMBRE_ACCION)).toHaveLength(6);
  });

  test("bitácora: acción, objetivo y motivo como texto", () => {
    const texto = textoDeAccion({ admin_name: "Admin", action: "workshop_suspended", target_table: "workshops", target_id: "00000000-0000-4000-8000-0000000000a1", details: { reason: "<i>quejas</i>" } });
    expect(texto).toEqual({ quien: "Admin", que: "Suspendió un taller", objetivo: "Taller #00A1", motivo: "<i>quejas</i>" });
    expect(textoDeAccion({ admin_name: null, action: "x", target_table: "t", target_id: "abcd", details: null }).motivo).toBeNull();
  });

  test("el panel muestra los totales", async () => {
    const pantalla = /** @type {HTMLElement} */ (renderPanel());
    await esperar();
    expect(pantalla.querySelectorAll(".admin-panel__seccion")).toHaveLength(4);
    expect(pantalla.querySelector('[aria-current="page"]')?.getAttribute("href")).toBe("#/admin");
  });

  test("desactiva un usuario con motivo y no deja desactivarse a sí mismo (A1)", async () => {
    const pantalla = /** @type {HTMLElement} */ (renderUsuarios());
    document.body.append(pantalla);
    await esperar();
    const fila = (/** @type {string} */ nombre) => /** @type {HTMLElement} */ ([...pantalla.querySelectorAll(".admin-fila")].find((f) => f.textContent?.includes(nombre)));
    const confirmar = async (/** @type {string} */ nombre, /** @type {string} */ motivo) => {
      const f = fila(nombre);
      /** @type {HTMLButtonElement} */ (f.querySelector(".admin-accion .boton-texto")).click();
      /** @type {HTMLTextAreaElement} */ (f.querySelector("textarea")).value = motivo;
      f.querySelector("form")?.dispatchEvent(new Event("submit", { cancelable: true }));
      await esperar();
      await esperar();
      return f;
    };
    await confirmar("Cliente Dos", "Pruebas");
    expect(fila("Cliente Dos").textContent).toContain("Desactivado");
    const propia = await confirmar("Admin Principal", "");
    expect(propia.querySelector(".admin-accion .campo__error")?.textContent).toBe("No puedes hacer esta acción.");
    const { items } = await adminMock.listActions({});
    expect(items[0]).toMatchObject({ action: "user_deactivated" });
    expect(items[0].details.reason).toBe("Pruebas");
    pantalla.remove();
  });

  test("la sesión de admin no ve las rutas de cliente (guardia)", async () => {
    const { soloPara } = await import("../../js/features/auth/guardia.js");
    fijarSesionSimulada({ rol: "admin" });
    await soloPara(["client"], () => document.createElement("section"))({ params: {}, consulta: new URLSearchParams() });
    expect(window.location.hash).toBe("#/admin");
  });
});
