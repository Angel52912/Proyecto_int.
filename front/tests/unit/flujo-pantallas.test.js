// Prueba de punta a punta por las pantallas: monta el router real de la app sobre la API simulada y
// recorre un pedido completo como lo haría una persona (llenar formularios, adjuntar fotos, tocar botones).
// Corre en jsdom con `npm test`: no necesita navegador, Supabase ni dependencias nuevas.
import { jest } from "@jest/globals";

jest.unstable_mockModule("../../../apis/supabaseClient.js", () => ({ obtenerCliente: () => ({}), obtenerSesion: async () => null }));

const { crearRouter } = await import("../../js/router.js");
const { rutas: rutasAuth } = await import("../../js/features/auth/routes.js");
const { rutas: rutasMapa } = await import("../../js/features/map/routes.js");
const { rutas: rutasSolicitudes } = await import("../../js/features/requests/routes.js");
const { rutas: rutasChat } = await import("../../js/features/chat/routes.js");
const { rutas: rutasPresupuestos } = await import("../../js/features/quotes/routes.js");
const { rutas: rutasPedidos } = await import("../../js/features/orders/routes.js");
const { rutas: rutasTaller } = await import("../../js/features/workshop/routes.js");
const sim = await import("../../../apis/api-mixanab/requests/simulacion.js");
const pedidos = await import("../../../apis/api-mixanab/orders/api.mock.js");
const { fechaDeHoy } = await import("../../../apis/api-mixanab/quotes/validar.js");

const esperar = (ms = 0) => new Promise((resolver) => setTimeout(resolver, ms));
/** @returns {HTMLElement} */
const app = () => /** @type {HTMLElement} */ (document.getElementById("app"));
const texto = () => app().textContent ?? "";
/** Último aviso flotante (se apilan mientras siguen visibles). */
const ultimoAviso = () => [...document.querySelectorAll(".aviso-flotante")].at(-1)?.textContent ?? "";

/** Va a una ruta y espera a que la pantalla termine de cargar (la API simulada responde al instante). */
async function ir(ruta) {
  window.location.hash = `#${ruta}`;
  await esperar(30);
}

/** Espera a que el hash cambie a una ruta que empiece así (la pantalla navega sola tras guardar). */
async function esperarRuta(prefijo) {
  for (let i = 0; i < 50 && !window.location.hash.startsWith(`#${prefijo}`); i += 1) await esperar(10);
  expect(window.location.hash.startsWith(`#${prefijo}`)).toBe(true);
  await esperar(30);
  return window.location.hash.slice(1);
}

/** @param {string} selector @returns {HTMLElement} */
function elemento(selector) {
  const nodo = /** @type {HTMLElement | null} */ (app().querySelector(selector));
  if (nodo === null) throw new Error(`No está en pantalla: ${selector}\n${texto().slice(0, 300)}`);
  return nodo;
}

/** @param {string} etiqueta texto del botón */
function boton(etiqueta) {
  const encontrado = [...app().querySelectorAll("button")].find((b) => b.textContent?.trim() === etiqueta);
  if (!encontrado) throw new Error(`No hay botón "${etiqueta}"`);
  return encontrado;
}

/** @param {string} selector @param {string} valor */
function escribir(selector, valor) {
  const control = /** @type {HTMLInputElement} */ (elemento(selector));
  control.value = valor;
  control.dispatchEvent(new Event("input", { bubbles: true }));
  control.dispatchEvent(new Event("change", { bubbles: true }));
}

/** Adjunta una foto JPEG a un `input type="file"`. */
function adjuntarFoto(selector) {
  const entrada = /** @type {HTMLInputElement} */ (elemento(selector));
  const foto = new File([new Uint8Array(2048)], "calzado.jpg", { type: "image/jpeg" });
  Object.defineProperty(entrada, "files", { configurable: true, value: [foto] });
  entrada.dispatchEvent(new Event("change", { bubbles: true }));
}

/** @param {string} selector */
async function enviarFormulario(selector) {
  elemento(selector).dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  await esperar(30);
}

const comoCliente = () => sim.fijarSesionSimulada({ sesion: true, rol: "client", activo: true });
const comoArtesano = () => sim.fijarSesionSimulada({ sesion: true, rol: "craftsman", activo: true });

