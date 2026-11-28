// Mejoras de vista: cuándo abre un taller cerrado, dirección sin colonia repetida y pantallas vacías con título.
import { jest } from "@jest/globals";

jest.unstable_mockModule("../../../apis/supabaseClient.js", () => ({ obtenerCliente: () => ({}), obtenerSesion: async () => null }));

const { direccionCompleta, proximaApertura } = await import("../../js/features/map/pages/perfil-taller.js");
const { crearVacio } = await import("../../js/ui/estados.js");

// Lunes a viernes de 09:00 a 18:00 (el 23 de noviembre de 2026 es lunes).
const semana = Object.fromEntries(["mon", "tue", "wed", "thu", "fri"].map((d) => [d, [{ open: "09:00", close: "18:00" }]]));
const dia = (fecha, hora) => new Date(2026, 10, fecha, hora, 0);

test("dice cuándo vuelve a abrir un taller cerrado", () => {
  expect(proximaApertura(semana, dia(23, 7))).toBe("Abre hoy a las 09:00");
  expect(proximaApertura(semana, dia(23, 20))).toBe("Abre mañana a las 09:00");
  expect(proximaApertura(semana, dia(28, 12))).toBe("Abre el lunes a las 09:00"); // sábado
  expect(proximaApertura(semana, dia(23, 10))).toBeNull(); // está abierto
  expect(proximaApertura(null, dia(23, 10))).toBeNull();
});

test("la dirección no repite la colonia", () => {
  expect(direccionCompleta("Calle 60 #500, Centro", "Centro")).toBe("Calle 60 #500, Centro, Mérida");
  expect(direccionCompleta("Calle 21 #102", "Itzimná")).toBe("Calle 21 #102, Itzimná, Mérida");
  expect(direccionCompleta("Calle 21 #102", "")).toBe("Calle 21 #102, Mérida");
});

test("pantalla vacía con título, frase y acción", () => {
  const boton = document.createElement("a");
  boton.textContent = "Buscar taller";
  const vacio = crearVacio("Pide una cotización.", boton, { icono: "chat", titulo: "Aún no tienes conversaciones" });
  expect(vacio.querySelector(".estado-vacio__titulo")?.textContent).toBe("Aún no tienes conversaciones");
  expect(vacio.textContent).toContain("Pide una cotización.");
  expect(vacio.lastElementChild).toBe(boton);
});
