// 07 · Buscar taller (CU-02), nuevo front: mapa casi a pantalla completa con buscador y filtros flotando arriba y un
// panel abajo con el taller elegido y el acceso a la lista completa.
import { alSalir } from "../../../ui/ciclo.js";
import { crear, enlace } from "../../../ui/dom.js";
import { crearCargando, crearError, crearVacio } from "../../../ui/estados.js";
import { icono } from "../../../ui/iconos.js";
import { crearPantalla } from "../../../ui/layout.js";
import { mensajeDeError } from "../../../ui/mensajes.js";
import { NOMBRE_SERVICIO, buscarTalleres, crearMapaLeaflet, crearTarjetaTaller, obtenerUbicacion, pintarPines, quitarMapa } from "../componentes.js";

/**
 * Convierte el texto del buscador "Buscar taller o colonia" en filtro: 5 dígitos = C.P. (A1); lo demás busca en el
 * nombre o la colonia del taller (`search` del servidor).
 * @param {string} texto
 * @returns {{ search?: string, postal_code?: string }}
 */
export function filtroDeTexto(texto) {
  const limpio = texto.trim();
  if (limpio === "") return {};
  return /^\d{5}$/.test(limpio) ? { postal_code: limpio } : { search: limpio.slice(0, 100) };
}

