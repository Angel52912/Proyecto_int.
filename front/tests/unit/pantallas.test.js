// Lógica pura de las pantallas de cliente y artesano (sin DOM de la página completa).
import { buscarTalleres, parametrosDeBusqueda, textoServicios } from "../../js/features/map/componentes.js";
import { filtroDeTexto } from "../../js/features/map/pages/mapa.js";
import { estadoDeHoy, filasHorario, indiceDeHoy } from "../../js/features/map/pages/perfil-taller.js";
import { filtroDeLugar } from "../../js/features/map/pages/talleres.js";
import { folio } from "../../js/features/chat/pages/chat.js";
import { filtrarConversaciones } from "../../js/features/chat/pages/chats.js";
import { conceptosDelDetalle, descripcionDelDetalle } from "../../js/features/quotes/pages/presupuesto.js";
import { validarFormularioPresupuesto } from "../../js/features/quotes/pages/enviar-presupuesto.js";
import { esCorreccion } from "../../js/features/orders/pages/actualizar-fase.js";
import { elementosDePedidos } from "../../js/features/orders/pages/pedidos.js";
import { textoHorarioHoy, urlComoLlegar } from "../../js/features/orders/pages/recoger.js";
import { lineaDeTiempo } from "../../js/features/orders/pages/seguimiento.js";
import { columnasDelTablero } from "../../js/features/orders/pages/tablero.js";
import { mensajeResultadoPin } from "../../js/features/orders/pages/verificar-entrega.js";
import { distribucionDeResenas, textoATiempo } from "../../js/features/workshop/pages/mi-taller.js";
import { horarioDeFilas } from "../../js/features/workshop/pages/taller.js";

describe("búsqueda de talleres (CU-02)", () => {
  const ubicacion = { lat: 20.97, lng: -89.62 };
  test("'Todos' no manda servicio y el orden se traduce al del servidor", () => {
    expect(parametrosDeBusqueda({ service: "all", orden: "precio" })).toEqual({ order: "price" });
    expect(parametrosDeBusqueda({ service: "repair", orden: "valorados", open_now: true })).toEqual({ service: "repair", order: "rating", open_now: true });
    expect(parametrosDeBusqueda({ service: "cleaning", orden: "cercanos", ...ubicacion })).toEqual({ service: "cleaning", order: "distance", ...ubicacion });
    expect(parametrosDeBusqueda({ service: "all" })).toEqual({});
  });
  test("sin ubicación, 'cercanos' pide mejor valorados", () => {
    expect(parametrosDeBusqueda({ service: "all", orden: "cercanos" })).toEqual({ order: "rating" });
  });
  test("texto del buscador: C.P. de 5 dígitos (A1) o nombre/colonia en el servidor", () => {
    expect(filtroDeTexto("97000")).toEqual({ postal_code: "97000" });
    expect(filtroDeTexto(" Centro ")).toEqual({ search: "Centro" });
    expect(filtroDeTexto("")).toEqual({});
  });
  test("filtro de lugar del panel: C.P. o colonia", () => {
    expect(filtroDeLugar("97100")).toEqual({ postal_code: "97100" });
    expect(filtroDeLugar(" Itzimná ")).toEqual({ colonia: "Itzimná" });
    expect(filtroDeLugar("")).toEqual({});
  });
  test("busca en el simulado: 'Todos' sin repetir y ordenado por precio", async () => {
    const { reiniciarSimulacion } = await import("../../../apis/api-mixanab/requests/simulacion.js");
    reiniciarSimulacion();
    const todos = await buscarTalleres({ service: "all", orden: "precio" });
    expect(new Set(todos.map((t) => t.id)).size).toBe(todos.length);
    const precios = todos.map((t) => t.price_from);
    expect(precios).toEqual([...precios].sort((a, b) => a - b));
  });
  test("servicios y horario en texto", () => {
    expect(textoServicios(["repair", "cleaning"])).toBe("Reparación · Limpieza");
    const filas = filasHorario({ mon: [{ open: "09:00", close: "14:00" }, { open: "16:00", close: "19:00" }] });
    expect(filas[0]).toEqual({ dia: "Lunes", texto: "09:00–14:00, 16:00–19:00" });
    expect(filas[6]).toEqual({ dia: "Domingo", texto: "Cerrado" });
  });
  test("hoy: índice con lunes = 0 y domingo = 6", () => {
    expect(indiceDeHoy(new Date(2026, 10, 23))).toBe(0); // lunes
    expect(indiceDeHoy(new Date(2026, 10, 29))).toBe(6); // domingo
  });
  test("estado de hoy: is_open decide; el horario agrega detalle", () => {
    const hours = { mon: [{ open: "09:00", close: "14:00" }, { open: "16:00", close: "19:00" }] };
    const lunes = (/** @type {number} */ h) => new Date(2026, 10, 23, h, 0);
    expect(estadoDeHoy({ is_open: true, hours }, lunes(10))).toEqual({ texto: "Abierto hasta 14:00", tono: "exito" });
    expect(estadoDeHoy({ is_open: false, hours }, lunes(15))).toEqual({ texto: "Abre a las 16:00", tono: "miel" });
    expect(estadoDeHoy({ is_open: false, hours }, lunes(20))).toEqual({ texto: "Cerrado ahora", tono: "neutra" });
    expect(estadoDeHoy({ is_open: false, hours }, new Date(2026, 10, 24, 10))).toEqual({ texto: "Cerrado hoy", tono: "neutra" });
    // El reloj del teléfono no coincide con Mérida: se respeta is_open.
    expect(estadoDeHoy({ is_open: false, hours }, lunes(10))).toEqual({ texto: "Cerrado ahora", tono: "neutra" });
    expect(estadoDeHoy({ is_open: true, hours }, lunes(20))).toEqual({ texto: "Abierto ahora", tono: "exito" });
  });
});

