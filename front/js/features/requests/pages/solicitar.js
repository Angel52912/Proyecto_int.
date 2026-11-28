// 10 · Pedir cotización (CU-03), nuevo front: 3 pasos cortos con barra de avance (servicio, fotos y nota) y
// Enviar al final. Todo vive en un solo formulario; cada paso es un fieldset que se muestra a la vez.
import { api as apiMapa } from "../../map/index.js";
import { comprimirImagen } from "../../../lib/imagen.js";
import { TIPOS_IMAGEN, validarImagen } from "../../../../../apis/lib/validate.js";
import { alSalir } from "../../../ui/ciclo.js";
import { crear, enlace, ir } from "../../../ui/dom.js";
import { cargarEn } from "../../../ui/estados.js";
import { crearFoto } from "../../../ui/foto.js";
import { icono } from "../../../ui/iconos.js";
import { crearBoton, crearPantalla } from "../../../ui/layout.js";
import { mensajeDeError } from "../../../ui/mensajes.js";
import { api } from "../index.js";
import { MAX_DESCRIPCION, MAX_FOTOS_SOLICITUD } from "../../../../../apis/api-mixanab/requests/validar.js";
import { mostrarAvisoFlotante } from "../../../ui/aviso-flotante.js";

// UI: varias opciones marcables; el contrato sigue enviando un solo service_type (el primero compatible del taller).
const SERVICIOS_FORMULARIO = Object.freeze([
  { id: "repair", texto: "Reparación", icono: "reparacion", api: /** @type {const} */ ("repair") },
  { id: "cleaning", texto: "Limpieza", icono: "limpieza", api: /** @type {const} */ ("cleaning") },
  { id: "mending", texto: "Remiendo", icono: "reparacion", api: /** @type {const} */ ("repair") },
  { id: "sewing", texto: "Costura", icono: "reparacion", api: /** @type {const} */ ("repair") },
  { id: "other", texto: "Otro", icono: "mas", api: /** @type {const} */ ("repair") },
]);

const MIN_DESCRIPCION = 5;

const MENSAJES = {
  invalid_state: "Ya tienes una solicitud activa con este taller. Revísala en Mis pedidos.",
  limit_reached: "Ya tienes 5 solicitudes activas. Espera respuesta o cancela alguna para enviar otra.",
  forbidden: "Este taller ya no recibe solicitudes de ese servicio.",
  photo_required: "Agrega al menos una foto de tu calzado.",
  invalid_input: "Revisa las fotos (JPG, PNG o WebP de hasta 5 MB) y la descripción.",
};

/**
 * @typedef {{ archivo: File, vista: string, subidaId: string | null }} FotoLocal
 */

/**
 * Qué falta para poder enviar ("Falta agregar una foto, elegir un servicio y describir el problema"), o "" si está completo.
 * La descripción cuenta como lista desde MIN_DESCRIPCION letras, igual que la validación al enviar.
 * @param {{ fotos: number, servicios?: number, texto: string }} estado `servicios` por omisión 1 (uno elegido).
 * @returns {string}
 */
export function textoFaltante({ fotos, servicios = 1, texto }) {
  const faltan = [];
  if (fotos === 0) faltan.push("agregar una foto");
  if (servicios === 0) faltan.push("elegir un servicio");
  if (texto.trim().length < MIN_DESCRIPCION) faltan.push("describir el problema");
  if (faltan.length === 0) return "";
  const ultimo = faltan.pop();
  return `Falta ${faltan.length > 0 ? `${faltan.join(", ")} y ${ultimo}` : ultimo}.`;
}

