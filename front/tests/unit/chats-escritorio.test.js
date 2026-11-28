// Chats en PC (chat/pages/chats.js): lista de conversaciones a la izquierda y la conversación abierta a la derecha.
import { jest } from "@jest/globals";

jest.unstable_mockModule("../../../apis/supabaseClient.js", () => ({ obtenerCliente: () => ({}), obtenerSesion: async () => null }));

const { crearChatsEnDosPaneles, enEscritorio, renderChats } = await import("../../js/features/chat/pages/chats.js");

afterEach(() => {
  document.documentElement.removeAttribute("data-escritorio");
});

test("en PC la lista queda a la izquierda y lo abierto a la derecha", () => {
  const derecha = document.createElement("section");
  derecha.className = "conversacion-abierta";
  const pantalla = crearChatsEnDosPaneles("client", "s1", derecha);
  const paneles = pantalla.querySelector(".chats__paneles");
  expect(paneles?.children[0].matches("aside.chats__lista")).toBe(true);
  expect(paneles?.children[1]).toBe(derecha);
  expect(pantalla.querySelector('.nav-inferior [aria-current="page"]')?.getAttribute("href")).toBe("#/chats");
});

test("la pantalla Chats usa dos paneles solo en PC", async () => {
  expect(enEscritorio()).toBe(false);
  expect((/** @type {HTMLElement} */ (await renderChats("client")())).querySelector(".chats__paneles")).toBeNull();
  document.documentElement.setAttribute("data-escritorio", "");
  const enPc = /** @type {HTMLElement} */ (await renderChats("client")());
  expect(enPc.querySelector(".chats__paneles")).not.toBeNull();
  expect(enPc.querySelector(".chats__elige")?.textContent).toContain("Elige una conversación");
});