describe("presupuesto (CU-04)", () => {
  test("desglose y descripción desde detail libre", () => {
    const detalle = { descripcion: "Cambio de suela", conceptos: [{ concepto: "Suela", monto: 300 }, { nombre: "Limpieza" }] };
    expect(conceptosDelDetalle(detalle)).toEqual([
      { concepto: "Suela", monto: 300 },
      { concepto: "Limpieza", monto: null },
    ]);
    expect(descripcionDelDetalle(detalle)).toBe("Cambio de suela");
    expect(conceptosDelDetalle({})).toEqual([]);
  });
  test("valida el formulario del artesano", () => {
    const ahora = new Date(2026, 10, 14);
    const ok = validarFormularioPresupuesto({ monto: "450.10", fecha: "2026-11-18", detalle: " Suela " }, ahora);
    expect(ok.datos).toEqual({ amount_mxn: 450.1, delivery_date: "2026-11-18", detail: { descripcion: "Suela" } });
    const mal = validarFormularioPresupuesto({ monto: "0", fecha: "2026-11-01", detalle: "" }, ahora);
    expect(Object.keys(mal.errores).sort()).toEqual(["fecha", "monto"]);
    expect(validarFormularioPresupuesto({ monto: "1.234", fecha: "2026-11-18", detalle: "" }, ahora).errores.monto).toBeDefined();
  });
});

describe("pedido (CU-05, CU-06)", () => {
  const pedido = { id: "o1", phase: 3, status: "in_progress", due_date: "2026-11-18" };
  const avances = [
    { phase: 1, created_at: "2026-11-12T16:30:00Z", note: null, corrected: false },
    { phase: 2, created_at: "2026-11-13T22:05:00Z", note: "Listo", corrected: false },
    { phase: 3, created_at: "2026-11-14T15:00:00Z", note: null, corrected: false },
  ];
  test("línea de tiempo con fases hechas, actual y pendiente", () => {
    const pasos = lineaDeTiempo(pedido, avances);
    expect(pasos.map((p) => p.estado)).toEqual(["hecha", "hecha", "actual", "pendiente"]);
    expect(pasos[1].nota).toBe("Listo");
    expect(pasos[3].detalle).toBe("Estimado 18 nov");
    expect(lineaDeTiempo({ ...pedido, phase: 4, status: "ready" }, avances).every((p) => p.estado === "hecha")).toBe(true);
  });
  test("tablero agrupa por fase y listos", () => {
    const columnas = columnasDelTablero([
      { id: "a", phase: 1, status: "in_progress" },
      { id: "b", phase: 3, status: "in_progress" },
      { id: "c", phase: 4, status: "ready" },
      { id: "d", phase: 4, status: "delivered" },
    ]);
    expect([columnas[1].length, columnas[2].length, columnas[3].length, columnas[4].length, columnas.listo.length]).toEqual([1, 0, 1, 0, 1]);
  });
  test("salto o retroceso de fase es corrección (A1)", () => {
    expect(esCorreccion(1, 2)).toBe(false);
    expect(esCorreccion(1, 3)).toBe(true);
    expect(esCorreccion(3, 2)).toBe(true);
  });
  test("resultado del PIN", () => {
    expect(mensajeResultadoPin({ ok: false, attempts_left: 4, locked_until: null })).toBe("PIN incorrecto. Te quedan 4 intentos.");
    expect(mensajeResultadoPin({ ok: false, attempts_left: 1, locked_until: null })).toBe("PIN incorrecto. Te queda 1 intento.");
    expect(mensajeResultadoPin({ ok: false, attempts_left: 0, locked_until: "2026-11-14T18:30:00Z" })).toMatch(/Demasiados intentos/);
    expect(mensajeResultadoPin({ ok: true, attempts_left: 5, locked_until: null })).toBe("Entrega confirmada.");
  });
  test("horario de hoy y cómo llegar", () => {
    const horario = { sat: [{ open: "10:00", close: "19:00" }] };
    expect(textoHorarioHoy(horario, new Date(2026, 10, 14, 12, 0))).toBe("Abierto hasta 19:00");
    expect(textoHorarioHoy(horario, new Date(2026, 10, 14, 8, 0))).toBe("Abre a las 10:00");
    expect(textoHorarioHoy(horario, new Date(2026, 10, 14, 20, 0))).toBe("Cerrado ahora");
    expect(textoHorarioHoy(horario, new Date(2026, 10, 15, 12, 0))).toBe("Cerrado hoy");
    expect(urlComoLlegar(20.96, -89.62)).toBe("https://www.google.com/maps/dir/?api=1&destination=20.96,-89.62");
  });
});

