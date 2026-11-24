// 17 · Datos del taller (Artesano, CU-07): nombre, fotos, dirección, ubicación en el mapa, servicios, horario,
// precio "desde", Guardar y Publicar taller. A1: resalta los campos obligatorios que faltan.
import { CENTRO_MERIDA, NOMBRE_SERVICIO, crearMapaLeaflet } from "../../map/componentes.js";
import { comprimirImagen } from "../../../lib/imagen.js";
import { TIPOS_IMAGEN, validarImagen } from "../../../../../apis/lib/validate.js";
import { alSalir } from "../../../ui/ciclo.js";
import { crear, ir } from "../../../ui/dom.js";
import { cargarEn } from "../../../ui/estados.js";
import { crearFoto } from "../../../ui/foto.js";
import { icono } from "../../../ui/iconos.js";
import { crearBoton, crearInsignia, crearPantalla } from "../../../ui/layout.js";
import { mensajeDeError } from "../../../ui/mensajes.js";
import { api } from "../index.js";

const DIAS = /** @type {const} */ ([
  ["mon", "Lunes"],
  ["tue", "Martes"],
  ["wed", "Miércoles"],
  ["thu", "Jueves"],
  ["fri", "Viernes"],
  ["sat", "Sábado"],
  ["sun", "Domingo"],
]);

/** @typedef {{ open: string, close: string }} RangoHorario */
/** @typedef {{ dia: string, abierto: boolean, abre?: string, cierra?: string, turnos?: RangoHorario[] }} FilaHorario */

const MINUTO_MAXIMO = 23 * 60 + 30;

/** @param {number} minutos @returns {string} */
const aHora = (minutos) => `${String(Math.floor(minutos / 60)).padStart(2, "0")}:${String(minutos % 60).padStart(2, "0")}`;

/** @param {string} hora @returns {number | null} */
const aMinutos = (hora) => {
  const coincidencia = /^(\d{2}):(\d{2})$/.exec(hora);
  if (!coincidencia) return null;
  const horas = Number(coincidencia[1]);
  const minutos = Number(coincidencia[2]);
  return horas < 24 && minutos < 60 ? horas * 60 + minutos : null;
};

/** Horas de apertura cada 30 minutos; el cierre incluye 23:59 para quien termina a medianoche. */
const HORAS_APERTURA = Object.freeze(
  Array.from({ length: MINUTO_MAXIMO / 30 + 1 }, (_, i) => aHora(i * 30)),
);
const HORAS_CIERRE = Object.freeze([...HORAS_APERTURA, "23:59"]);

/**
 * Opciones del desplegable. Si llega una hora heredada fuera de la rejilla, la conserva.
 * @param {string} valor
 * @param {boolean} esCierre
 * @returns {string[]}
 */
export function opcionesHora(valor, esCierre = false) {
  const base = esCierre ? HORAS_CIERRE : HORAS_APERTURA;
  return base.includes(valor) ? [...base] : [...base, valor].sort();
}

/**
 * Sugiere la reapertura del segundo turno: una hora después del cierre, redondeada al siguiente cuarto de hora.
 * @param {string} cierre
 * @returns {string}
 */
export function sugerirApertura(cierre) {
  const minutos = aMinutos(cierre);
  if (minutos === null) return "09:00";
  return aHora(Math.min(Math.ceil((minutos + 60) / 30) * 30, MINUTO_MAXIMO));
}

/** @param {string} apertura @returns {string} */
export function sugerirCierre(apertura) {
  const minutos = aMinutos(apertura);
  if (minutos === null) return "18:00";
  return minutos + 180 > 23 * 60 + 59 ? "23:59" : aHora(minutos + 180);
}

/** Etiqueta de cada campo que puede faltar al publicar (`missing` de publishMyWorkshop). */
export const CAMPO_FALTANTE = Object.freeze({
  name: "Nombre del taller",
  address: "Dirección",
  colonia: "Colonia",
  location: "Ubicación en el mapa",
  services: "Servicios",
  hours: "Horario",
  price_from: "Precio desde",
});

/**
 * Convierte los controles del horario (hasta dos rangos por día) al formato `hours` del contrato.
 * Acepta filas antiguas con `abre`/`cierra` y filas nuevas con `turnos`.
 * @param {FilaHorario[]} filas
 * @returns {{ horario: Record<string, RangoHorario[]>, error: string | null }}
 */
