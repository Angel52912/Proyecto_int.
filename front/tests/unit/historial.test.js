// Historial del talabartero (orders/pages/historial.js): filtros, entregas a tiempo y resumen.
import { jest } from "@jest/globals";

jest.unstable_mockModule("../../../apis/supabaseClient.js", () => ({ obtenerCliente: () => ({}), obtenerSesion: async () => null }));

const { claveDeMes, entregadoATiempo, filtrarHistorial, mesesConEntregas, nombreDeMes, resumenHistorial } = await import("../../js/features/orders/pages/historial.js");
const { fechaDelTablero } = await import("../../js/features/orders/pages/tablero.js");

const pedidos = [
  { id: "a", request_id: "s1", status: "delivered", due_date: "2026-11-20", delivered_at: "2026-11-19T18:00:00" },
  { id: "b", request_id: "s2", status: "delivered", due_date: "2026-10-05", delivered_at: "2026-10-08T12:00:00" },
  { id: "c", request_id: "s3", status: "delivered", due_date: "2026-11-25", delivered_at: "2026-11-25T20:00:00" },
  { id: "d", request_id: "s4", status: "in_progress", due_date: "2026-12-01", delivered_at: null },
];
const solicitudes = new Map([
  ["s1", { id: "s1", service_type: "repair" }],
  ["s2", { id: "s2", service_type: "cleaning" }],
  ["s3", { id: "s3", service_type: "repair" }],
]);

test("solo entregados, del más reciente al más viejo", () => {
  expect(filtrarHistorial(pedidos, solicitudes).map((p) => p.id)).toEqual(["c", "a", "b"]);
});

test("filtra por mes y por servicio", () => {
  expect(filtrarHistorial(pedidos, solicitudes, { mes: "2026-10" }).map((p) => p.id)).toEqual(["b"]);
  expect(filtrarHistorial(pedidos, solicitudes, { servicio: "repair" }).map((p) => p.id)).toEqual(["c", "a"]);
  expect(filtrarHistorial(pedidos, solicitudes, { mes: "2026-11", servicio: "cleaning" })).toEqual([]);
});

test("a tiempo = entregado el día prometido o antes", () => {
  expect(entregadoATiempo(pedidos[0])).toBe(true);
  expect(entregadoATiempo(pedidos[1])).toBe(false);
  expect(entregadoATiempo(pedidos[2])).toBe(true); // mismo día, en la noche
  expect(entregadoATiempo(pedidos[3])).toBeNull();
});

test("resumen, meses y nombres", () => {
  expect(resumenHistorial(filtrarHistorial(pedidos, solicitudes))).toEqual({ total: 3, aTiempo: 67 });
  expect(resumenHistorial([])).toEqual({ total: 0, aTiempo: null });
  expect(mesesConEntregas(pedidos)).toEqual(["2026-11", "2026-10"]);
  expect(claveDeMes("2026-11-19T18:00:00")).toBe("2026-11");
  expect(nombreDeMes("2026-11")).toBe("Noviembre 2026");
});

test("fecha del Tablero: día de la semana con mayúscula", () => {
  expect(fechaDelTablero(new Date("2026-11-27T18:00:00Z"))).toMatch(/^Viernes 27 nov/);
});