describe("Mis pedidos", () => {
  test("une pedidos y solicitudes sin repetir las aceptadas", () => {
    const pedidos = [{ id: "o1", request_id: "r1", workshop_id: "w", phase: 2, status: "in_progress", created_at: "2026-11-14T10:00:00Z", updated_at: "2026-11-14T10:00:00Z", delivered_at: null }];
    const solicitudes = [
      { id: "r1", workshop_id: "w", service_type: "repair", status: "accepted", submitted_at: "2026-11-13T10:00:00Z", created_at: "2026-11-13T10:00:00Z" },
      { id: "r2", workshop_id: "w", service_type: "cleaning", status: "quoted", submitted_at: "2026-11-14T11:00:00Z", created_at: "2026-11-14T11:00:00Z" },
      { id: "r3", workshop_id: "w", service_type: "cleaning", status: "cancelled", submitted_at: "2026-11-10T11:00:00Z", created_at: "2026-11-10T11:00:00Z" },
    ];
    const elementos = elementosDePedidos(pedidos, solicitudes, new Set(), new Map([["w", "Taller"]]));
    expect(elementos.map((e) => e.id)).toEqual(["r2", "o1", "r3"]);
    expect(elementos.find((e) => e.id === "r2")?.ruta).toBe("/chat/r2");
    expect(elementos.find((e) => e.id === "o1")?.progreso).toBe(0.5);
    expect(elementos.find((e) => e.id === "r3")?.activo).toBe(false);
  });
  test("un pedido entregado sin calificar lleva a calificar", () => {
    const pedidos = [{ id: "o1", request_id: "r1", workshop_id: "w", phase: 4, status: "delivered", created_at: "x", updated_at: "x", delivered_at: "2026-11-14T10:00:00Z" }];
    const [e] = elementosDePedidos(pedidos, [], new Set(["o1"]), new Map());
    expect(e.ruta).toBe("/pedido/o1/calificar");
  });
});

describe("artesano", () => {
  test("horario desde los controles", () => {
    const ok = horarioDeFilas([
      { dia: "mon", abierto: true, abre: "09:00", cierra: "18:00" },
      { dia: "sun", abierto: false, abre: "09:00", cierra: "18:00" },
    ]);
    expect(ok).toEqual({ horario: { mon: [{ open: "09:00", close: "18:00" }], sun: [] }, error: null });
    expect(horarioDeFilas([{ dia: "mon", abierto: true, abre: "18:00", cierra: "09:00" }]).error).not.toBeNull();
  });
  test("reputación: estrellas por reseña y porcentaje a tiempo", () => {
    expect(distribucionDeResenas([{ rating: 5 }, { rating: 4 }, { rating: 5 }, { rating: 9 }])).toEqual({ 1: 0, 2: 0, 3: 0, 4: 1, 5: 2 });
    expect(textoATiempo(null)).toBe("–");
    expect(textoATiempo(100)).toBe("100%");
    expect(textoATiempo(92.5)).toBe("92.5%");
  });
  test("folio y búsqueda de conversaciones", () => {
    expect(folio("00000000-0000-4000-8000-00000000a1b2")).toBe("#A1B2");
    const lista = [
      { id: "1", nombre: "José Cámara", ultimo: "Perfecto", fecha: "x" },
      { id: "2", nombre: "Ana", ultimo: "¿Puedo pasar mañana?", fecha: "x" },
    ];
    expect(filtrarConversaciones(lista, "maña").map((c) => c.id)).toEqual(["2"]);
    expect(filtrarConversaciones(lista, "")).toHaveLength(2);
  });
});
