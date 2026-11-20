// 17 · Datos del taller (Artesano, CU-07): nombre, fotos, dirección, ubicación en el mapa, servicios, horario,
// precio "desde", Guardar y Publicar taller. A1: resalta los campos obligatorios que faltan.
import { CENTRO_MERIDA, NOMBRE_SERVICIO, crearMapaLeaflet } from "../../map/componentes.js";
import { comprimirImagen } from "../../../lib/imagen.js";
import { TIPOS_IMAGEN, validarImagen } from "../../../lib/validate.js";
import { alSalir } from "../../../ui/ciclo.js";
import { crear, ir } from "../../../ui/dom.js";
import { cargarEn } from "../../../ui/estados.js";
import { crearFoto } from "../../../ui/foto.js";
import { icono } from "../../../ui/iconos.js";
import { crearBoton, crearInsignia, crearPantalla } from "../../../ui/layout.js";
import { mensajeDeError } from "../../../ui/mensajes.js";
import { api } from "../index.js";

const DIAS = /** @type {const} */ ([
  ["mon", "Lun"],
  ["tue", "Mar"],
  ["wed", "Mié"],
  ["thu", "Jue"],
  ["fri", "Vie"],
  ["sat", "Sáb"],
  ["sun", "Dom"],
]);

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
 * Convierte los controles del horario (un rango por día) al formato `hours` del contrato.
 * @param {{ dia: string, abierto: boolean, abre: string, cierra: string }[]} filas
 * @returns {{ horario: Record<string, { open: string, close: string }[]>, error: string | null }}
 */
export function horarioDeFilas(filas) {
  /** @type {Record<string, { open: string, close: string }[]>} */
  const horario = {};
  for (const fila of filas) {
    if (!fila.abierto) {
      horario[fila.dia] = [];
      continue;
    }
    if (!/^\d{2}:\d{2}$/.test(fila.abre) || !/^\d{2}:\d{2}$/.test(fila.cierra) || fila.abre >= fila.cierra) {
      return { horario, error: "En cada día abierto, la hora de apertura debe ser antes que la de cierre." };
    }
    horario[fila.dia] = [{ open: fila.abre, close: fila.cierra }];
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

  // Horario: un rango por día.
  const filasHorario = DIAS.map(([dia, etiqueta]) => {
    const abierto = /** @type {HTMLInputElement} */ (crear("input", { attrs: { type: "checkbox", "aria-label": `Abre el ${etiqueta}` } }));
    const abre = entrada({ type: "time", value: "09:00", "aria-label": `${etiqueta}: abre` });
    const cierra = entrada({ type: "time", value: "18:00", "aria-label": `${etiqueta}: cierra` });
    abierto.checked = !["sun"].includes(dia);
    const actualizar = () => {
      abre.disabled = !abierto.checked;
      cierra.disabled = !abierto.checked;
    };
    abierto.addEventListener("change", actualizar);
    actualizar();
    return { dia, abierto, abre, cierra, fila: crear("div", { clase: "horario-fila" }, [crear("label", { clase: "casilla" }, [abierto, crear("span", { texto: etiqueta })]), abre, crear("span", { texto: "a" }), cierra]) };
  });

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
    if (taller.hours) {
      for (const f of filasHorario) {
        const rango = taller.hours[f.dia]?.[0];
        f.abierto.checked = rango !== undefined;
        if (rango) {
          f.abre.value = rango.open;
          f.cierra.value = rango.close;
        }
        f.abre.disabled = !f.abierto.checked;
        f.cierra.disabled = !f.abierto.checked;
      }
    }
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
    const { horario, error } = horarioDeFilas(filasHorario.map((f) => ({ dia: f.dia, abierto: f.abierto.checked, abre: f.abre.value, cierra: f.cierra.value })));
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
    crear("div", { clase: "campo", attrs: { "data-campo": "horario" } }, [crear("span", { clase: "campo__etiqueta", texto: "Horario" }), ...filasHorario.map((f) => f.fila)]),
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