/** @param {any} taller PerfilTaller */
function crearFormulario(taller) {
  /** @type {FotoLocal[]} */
  const fotos = [];
  /** @type {string | null} */
  let borradorId = null;
  /** @type {Set<string>} */
  const seleccionados = new Set(taller.services[0] ? [taller.services[0]] : []);

  const rejilla = crear("div", { clase: "solicitar__fotos" });
  const contadorFotos = crear("span", { clase: "solicitar__contador-fotos", texto: `0/${MAX_FOTOS_SOLICITUD}` });

  const errorFotos = crear("p", { clase: "campo__error", attrs: { "aria-live": "polite" } });
  const entradaArchivo = /** @type {HTMLInputElement} */ (
    crear("input", { clase: "oculto-visual", attrs: { type: "file", accept: TIPOS_IMAGEN.join(","), multiple: true, id: "fotos-calzado" } })
  );

  function pintarFotos() {
    const miniaturas = fotos.map((foto, indice) =>
      crear("div", { clase: "solicitar__foto" }, [
        crearFoto(foto.vista, `Foto ${indice + 1} del calzado`),
        crear(
          "button",
          {
            clase: "solicitar__quitar",
            attrs: { type: "button", "aria-label": `Quitar foto ${indice + 1}` },
            on: {
              click: async () => {
                const [quitada] = fotos.splice(indice, 1);
                URL.revokeObjectURL(quitada.vista);
                if (quitada.subidaId) await api.removeRequestPhoto(quitada.subidaId).catch(() => {});
                pintarFotos();
              },
            },
          },
          [icono("cerrar", { tam: 14 })],
        ),
      ]),
    );
    const agregar =
      fotos.length < MAX_FOTOS_SOLICITUD
        ? crear("label", { clase: "solicitar__agregar", attrs: { for: "fotos-calzado" } }, [icono("camara"), crear("span", { texto: "Agregar" })])
        : null;
    rejilla.replaceChildren(...miniaturas, agregar ?? "");
    contadorFotos.textContent = `${fotos.length}/${MAX_FOTOS_SOLICITUD}`;
    if (fotos.length > 0) errorFotos.textContent = "";
  }

  entradaArchivo.addEventListener("change", () => {
    errorFotos.textContent = "";
    for (const archivo of Array.from(entradaArchivo.files ?? [])) {
      if (fotos.length >= MAX_FOTOS_SOLICITUD) {
        errorFotos.textContent = `Máximo ${MAX_FOTOS_SOLICITUD} fotos por solicitud.`;
        break;
      }
      const { valido, error } = validarImagen(archivo);
      if (!valido) {
        // A1: solo imágenes válidas.
        errorFotos.textContent = error ?? MENSAJES.invalid_input;
        continue;
      }
      fotos.push({ archivo, vista: URL.createObjectURL(archivo), subidaId: null });
    }
    entradaArchivo.value = "";
    pintarFotos();
  });
  alSalir(() => fotos.forEach((f) => URL.revokeObjectURL(f.vista)));
  pintarFotos();

  const errorServicios = crear("p", { clase: "campo__error", attrs: { "aria-live": "polite" } });
  const chips = SERVICIOS_FORMULARIO.map((opcion) => {
    const chip = /** @type {HTMLButtonElement} */ (
      crear(
        "button",
        {
          clase: "chip",
          attrs: { type: "button", "aria-pressed": String(seleccionados.has(opcion.id)) },
          on: {
            click: () => {
              errorServicios.textContent = "";
              if (seleccionados.has(opcion.id)) seleccionados.delete(opcion.id);
              else seleccionados.add(opcion.id);
              chip.setAttribute("aria-pressed", String(seleccionados.has(opcion.id)));
            },
          },
        },
        [icono(opcion.icono, { tam: 14 }), crear("span", { texto: opcion.texto })],
      )
    );
    return chip;
  });

  const descripcion = /** @type {HTMLTextAreaElement} */ (
    crear("textarea", {
      clase: "solicitar__descripcion",
      attrs: { id: "descripcion", rows: 4, minlength: MIN_DESCRIPCION, maxlength: MAX_DESCRIPCION, required: true, wrap: "soft", placeholder: "Ej. La suela izquierda está despegada y el cuero tiene manchas de agua." },
    })
  );
  const contador = crear("span", { clase: "texto-secundario contador", texto: `0/${MAX_DESCRIPCION}` });
  descripcion.addEventListener("input", () => {
    contador.textContent = `${descripcion.value.length}/${MAX_DESCRIPCION}`;
  });

  const errorGeneral = crear("div", { attrs: { "aria-live": "assertive" } });
  const enviar = crearBoton("Enviar solicitud", { tipo: "submit", icono: "enviar" });
  /** @param {string} texto */
  const textoBoton = (texto) => {
    const etiqueta = enviar.querySelector("span");
    if (etiqueta) etiqueta.textContent = texto;
  };

  /** @param {SubmitEvent} evento */
  async function alEnviar(evento) {
    evento.preventDefault();
    errorGeneral.replaceChildren();
    const texto = descripcion.value.trim();
    // Si falta algo de un paso anterior, se regresa a ese paso con su mensaje.
    if (!validarPaso(1)) return irAPaso(1);
    if (!validarPaso(2)) return irAPaso(2);
    if (texto.length < MIN_DESCRIPCION) {
      irAPaso(3);
      errorGeneral.replaceChildren(crear("p", { clase: "aviso aviso--error", texto: `Describe el problema con al menos ${MIN_DESCRIPCION} letras.` }));
      descripcion.focus();
      return;
    }
    const opcion = SERVICIOS_FORMULARIO.find((s) => seleccionados.has(s.id) && taller.services.includes(s.api)) ?? SERVICIOS_FORMULARIO.find((s) => seleccionados.has(s.id));
    enviar.disabled = true;
    textoBoton("Enviando…");
    try {
      // Si un intento anterior falló a medias, el borrador se reutiliza y no se vuelven a subir las fotos ya subidas.
      const borrador = await api.createRequestDraft({ workshop_id: taller.id, service_type: /** @type {"repair" | "cleaning"} */ (opcion?.api ?? "repair"), description: texto });
      borradorId = borrador.id;
      for (const foto of fotos) {
        if (foto.subidaId) continue;
        const subida = await api.addRequestPhoto(borradorId, await comprimirImagen(foto.archivo));
        foto.subidaId = subida.id;
      }
      await api.submitRequest(borradorId);
      mostrarAvisoFlotante("Solicitud enviada al taller.");
      ir(`/chat/${borradorId}`);
    } catch (error) {
      const aviso = crear("div", { clase: "aviso aviso--error", attrs: { role: "alert" } }, [
        crear("p", { texto: mensajeDeError(error, MENSAJES) }),
      ]);
      const codigo = /** @type {{ code?: string }} */ (error).code;
      if (codigo === "invalid_state" || codigo === "limit_reached") aviso.append(enlace("/pedidos", { texto: "Ver mis pedidos" }));
      errorGeneral.replaceChildren(aviso);
      enviar.disabled = false;
      textoBoton("Enviar solicitud");
    }
  }

  // ── Pasos ──
  const secciones = [
    crear("fieldset", { clase: "campo solicitar__seccion" }, [
      crear("legend", { clase: "solicitar__leyenda", texto: "¿Qué servicio necesitas?" }),
      crear("p", { clase: "solicitar__ayuda", texto: "Puedes elegir más de uno." }),
      crear("div", { clase: "chips solicitar__servicios", attrs: { role: "group", "aria-label": "Tipo de servicio (puedes elegir varios)" } }, chips),
      errorServicios,
    ]),
    crear("fieldset", { clase: "campo solicitar__seccion" }, [
      crear("legend", { clase: "solicitar__leyenda" }, [crear("span", { texto: "Agrega fotos del calzado" }), contadorFotos]),
      crear("p", { clase: "solicitar__ayuda", texto: "Hasta 5 fotos: de frente, de lado y del daño." }),
      entradaArchivo,
      rejilla,
      crear("p", { clase: "solicitar__consejo" }, [icono("escudo", { tam: 18 }), crear("span", { texto: "Con buenas fotos el taller te da un precio más exacto." })]),
      errorFotos,
    ]),
    crear("div", { clase: "campo solicitar__seccion" }, [
      crear("label", { clase: "solicitar__leyenda", texto: "Cuéntale al taller qué pasa", attrs: { for: "descripcion" } }),
      crear("p", { clase: "solicitar__ayuda", texto: "Qué le pasó y cómo lo quieres. Mientras más detalle, mejor." }),
      descripcion,
      contador,
    ]),
  ];
  const TOTAL = secciones.length;
  let paso = 1;
  const numeroPaso = crear("p", { clase: "solicitar__numero", attrs: { "aria-live": "polite" } });
  const progreso = crear("div", { clase: "solicitar__progreso", attrs: { "aria-hidden": "true" } }, secciones.map(() => crear("span")));
  const atras = crearBoton("Atrás", { variante: "secundario", bloque: false, alHacerClic: () => irAPaso(paso - 1) });
  const continuar = crearBoton("Continuar", { bloque: false, alHacerClic: () => validarPaso(paso) && irAPaso(paso + 1) });

  /**
   * ¿El paso está completo? Si no, deja el mensaje junto al campo.
   * @param {number} n
   */
  function validarPaso(n) {
    if (n === 1 && seleccionados.size === 0) {
      errorServicios.textContent = "Elige al menos un tipo de servicio.";
      return false;
    }
    if (n === 2 && fotos.length === 0) {
      errorFotos.textContent = MENSAJES.photo_required;
      return false;
    }
    return true;
  }

  /** @param {number} n */
  function irAPaso(n) {
    const anterior = paso;
    paso = Math.min(TOTAL, Math.max(1, n));
    secciones.forEach((seccion, indice) => {
      seccion.hidden = indice !== paso - 1;
    });
    [...progreso.children].forEach((segmento, indice) => segmento.classList.toggle("hecho", indice < paso));
    numeroPaso.textContent = `Paso ${paso} de ${TOTAL}`;
    atras.hidden = paso === 1;
    continuar.hidden = paso === TOTAL;
    enviar.hidden = paso !== TOTAL;
    if (paso !== anterior) {
      window.scrollTo?.(0, 0);
      if (paso === TOTAL) descripcion.focus({ preventScroll: true });
    }
  }

  const formulario = crear("form", { clase: "solicitar__formulario", attrs: { novalidate: true }, on: { submit: /** @type {EventListener} */ (alEnviar) } }, [
    crear("div", { clase: "solicitar__para" }, [
      crearFoto(taller.photos.find((/** @type {any} */ f) => f.kind === "profile")?.url, `Foto de ${taller.name}`, "foto--chica", taller.name),
      crear("div", { clase: "tarjeta__cuerpo" }, [crear("p", { clase: "tarjeta__detalle", texto: "Para" }), crear("p", { clase: "tarjeta__titulo", texto: taller.name })]),
      numeroPaso,
    ]),
    progreso,
    ...secciones,
    errorGeneral,
    crear("div", { clase: "acciones solicitar__acciones" }, [atras, continuar, enviar]),
  ]);
  irAPaso(1);
  return formulario;
}

/** @param {import("../../../router.js").Contexto} contexto */
export async function renderSolicitar({ params }) {
  const contenido = crear("div", { clase: "solicitar__contenido" });
  const pantalla = crearPantalla({ titulo: "Pedir cotización", volver: `/taller/${params.tallerId}`, clase: "solicitar" }, [contenido]);
  cargarEn(contenido, () => apiMapa.getWorkshopProfile(params.tallerId), crearFormulario, {
    not_found: "Este taller ya no está disponible.",
    invalid_input: "Este taller ya no está disponible.",
  });
  return pantalla;
}