export function horarioDeFilas(filas) {
  /** @type {Record<string, RangoHorario[]>} */
  const horario = {};
  for (const fila of filas) {
    if (!fila.abierto) {
      horario[fila.dia] = [];
      continue;
    }
    const rangos = fila.turnos ?? [{ open: fila.abre ?? "", close: fila.cierra ?? "" }];
    if (rangos.length === 0 || rangos.length > 2) {
      return { horario, error: "Cada día abierto admite uno o dos horarios." };
    }
    /** @type {RangoHorario[]} */
    const validos = [];
    for (const [indice, rango] of rangos.entries()) {
      if (!/^\d{2}:\d{2}$/.test(rango.open) || !/^\d{2}:\d{2}$/.test(rango.close) || rango.open >= rango.close) {
        return { horario, error: "En cada horario, la apertura debe ser antes que el cierre." };
      }
      if (indice > 0 && rango.open <= validos[indice - 1].close) {
        return { horario, error: "El segundo horario debe empezar después de que cierre el primero." };
      }
      validos.push({ open: rango.open, close: rango.close });
    }
    horario[fila.dia] = validos;
  }
  return { horario, error: null };
}

/** @param {any | null} tallerInicial */
function pintarFormulario(tallerInicial) {
  /** @type {any | null} */
  let taller = tallerInicial;
  const raiz = crear("div", { clase: "taller__formulario" });

  /** @param {string} id @param {string} etiqueta @param {HTMLElement} control @param {string} [nombreIcono] */
  const campo = (id, etiqueta, control, nombreIcono) => {
    control.id = id;
    return crear("div", { clase: `campo${nombreIcono ? " campo--icono" : ""}`, attrs: { "data-campo": id } }, [
      crear("label", { texto: etiqueta, attrs: { for: id } }),
      nombreIcono ? icono(nombreIcono, { tam: 18 }) : null,
      control,
    ]);
  };
  const entrada = (/** @type {Record<string, any>} */ attrs) => /** @type {HTMLInputElement} */ (crear("input", { attrs }));

  const nombre = entrada({ maxlength: 100, placeholder: "Talabartería Don Chucho", autocomplete: "organization" });
  const direccion = entrada({ maxlength: 300, placeholder: "C. 62 #512", autocomplete: "street-address" });
  const colonia = entrada({ maxlength: 100, placeholder: "Centro" });
  const cp = entrada({ inputmode: "numeric", maxlength: 5, pattern: "\\d{5}", placeholder: "97000", autocomplete: "postal-code" });
  const precio = entrada({ type: "number", min: "1", step: "10", inputmode: "decimal", placeholder: "120" });
  /** @type {{ lat: number, lng: number } | null} */
  let ubicacion = null;
  /** @type {Set<string>} */
  const servicios = new Set();

  // Fotos (públicas): perfil y trabajos. Se suben al elegirlas (requiere que el taller ya exista).
  const fotos = crear("div", { clase: "taller__fotos" });
  const entradaFoto = /** @type {HTMLInputElement} */ (crear("input", { clase: "oculto-visual", attrs: { type: "file", accept: TIPOS_IMAGEN.join(","), id: "foto-taller" } }));
  const avisoFotos = crear("p", { clase: "campo__error", attrs: { "aria-live": "polite" } });
  function pintarFotos() {
    const lista = taller?.photos ?? [];
    fotos.replaceChildren(
      ...lista.map((/** @type {any} */ f) =>
        crear("div", { clase: "solicitar__foto" }, [
          crearFoto(f.url, f.kind === "profile" ? "Foto de perfil del taller" : "Foto de trabajo"),
          f.kind === "profile" ? crearInsignia("Perfil", "cuero") : null,
          crear(
            "button",
            {
              clase: "solicitar__quitar",
              attrs: { type: "button", "aria-label": "Quitar foto" },
              on: {
                click: async () => {
                  try {
                    await api.removeWorkshopPhoto(f.id);
                    taller = await api.getMyWorkshop();
                    pintarFotos();
                  } catch (error) {
                    avisoFotos.textContent = mensajeDeError(error);
                  }
                },
              },
            },
            [icono("cerrar", { tam: 14 })],
          ),
        ]),
      ),
      crear("label", { clase: "solicitar__agregar", attrs: { for: "foto-taller" } }, [icono("mas"), crear("span", { texto: "Agregar" })]),
    );
  }
  entradaFoto.addEventListener("change", async () => {
    const archivo = entradaFoto.files?.[0];
    entradaFoto.value = "";
    if (!archivo) return;
    const { valido, error } = validarImagen(archivo);
    if (!valido) {
      avisoFotos.textContent = error ?? "";
      return;
    }
    avisoFotos.textContent = "Subiendo foto…";
    try {
      if (taller === null) taller = await api.saveMyWorkshop({ name: nombre.value.trim() || "Mi taller" });
      const tienePerfil = (taller.photos ?? []).some((/** @type {any} */ f) => f.kind === "profile");
      await api.addWorkshopPhoto(await comprimirImagen(archivo), tienePerfil ? "work" : "profile");
      taller = await api.getMyWorkshop();
      avisoFotos.textContent = "";
      pintarFotos();
    } catch (e) {
      avisoFotos.textContent = mensajeDeError(e, { limit_reached: "Máximo 10 fotos de trabajos." });
    }
  });

  // Mapa: tocar para fijar la ubicación del taller.
  const mapaContenedor = crear("div", { clase: "taller__mapa", attrs: { role: "application", "aria-label": "Toca el mapa para marcar la ubicación del taller" } });
  const textoUbicacion = crear("p", { clase: "texto-secundario", texto: "Toca el mapa para marcar tu taller." });
  /** @type {any} */
  let marcador = null;
  setTimeout(() => {
    const mapa = crearMapaLeaflet(mapaContenedor, { centro: ubicacion ?? CENTRO_MERIDA, zoom: ubicacion ? 16 : 13 });
    if (mapa === null) {
      textoUbicacion.textContent = "No se pudo cargar el mapa.";
      return;
    }
    alSalir(() => mapa.remove());
    const fijar = (/** @type {{ lat: number, lng: number }} */ punto) => {
      ubicacion = { lat: Number(punto.lat.toFixed(6)), lng: Number(punto.lng.toFixed(6)) };
      if (marcador) marcador.setLatLng([ubicacion.lat, ubicacion.lng]);
      else marcador = L.marker([ubicacion.lat, ubicacion.lng], { icon: L.divIcon({ html: crear("span", { clase: "pin" }, [icono("reparacion", { tam: 16 })]), className: "pin-contenedor", iconSize: [36, 36], iconAnchor: [18, 36] }) }).addTo(mapa);
      textoUbicacion.textContent = "Ubicación marcada. Puedes tocar otro punto para moverla.";
    };
    if (ubicacion) fijar(ubicacion);
    mapa.on("click", (/** @type {any} */ e) => fijar(e.latlng));
  }, 0);

  // Servicios
  const chipsServicios = crear(
    "div",
    { clase: "chips", attrs: { role: "group", "aria-label": "Servicios" } },
    /** @type {("repair" | "cleaning")[]} */ (["repair", "cleaning"]).map((s) =>
      crear("button", {
        clase: "chip",
        texto: NOMBRE_SERVICIO[s],
        attrs: { type: "button", "aria-pressed": "false", "data-servicio": s },
        on: {
          click: (evento) => {
            const chip = /** @type {HTMLElement} */ (evento.currentTarget);
            if (servicios.has(s)) servicios.delete(s);
            else servicios.add(s);
            chip.setAttribute("aria-pressed", String(servicios.has(s)));
          },
        },
      }),
    ),
  );

  // Horario: switch por día, hasta dos turnos y copiado rápido desde el lunes.
  const avisoHorario = crear("p", { clase: "horario__aviso", attrs: { "aria-live": "polite" } });
  /** @type {Map<string, { dia: string, etiqueta: string, abierto: boolean, rangos: RangoHorario[], contenedor: HTMLElement }>} */
  const estadosHorario = new Map(
    DIAS.map(([dia, etiqueta]) => [
      dia,
      { dia, etiqueta, abierto: dia !== "sun", rangos: [{ open: "09:00", close: "18:00" }], contenedor: crear("div", { clase: "horario__dia", attrs: { "data-dia": dia } }) },
    ]),
  );

  /** @param {string} dia */
  const estadoDe = (dia) => estadosHorario.get(dia);

  /**
   * @param {any} estado
   * @param {"open" | "close"} tipo
   * @param {number} indice
   * @param {string} valor
   */
  function selectorHora(estado, tipo, indice, valor) {
    const esCierre = tipo === "close";
    const minAnterior = !esCierre && indice === 1 ? estado.rangos[0].close : null;
    const minActual = esCierre ? estado.rangos[indice].open : null;
    const opciones = opcionesHora(valor, esCierre).map((hora) => {
      const bloqueada = (minAnterior !== null && hora <= minAnterior) || (minActual !== null && hora <= minActual);
      return crear("option", { attrs: { value: hora, disabled: bloqueada, selected: hora === valor }, texto: hora });
    });
    const select = /** @type {HTMLSelectElement} */ (
      crear("select", { attrs: { "aria-label": `${estado.etiqueta}: ${esCierre ? "cierra a las" : "abre a las"} (turno ${indice + 1})` } }, opciones)
    );
    select.addEventListener("change", () => {
      estado.rangos[indice][tipo] = select.value;
      if (esCierre && indice === 0 && estado.rangos[1] && estado.rangos[1].open <= estado.rangos[0].close) {
        estado.rangos[1].open = sugerirApertura(estado.rangos[0].close);
      }
      if (esCierre && estado.rangos[indice].close <= estado.rangos[indice].open) {
        estado.rangos[indice].close = sugerirCierre(estado.rangos[indice].open);
      }
      avisoHorario.textContent = "";
      pintarDia(estado);
      actualizarCopiar();
    });
    return select;
  }

  /** @param {any} estado */
  function interruptor(estado) {
    return crear(
      "button",
      {
        clase: "interruptor",
        attrs: { type: "button", role: "switch", "aria-checked": String(estado.abierto), "aria-label": `${estado.abierto ? "Cerrar" : "Abrir"} el ${estado.etiqueta}` },
        on: {
          click: () => {
            estado.abierto = !estado.abierto;
            avisoHorario.textContent = "";
            pintarDia(estado);
            actualizarCopiar();
          },
        },
      },
      [crear("span", { clase: "interruptor__pista" }, [crear("span", { clase: "interruptor__peloton" })]), crear("span", { clase: "interruptor__texto", texto: estado.abierto ? "Abierto" : "Cerrado" })],
    );
  }

  /** @param {any} estado */
  function pintarDia(estado) {
    const cabecera = crear("div", { clase: "horario__cabecera" }, [
      crear("span", { clase: "horario__nombre", texto: estado.etiqueta }),
      interruptor(estado),
      crear("span", { clase: `horario__estado${estado.abierto ? "" : " horario__estado--cerrado"}`, texto: estado.abierto ? "Abierto" : "Cerrado" }),
    ]);
    if (!estado.abierto) {
      estado.contenedor.replaceChildren(cabecera);
      return;
    }
    const bloques = estado.rangos.map((rango, indice) => {
      const abrir = crear("label", { clase: "horario__selector" }, [crear("span", { texto: "Abre a las" }), selectorHora(estado, "open", indice, rango.open)]);
      const cerrar = crear("label", { clase: "horario__selector" }, [crear("span", { texto: "Cierra a las" }), selectorHora(estado, "close", indice, rango.close)]);
      const quitar = indice === 1
        ? crear("button", { clase: "horario__quitar", attrs: { type: "button", "aria-label": `Quitar el segundo horario del ${estado.etiqueta}` }, on: { click: () => { estado.rangos.pop(); pintarDia(estado); } } }, [icono("cerrar", { tam: 16 })])
        : null;
      return crear("div", { clase: "horario__bloque" }, [
        estado.rangos.length > 1 ? crear("span", { clase: "horario__numero", texto: `Horario ${indice + 1}` }) : null,
        crear("div", { clase: "horario__rango" }, [abrir, cerrar]),
        quitar,
      ]);
    });
    const puedeAgregar = estado.rangos.length < 2 && estado.rangos[0].close < "23:30";
    const agregar = puedeAgregar
      ? crear("button", { clase: "boton-texto horario__agregar", attrs: { type: "button" }, on: { click: () => { const apertura = sugerirApertura(estado.rangos[0].close); estado.rangos.push({ open: apertura, close: sugerirCierre(apertura) }); pintarDia(estado); } } }, [crear("span", { texto: "+ Agregar horario" })])
      : null;
    estado.contenedor.replaceChildren(cabecera, ...bloques, agregar);
  }

  /** @param {string[]} destinos @param {string} mensaje */
  function copiarHorario(destinos, mensaje) {
    const lunes = estadoDe("mon");
    const { error } = horarioDeFilas([{ dia: "mon", abierto: lunes.abierto, turnos: lunes.rangos }]);
    if (!lunes.abierto || error) return;
    for (const clave of destinos) {
      const estado = estadoDe(clave);
      estado.abierto = true;
      estado.rangos = lunes.rangos.map((r) => ({ ...r }));
      pintarDia(estado);
    }
    avisoHorario.textContent = mensaje;
  }

  const copiarLaborables = crear("button", { clase: "boton-texto", attrs: { type: "button" }, on: { click: () => copiarHorario(["mon", "tue", "wed", "thu", "fri"], "Horario copiado de lunes a viernes.") } }, [crear("span", { texto: "Copiar a lunes–viernes" })]);
  const copiarSemana = crear("button", { clase: "boton-texto", attrs: { type: "button" }, on: { click: () => copiarHorario(DIAS.map(([dia]) => dia), "Horario copiado a todos los días.") } }, [crear("span", { texto: "Copiar horario a todos los días" })]);

  function actualizarCopiar() {
    const lunes = estadoDe("mon");
    const { error } = horarioDeFilas([{ dia: "mon", abierto: lunes.abierto, turnos: lunes.rangos }]);
    const habilitado = lunes.abierto && error === null;
    copiarLaborables.disabled = !habilitado;
    copiarSemana.disabled = !habilitado;
  }

  const listaDias = crear("div", { clase: "horario__dias" }, DIAS.map(([dia]) => estadoDe(dia).contenedor));
  for (const [, estado] of estadosHorario) pintarDia(estado);
  actualizarCopiar();

  // Valores iniciales
  if (taller) {
    nombre.value = taller.name ?? "";
    direccion.value = taller.address ?? "";
    colonia.value = taller.colonia ?? "";
    cp.value = taller.postal_code ?? "";
    precio.value = taller.price_from === null ? "" : String(taller.price_from);
    ubicacion = taller.lat === null ? null : { lat: taller.lat, lng: taller.lng };
    for (const s of taller.services ?? []) servicios.add(s);
    chipsServicios.querySelectorAll("[data-servicio]").forEach((chip) => chip.setAttribute("aria-pressed", String(servicios.has(chip.getAttribute("data-servicio") ?? ""))));
    for (const [dia] of DIAS) {
      const estado = estadoDe(dia);
      const rangos = taller.hours?.[dia] ?? [];
      estado.abierto = rangos.length > 0;
      estado.rangos = estado.abierto
        ? rangos.slice(0, 2).map((/** @type {any} */ r) => ({ open: r.open, close: r.close }))
        : [{ open: "09:00", close: "18:00" }];
      pintarDia(estado);
    }
    actualizarCopiar();
  }
  pintarFotos();

  const estado = crear("div", { clase: "taller__estado" });
  function pintarEstado() {
    if (!taller) estado.replaceChildren(crearInsignia("Sin publicar", "neutra"));
    else if (taller.suspended) estado.replaceChildren(crearInsignia("Suspendido por administración", "error"));
    else estado.replaceChildren(crearInsignia(taller.published ? "Visible en el mapa" : "Borrador", taller.published ? "exito" : "neutra"));
  }
  pintarEstado();

  const aviso = crear("div", { attrs: { "aria-live": "assertive" } });

  /** @returns {Record<string, unknown> | null} */
  function datosDelFormulario() {
    const { horario, error } = horarioDeFilas(
      DIAS.map(([dia]) => {
        const estado = estadoDe(dia);
        return { dia, abierto: estado.abierto, turnos: estado.rangos };
      }),
    );
    if (error) {
      aviso.replaceChildren(crear("p", { clase: "aviso aviso--error", texto: error }));
      return null;
    }
    if (cp.value !== "" && !/^\d{5}$/.test(cp.value)) {
      aviso.replaceChildren(crear("p", { clase: "aviso aviso--error", texto: "El código postal debe tener 5 dígitos." }));
      return null;
    }
    const precioNumero = Number(precio.value);
    /** @type {Record<string, unknown>} */
    const datos = { services: [...servicios], hours: horario, postal_code: cp.value === "" ? null : cp.value };
    if (nombre.value.trim()) datos.name = nombre.value.trim();
    if (direccion.value.trim()) datos.address = direccion.value.trim();
    if (colonia.value.trim()) datos.colonia = colonia.value.trim();
    if (ubicacion) Object.assign(datos, ubicacion);
    if (precio.value !== "" && Number.isFinite(precioNumero) && precioNumero > 0) datos.price_from = precioNumero;
    return datos;
  }

  /** @param {string[]} faltan */
  function resaltarFaltantes(faltan) {
    raiz.querySelectorAll("[data-campo]").forEach((c) => c.classList.remove("campo--error"));
    const mapaCampos = { name: "nombre-taller", address: "direccion", colonia: "colonia", location: "ubicacion", services: "servicios", hours: "horario", price_from: "precio" };
    for (const f of faltan) raiz.querySelector(`[data-campo="${mapaCampos[/** @type {keyof typeof mapaCampos} */ (f)]}"]`)?.classList.add("campo--error");
  }

  async function guardar() {
    aviso.replaceChildren();
    const datos = datosDelFormulario();
    if (datos === null) return false;
    try {
      taller = await api.saveMyWorkshop(datos);
      pintarEstado();
      return true;
    } catch (error) {
      aviso.replaceChildren(crear("p", { clase: "aviso aviso--error", attrs: { role: "alert" }, texto: mensajeDeError(error, { invalid_input: "Revisa los datos. Un taller publicado no puede quedar incompleto." }) }));
      return false;
    }
  }

  const botonGuardar = crearBoton("Guardar", {
    variante: "secundario",
    alHacerClic: async () => {
      botonGuardar.disabled = true;
      if (await guardar()) aviso.replaceChildren(crear("p", { clase: "aviso", texto: "Cambios guardados." }));
      botonGuardar.disabled = false;
    },
  });
  const botonPublicar = crearBoton(tallerInicial?.published ? "Guardar y seguir publicado" : "Publicar taller", {
    alHacerClic: async () => {
      botonPublicar.disabled = true;
      try {
        if (!(await guardar())) return;
        const resultado = await api.publishMyWorkshop();
        if (!resultado.published) {
          // A1: resaltar los campos obligatorios faltantes.
          resaltarFaltantes(resultado.missing);
          aviso.replaceChildren(
            crear("div", { clase: "aviso aviso--miel", attrs: { role: "alert" } }, [
              crear("p", { texto: `Para publicar falta: ${resultado.missing.map((/** @type {string} */ c) => CAMPO_FALTANTE[/** @type {keyof typeof CAMPO_FALTANTE} */ (c)] ?? c).join(", ")}.` }),
            ]),
          );
          return;
        }
        ir("/artesano/perfil");
      } catch (error) {
        aviso.replaceChildren(crear("p", { clase: "aviso aviso--error", texto: mensajeDeError(error, { forbidden: "Tu taller está suspendido y no se puede publicar." }) }));
      } finally {
        botonPublicar.disabled = false;
      }
    },
  });

  raiz.append(
    estado,
    campo("nombre-taller", "Nombre del taller", nombre, "reparacion"),
    crear("div", { clase: "campo" }, [crear("span", { clase: "campo__etiqueta", texto: "Fotos del taller" }), entradaFoto, fotos, avisoFotos]),
    campo("direccion", "Dirección", direccion, "mapa"),
    crear("div", { clase: "filtros__fila" }, [campo("colonia", "Colonia", colonia), campo("cp", "C.P.", cp)]),
    crear("div", { clase: "campo", attrs: { "data-campo": "ubicacion" } }, [crear("span", { clase: "campo__etiqueta", texto: "Ubicación en el mapa" }), mapaContenedor, textoUbicacion]),
    crear("div", { clase: "campo", attrs: { "data-campo": "servicios" } }, [crear("span", { clase: "campo__etiqueta", texto: "Servicios" }), chipsServicios]),
    crear("section", { clase: "campo taller__horario", attrs: { "data-campo": "horario" } }, [
      crear("span", { clase: "campo__etiqueta", texto: "Horario" }),
      crear("div", { clase: "horario__atajos" }, [copiarLaborables, copiarSemana]),
      listaDias,
      avisoHorario,
    ]),
    campo("precio", "Precio desde (MXN)", precio, "dinero"),
    aviso,
    crear("div", { clase: "acciones" }, [botonGuardar, botonPublicar]),
  );
  return raiz;
}

/** @returns {Promise<Node>} */
export async function renderTaller() {
  const contenido = crear("div");
  const pantalla = crearPantalla({ titulo: "Tu taller", volver: "/artesano/perfil", clase: "taller" }, [contenido]);
  cargarEn(contenido, () => api.getMyWorkshop(), pintarFormulario);
  return pantalla;
}
