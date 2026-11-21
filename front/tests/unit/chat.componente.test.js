// Componente de chat reutilizable contra el api simulado (CU-03).
import { crearChat } from "../../js/features/chat/componente.js";
import * as chat from "../../../apis/api-mixanab/chat/api.mock.js";
import * as solicitudes from "../../../apis/api-mixanab/requests/api.mock.js";
import { ID_TALLER_SIMULADO, UID_CLIENTE, reiniciarSimulacion } from "../../../apis/api-mixanab/requests/simulacion.js";

const esperar = () => new Promise((resolver) => setTimeout(resolver, 0));

async function solicitudEnviada() {
  const borrador = await solicitudes.createRequestDraft({ workshop_id: ID_TALLER_SIMULADO, service_type: "repair", description: "Suela despegada" });
  await solicitudes.addRequestPhoto(borrador.id, { type: "image/png", size: 100 });
  await solicitudes.submitRequest(borrador.id);
  return borrador.id;
}

beforeEach(() => {
  reiniciarSimulacion();
  globalThis.requestAnimationFrame ??= (fn) => setTimeout(fn, 0);
});

describe("crearChat", () => {
  test("pinta el historial, envía mensajes y escapa el texto", async () => {
    const id = await solicitudEnviada();
    const { elemento, destruir } = crearChat({ requestId: id, esPropio: (m) => m.sender_id === UID_CLIENTE });
    document.body.append(elemento);
    await esperar();
    expect(elemento.querySelector(".chat__sistema")?.textContent).toBe("Solicitud enviada");

    const entrada = /** @type {HTMLTextAreaElement} */ (elemento.querySelector("textarea"));
    entrada.value = "<img src=x onerror=alert(1)> hola";
    elemento.querySelector("form")?.dispatchEvent(new Event("submit", { cancelable: true }));
    await esperar();
    await esperar();

    const propios = elemento.querySelectorAll(".chat__mensaje--propio");
    expect(propios).toHaveLength(1);
    expect(propios[0].querySelector(".chat__texto")?.textContent).toBe("<img src=x onerror=alert(1)> hola");
    expect(elemento.querySelector("img")).toBeNull();
    expect(entrada.value).toBe("");
    destruir();
    elemento.remove();
  });

  test("recibe mensajes en tiempo real sin duplicarlos", async () => {
    const id = await solicitudEnviada();
    const { elemento, destruir } = crearChat({ requestId: id, esPropio: (m) => m.sender_id === UID_CLIENTE });
    await esperar();
    await esperar();
    await chat.sendMessage(id, "Desde otra pestaña");
    await esperar();
    const textos = [...elemento.querySelectorAll(".chat__texto")].map((n) => n.textContent);
    expect(textos).toEqual(["Desde otra pestaña"]);
    destruir();
    // Tras destruir ya no escucha.
    await chat.sendMessage(id, "Ya no llega");
    await esperar();
    expect(elemento.querySelectorAll(".chat__texto")).toHaveLength(1);
  });

  test("oculta el formulario si la solicitud no admite mensajes", async () => {
    const id = await solicitudEnviada();
    const { elemento, permitirEscritura, destruir } = crearChat({ requestId: id, esPropio: () => false, puedeEscribir: false });
    expect(/** @type {HTMLFormElement} */ (elemento.querySelector("form")).hidden).toBe(true);
    permitirEscritura(true);
    expect(/** @type {HTMLFormElement} */ (elemento.querySelector("form")).hidden).toBe(false);
    destruir();
  });

  test("usa crearTarjeta para los mensajes de presupuesto", async () => {
    const id = await solicitudEnviada();
    const { fijarSesionSimulada } = await import("../../../apis/api-mixanab/requests/simulacion.js");
    const { sendQuote } = await import("../../../apis/api-mixanab/quotes/api.mock.js");
    fijarSesionSimulada({ rol: "craftsman" });
    const hoy = new Date();
    const fecha = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}-${String(hoy.getDate()).padStart(2, "0")}`;
    await sendQuote(id, { amount_mxn: 450, delivery_date: fecha });
    fijarSesionSimulada({ rol: "client" });
    const { elemento, destruir } = crearChat({
      requestId: id,
      esPropio: (m) => m.sender_id === UID_CLIENTE,
      crearTarjeta: (m) => {
        const div = document.createElement("div");
        div.className = "tarjeta-prueba";
        div.textContent = String(m.quote_id);
        return div;
      },
    });
    await esperar();
    await esperar();
    expect(elemento.querySelector(".tarjeta-prueba")).not.toBeNull();
    destruir();
  });
});
