// 08 · Talleres por categoría (CU-02): orden por más cercanos, mejor valorados o precio, y filtros.
import { crear } from "../../../ui/dom.js";
import { cargarEn, crearVacio } from "../../../ui/estados.js";
import { icono } from "../../../ui/iconos.js";
import { crearPantalla } from "../../../ui/layout.js";
import { NOMBRE_SERVICIO, buscarTalleres, crearTarjetaTaller, obtenerUbicacion } from "../componentes.js";
import { filtroDeTexto } from "./mapa.js";

/** @typedef {import("../componentes.js").Orden} Orden */

/**
 * Filtro "Colonia o C.P." del panel: 5 dígitos = C.P.; lo demás = colonia.
 * @param {string} texto
 * @returns {{ colonia?: string, postal_code?: string }}
 */
export function filtroDeLugar(texto) {
  const limpio = texto.trim();
  if (limpio === "") return {};
  return /^\d{5}$/.test(limpio) ? { postal_code: limpio } : { colonia: limpio.slice(0, 100) };
}

/**
 * @param {string} etiqueta
 * @param {Node} control
 */
const campo = (etiqueta, control) => crear("label", { clase: "campo" }, [crear("span", { texto: etiqueta }), control]);

/** @param {import("../../../router.js").Contexto} contexto */
export async function renderTalleres({ consulta }) {
  const servicioInicial = consulta.get("servicio");
  const servicio = /** @type {import("../componentes.js").FiltroServicio} */ (servicioInicial === "repair" || servicioInicial === "cleaning" ? servicioInicial : "all");
  const textoInicial = consulta.get("q") ?? "";
  /** @type {{ orden: Orden, ubicacion: { lat: number, lng: number } | null }} */
  const estado = { orden: "cercanos", ubicacion: null };

  const lista = crear("div", { attrs: { "aria-live": "polite" } });

  // Panel de filtros (oculto hasta tocar el ícono).
  const selectServicio = /** @type {HTMLSelectElement} */ (
    crear("select", { attrs: { name: "service" } }, [
      crear("option", { texto: "Todos", attrs: { value: "all" } }),
      crear("option", { texto: NOMBRE_SERVICIO.repair, attrs: { value: "repair" } }),
      crear("option", { texto: NOMBRE_SERVICIO.cleaning, attrs: { value: "cleaning" } }),
    ])
  );
  selectServicio.value = servicio;
  const entradaLugar = /** @type {HTMLInputElement} */ (crear("input", { attrs: { name: "lugar", placeholder: "Ej. Centro o 97000", autocomplete: "postal-code" } }));
  const selectCalificacion = /** @type {HTMLSelectElement} */ (
    crear("select", { attrs: { name: "min_rating" } }, [
      crear("option", { texto: "Cualquiera", attrs: { value: "" } }),
      crear("option", { texto: "4 o más", attrs: { value: "4" } }),
      crear("option", { texto: "3 o más", attrs: { value: "3" } }),
    ])
  );
  const entradaPrecio = /** @type {HTMLInputElement} */ (crear("input", { attrs: { name: "max_price", type: "number", min: "1", step: "10", inputmode: "numeric", placeholder: "Sin límite" } }));
  const selectDistancia = /** @type {HTMLSelectElement} */ (
    crear("select", { attrs: { name: "max_distance_km" } }, [
      crear("option", { texto: "Cualquiera", attrs: { value: "" } }),
      crear("option", { texto: "Hasta 2 km", attrs: { value: "2" } }),
      crear("option", { texto: "Hasta 5 km", attrs: { value: "5" } }),
      crear("option", { texto: "Hasta 10 km", attrs: { value: "10" } }),
    ])
  );
  const casillaAbierto = /** @type {HTMLInputElement} */ (crear("input", { attrs: { type: "checkbox", name: "open_now" } }));
  const avisoDistancia = crear("p", { clase: "texto-secundario", texto: "La distancia necesita tu ubicación." });

  const panel = crear(
    "form",
    {
      clase: "tarjeta filtros",
      attrs: { hidden: true, "aria-label": "Filtros de búsqueda" },
      on: {
        submit: (evento) => {
          evento.preventDefault();
          buscar();
        },
      },
    },
    [
      campo("Servicio", selectServicio),
      campo("Colonia o C.P.", entradaLugar),
      crear("div", { clase: "filtros__fila" }, [campo("Calificación", selectCalificacion), campo("Precio desde (máx.)", entradaPrecio)]),
      campo("Distancia", selectDistancia),
      avisoDistancia,
      crear("label", { clase: "casilla" }, [casillaAbierto, crear("span", { texto: "Solo abiertos ahora" })]),
      crear("button", { clase: "boton boton--bloque", texto: "Aplicar filtros", attrs: { type: "submit" } }),
    ],
  );

  const botonFiltros = crear(
    "button",
    {
      clase: "boton-circular",
      attrs: { type: "button", "aria-label": "Filtros", "aria-expanded": "false" },
      on: {
        click: () => {
          const abierto = panel.hidden;
          panel.hidden = !abierto;
          botonFiltros.setAttribute("aria-expanded", String(abierto));
        },
      },
    },
    [icono("filtro")],
  );

  /** @type {HTMLButtonElement[]} */
  const chipsOrden = [];
  /**
   * @param {string} texto
   * @param {Orden} valor
   */
  const chipOrden = (texto, valor) => {
    const chip = /** @type {HTMLButtonElement} */ (
      crear("button", {
        clase: "chip",
        texto,
        attrs: { type: "button", "aria-pressed": String(estado.orden === valor) },
        on: {
          click: async () => {
            estado.orden = valor;
            for (const otro of chipsOrden) otro.setAttribute("aria-pressed", String(otro === chip));
            if (valor === "cercanos" && estado.ubicacion === null) estado.ubicacion = await obtenerUbicacion({ preguntar: true });
            buscar();
          },
        },
      })
    );
    chipsOrden.push(chip);
    return chip;
  };

  function buscar() {
    const distancia = selectDistancia.value === "" || estado.ubicacion === null ? undefined : Number(selectDistancia.value);
    avisoDistancia.hidden = estado.ubicacion !== null;
    const precio = Number(entradaPrecio.value);
    const filtros = {
      service: /** @type {import("../componentes.js").FiltroServicio} */ (selectServicio.value),
      orden: estado.orden,
      ...(estado.ubicacion ?? {}),
      ...filtroDeTexto(textoInicial),
      ...filtroDeLugar(entradaLugar.value),
      ...(selectCalificacion.value ? { min_rating: Number(selectCalificacion.value) } : {}),
      ...(Number.isFinite(precio) && precio > 0 ? { max_price: precio } : {}),
      ...(distancia ? { max_distance_km: distancia } : {}),
      ...(casillaAbierto.checked ? { open_now: true } : {}),
    };
    return cargarEn(
      lista,
      () => buscarTalleres(filtros),
      (talleres) =>
        talleres.length === 0
          ? crearVacio("No encontramos talleres con esos filtros. Prueba con otra colonia o quita filtros.")
          : crear(
              "ul",
              { clase: "lista" },
              talleres.map((t) => crear("li", {}, [crearTarjetaTaller(t)])),
            ),
      { invalid_input: "Revisa los filtros: colonia, C.P. de 5 dígitos o precio." },
    );
  }

  const titulo = servicio === "all" ? (textoInicial ? `“${textoInicial}”` : "Talleres") : NOMBRE_SERVICIO[servicio];
  const pantalla = crearPantalla({ rol: "client", activa: "mapa", titulo, volver: "/inicio", accion: botonFiltros, clase: "talleres" }, [
    crear("div", { clase: "chips", attrs: { role: "group", "aria-label": "Ordenar por" } }, [
      chipOrden("Más cercanos", "cercanos"),
      chipOrden("Mejor valorados", "valorados"),
      chipOrden("Precio", "precio"),
    ]),
    panel,
    lista,
  ]);

  obtenerUbicacion().then((ubicacion) => {
    estado.ubicacion = ubicacion;
    buscar();
  });
  return pantalla;
}