/** @param {import("../../../router.js").Contexto} contexto */
export async function renderMapa({ consulta }) {
  const inicial = consulta.get("servicio");
  /** @type {{ servicio: import("../componentes.js").FiltroServicio, abierto: boolean, texto: string, ubicacion: { lat: number, lng: number } | null, seleccionado: string | null }} */
  const estado = {
    servicio: inicial === "repair" || inicial === "cleaning" ? inicial : "all",
    abierto: false,
    texto: consulta.get("q") ?? "",
    ubicacion: null,
    seleccionado: null,
  };

  const mapaContenedor = crear("div", { clase: "mapa__lienzo", attrs: { role: "region", "aria-label": "Mapa de talleres" } });
  const tarjeta = crear("div", { clase: "mapa__tarjeta", attrs: { "aria-live": "polite" } });
  /** @type {any} */
  let mapa = null;
  /** @type {any} */
  let capa = null;
  /** @type {any[]} */
  let resultados = [];

  const entrada = /** @type {HTMLInputElement} */ (
    crear("input", { attrs: { type: "search", value: estado.texto, placeholder: "Buscar en Mérida (colonia o C.P.)", "aria-label": "Colonia o código postal" } })
  );
  const buscador = crear(
    "form",
    {
      clase: "campo campo--icono buscador mapa__buscador",
      attrs: { role: "search" },
      on: {
        submit: (evento) => {
          evento.preventDefault();
          estado.texto = entrada.value;
          buscar();
        },
      },
    },
    [
      icono("buscar", { tam: 18 }),
      entrada,
      enlace(`/talleres?servicio=${estado.servicio}`, { clase: "buscador__filtros", attrs: { "aria-label": "Más filtros y lista" } }, [icono("filtro")]),
    ],
  );

  /** @type {HTMLButtonElement[]} */
  const chipsServicio = [];
  /**
   * @param {string} texto
   * @param {import("../componentes.js").FiltroServicio} valor
   */
  const chipServicio = (texto, valor) => {
    const chip = /** @type {HTMLButtonElement} */ (
      crear("button", {
        clase: "chip",
        texto,
        attrs: { type: "button", "aria-pressed": String(estado.servicio === valor) },
        on: {
          click: () => {
            estado.servicio = valor;
            for (const otro of chipsServicio) otro.setAttribute("aria-pressed", String(otro === chip));
            buscar();
          },
        },
      })
    );
    chipsServicio.push(chip);
    return chip;
  };
  const chipAbierto = crear("button", {
    clase: "chip",
    texto: "Abierto ahora",
    attrs: { type: "button", "aria-pressed": "false" },
    on: {
      click: () => {
        estado.abierto = !estado.abierto;
        chipAbierto.setAttribute("aria-pressed", String(estado.abierto));
        buscar();
      },
    },
  });

  const botonUbicacion = crear(
    "button",
    {
      clase: "boton-circular mapa__ubicar",
      attrs: { type: "button", "aria-label": "Usar mi ubicación" },
      on: {
        click: async () => {
          const ubicacion = await obtenerUbicacion({ preguntar: true });
          if (ubicacion === null) {
            tarjeta.replaceChildren(crear("p", { clase: "aviso aviso--miel", texto: "No pudimos obtener tu ubicación. Escribe tu colonia o C.P." }));
            entrada.focus();
            return;
          }
          estado.ubicacion = ubicacion;
          buscar();
        },
      },
    },
    [icono("navegar")],
  );

  /** Lo que tapan el buscador con filtros (arriba) y la tarjeta con la navegación (abajo). */
  function margenDelMapa() {
    const alto = window.innerHeight;
    const arriba = superior.getBoundingClientRect().bottom;
    const abajo = alto - tarjeta.getBoundingClientRect().top;
    return { arriba: Math.max(0, Math.round(arriba)), abajo: Math.max(0, Math.round(Math.min(abajo, alto / 2))) };
  }

  /** @param {any} taller */
  function pintarTarjeta(taller) {
    estado.seleccionado = taller.id;
    tarjeta.replaceChildren(
      crear("span", { clase: "mapa__asa", attrs: { "aria-hidden": "true" } }),
      crear("div", { clase: "mapa__encabezado-panel" }, [
        crear("p", { clase: "mapa__conteo", texto: resultados.length === 1 ? "1 taller cerca de ti" : `${resultados.length} talleres cerca de ti` }),
        enlace(`/talleres?servicio=${estado.servicio}`, { clase: "boton-texto", texto: "Ver lista" }),
      ]),
      crearTarjetaTaller(taller),
    );
  }

  /** @param {any} taller */
  function elegir(taller) {
    pintarTarjeta(taller);
    if (mapa) {
      // Solo se repintan los pines para marcar el elegido; la vista no salta, solo se desliza hacia él.
      capa?.remove();
      capa = pintarPines(mapa, resultados, { ubicacion: estado.ubicacion, alElegir: elegir, seleccionado: taller.id, ajustar: false });
      mapa.panTo([taller.lat, taller.lng]);
    }
  }

  async function buscar() {
    tarjeta.replaceChildren(crearCargando("Buscando talleres…"));
    try {
      resultados = await buscarTalleres({
        service: estado.servicio,
        orden: "cercanos",
        ...(estado.ubicacion ?? {}),
        ...filtroDeTexto(estado.texto),
        ...(estado.abierto ? { open_now: true } : {}),
      });
    } catch (error) {
      tarjeta.replaceChildren(crearError(mensajeDeError(error, { invalid_input: "Revisa la colonia o el código postal." }), buscar));
      return;
    }
    capa?.remove();
    capa = null;
    if (resultados.length === 0) {
      // A2: aviso sin resultados.
      tarjeta.replaceChildren(crearVacio("No encontramos talleres con esos filtros. Prueba con otra colonia o quita filtros."));
      return;
    }
    // Primero la tarjeta, para medir cuánto tapa antes de encuadrar los pines.
    const elegido = resultados.find((t) => t.id === estado.seleccionado) ?? resultados[0];
    pintarTarjeta(elegido);
    if (mapa) capa = pintarPines(mapa, resultados, { ubicacion: estado.ubicacion, alElegir: elegir, seleccionado: elegido.id, margen: margenDelMapa() });
  }

  const superior = crear("div", { clase: "mapa__superior" }, [
    buscador,
    crear("div", { clase: "chips", attrs: { role: "group", "aria-label": "Filtros" } }, [
      chipServicio("Todos", "all"),
      chipServicio(NOMBRE_SERVICIO.repair, "repair"),
      chipServicio(NOMBRE_SERVICIO.cleaning, "cleaning"),
      chipAbierto,
    ]),
  ]);

  const pantalla = crearPantalla({ rol: "client", activa: "mapa", clase: "mapa" }, [
    crear("h1", { clase: "oculto-visual", texto: "Mapa de talleres" }),
    mapaContenedor,
    superior,
    botonUbicacion,
    tarjeta,
  ]);

  setTimeout(async () => {
    mapa = crearMapaLeaflet(mapaContenedor);
    if (mapa === null) mapaContenedor.replaceChildren(crear("p", { clase: "estado-error", texto: "No se pudo cargar el mapa. Usa la lista de talleres." }));
    else alSalir(() => quitarMapa(mapa));
    estado.ubicacion = await obtenerUbicacion();
    buscar();
  }, 0);

  return pantalla;
}
