// Contadores de avisos sin leer en la barra de navegación (features/requests/insignias.js).
import { jest } from "@jest/globals";

jest.unstable_mockModule("../../../apis/supabaseClient.js", () => ({ obtenerCliente: () => ({}), obtenerSesion: async () => null }));

const { contarPorPestana, pintarContadores } = await import("../../js/features/requests/insignias.js");

test("cuenta los avisos del cliente en Pedidos y Chats, e ignora los que no tienen pestaña", () => {
  const avisos = [{ type: "quote_received" }, { type: "order_created" }, { type: "order_ready" }, { type: "desconocido" }];
  expect(contarPorPestana("client", avisos)).toEqual({ chats: 1, pedidos: 2 });
});

test("cuenta los avisos del artesano en Solicitudes, Tablero y Perfil", () => {
  const avisos = [{ type: "request_received" }, { type: "quote_accepted" }, { type: "review_received" }, { type: "order_created" }];
  expect(contarPorPestana("craftsman", avisos)).toEqual({ solicitudes: 1, tablero: 1, perfil: 1 });
});

test("pinta el contador en la pestaña y lo quita cuando llega a cero", () => {
  document.body.innerHTML = '<nav class="nav-inferior"><a class="nav-inferior__enlace" data-pestana="pedidos">Pedidos</a><a class="nav-inferior__enlace" data-pestana="chats">Chats</a></nav>';
  pintarContadores({ pedidos: 2 });
  const pedidos = /** @type {HTMLElement} */ (document.querySelector('[data-pestana="pedidos"]'));
  expect(pedidos.querySelector(".nav-inferior__contador")?.textContent).toBe("2, 2 sin leer");
  expect(document.querySelector('[data-pestana="chats"] .nav-inferior__contador')).toBeNull();
  pintarContadores({});
  expect(pedidos.querySelector(".nav-inferior__contador")).toBeNull();
});