beforeAll(async () => {
  sim.reiniciarSimulacion();
  document.body.innerHTML = '<main id="app"></main>';
  // jsdom no implementa vistas previas de archivos ni diálogos: se simulan.
  URL.createObjectURL = () => "blob:vista-previa";
  URL.revokeObjectURL = () => {};
  window.confirm = () => true;
  window.scrollTo = () => {};
  window.location.hash = "#/principal";
  const rutas = [...rutasAuth, ...rutasMapa, ...rutasSolicitudes, ...rutasChat, ...rutasPresupuestos, ...rutasPedidos, ...rutasTaller];
  await crearRouter({ rutas, contenedor: app(), obtenerSesion: async () => null }).iniciar();
});

test("pedido completo por las pantallas: solicitud → chat → presupuesto → fases → entrega → calificación", async () => {
  // 1) Cliente: solicita una cotización con foto y descripción.
  comoCliente();
  await ir(`/solicitar/${sim.ID_TALLER_SIMULADO}`);
  adjuntarFoto("#fotos-calzado");
  escribir("#descripcion", "La suela izquierda está despegada y el cuero tiene manchas de agua.");
  await enviarFormulario(".solicitar__formulario");
  const chatCliente = await esperarRuta("/chat/");
  const solicitudId = chatCliente.split("/")[2];
  expect(ultimoAviso()).toContain("Solicitud enviada");

  // 2) Artesano: abre la solicitud y envía el presupuesto.
  comoArtesano();
  await ir(`/artesano/solicitud/${solicitudId}`);
  expect(texto()).toContain("La suela izquierda está despegada");
  escribir("#monto", "450");
  escribir("#fecha", fechaDeHoy(new Date(Date.now() + 5 * 86_400_000)));
  escribir("#detalle", "Cambio de suela de cuero y limpieza con nutrición.");
  await enviarFormulario(".enviar-presupuesto__formulario");
  await esperarRuta(`/artesano/chat/${solicitudId}`);

  // 3) Cliente: ve la tarjeta del presupuesto en el chat, la abre y acepta.
  comoCliente();
  await ir(`/chat/${solicitudId}`);
  const enlacePresupuesto = /** @type {HTMLAnchorElement} */ (elemento('a[href^="#/presupuesto/"]'));
  await ir(enlacePresupuesto.getAttribute("href")?.slice(1) ?? "");
  expect(texto()).toContain("$450");
  boton("Aceptar").click();
  const seguimiento = await esperarRuta("/pedido/");
  const pedidoId = seguimiento.split("/")[2];
  expect((await pedidos.getOrder(pedidoId)).phase).toBe(1);

  // 4) Artesano: avanza las fases 2, 3 y 4 con foto de avance y marca el pedido listo.
  comoArtesano();
  for (const fase of [2, 3, 4]) {
    await ir(`/artesano/pedido/${pedidoId}`);
    adjuntarFoto("#foto-avance");
    await enviarFormulario(".actualizar-fase__campos");
    expect((await pedidos.getOrder(pedidoId)).phase).toBe(fase);
  }
  expect(ultimoAviso()).toContain("Fase actualizada");
  boton("Marcar listo para entrega").click();
  await esperar(30);
  expect((await pedidos.getOrder(pedidoId)).status).toBe("ready");
  expect(ultimoAviso()).toContain("está listo");

  // 5) Cliente: abre Recoger pedido y lee su PIN.
  comoCliente();
  await ir(`/pedido/${pedidoId}/recoger`);
  const pin = (elemento(".recoger__pin").getAttribute("aria-label") ?? "").replace(/\D/g, "");
  expect(pin).toMatch(/^\d{6}$/);

  // 6) Artesano: confirma la entrega con el PIN.
  comoArtesano();
  await ir(`/artesano/pedido/${pedidoId}/entrega`);
  escribir("#pin", pin);
  await enviarFormulario("form");
  expect((await pedidos.getOrder(pedidoId)).status).toBe("delivered");

  // 7) Cliente: califica con 5 estrellas.
  comoCliente();
  await ir(`/pedido/${pedidoId}/calificar`);
  const cinco = /** @type {HTMLInputElement} */ (elemento("#estrella-5"));
  cinco.checked = true;
  cinco.dispatchEvent(new Event("change", { bubbles: true }));
  await enviarFormulario("form");
  expect((await pedidos.getOrderReview(pedidoId))?.rating).toBe(5);
});
