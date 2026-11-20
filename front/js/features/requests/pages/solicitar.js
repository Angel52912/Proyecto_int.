// 10 · Solicitar cotización (CU-03): fotos del calzado, tipo de servicio, descripción y Enviar solicitud.
import { api as apiMapa } from "../../map/index.js";
import { NOMBRE_SERVICIO } from "../../map/componentes.js";
import { comprimirImagen } from "../../../lib/imagen.js";
import { TIPOS_IMAGEN, validarImagen } from "../../../lib/validate.js";
import { alSalir } from "../../../ui/ciclo.js";
import { crear, enlace, ir } from "../../../ui/dom.js";
import { cargarEn } from "../../../ui/estados.js";
import { crearFoto } from "../../../ui/foto.js";
import { icono } from "../../../ui/iconos.js";
import { crearBoton, crearPantalla } from "../../../ui/layout.js";
import { mensajeDeError } from "../../../ui/mensajes.js";
import { api } from "../index.js";
import { MAX_DESCRIPCION, MAX_FOTOS_SOLICITUD } from "../validar.js";

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

/** @param {any} taller PerfilTaller */
function crearFormulario(taller) {
  /** @type {FotoLocal[]} */
  const fotos = [];
  /** @type {string | null} */
  let borradorId = null;
  /** @type {"repair" | "cleaning"} */
  let servicio = taller.services[0];

  const rejilla = crear("div", { clase: "solicitar__fotos" });
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

  /** @type {HTMLButtonElement[]} */
  const chips = taller.services.map((/** @type {"repair" | "cleaning"} */ s) => {
    const chip = /** @type {HTMLButtonElement} */ (
      crear(
        "button",
        {
          clase: "chip",
          attrs: { type: "button", role: "radio", "aria-checked": String(s === servicio) },
          on: {
            click: () => {
              servicio = s;
              chips.forEach((/** @type {HTMLButtonElement} */ otro) => otro.setAttribute("aria-checked", String(otro === chip)));
            },
          },
        },
        [icono(s === "repair" ? "reparacion" : "limpieza", { tam: 14 }), crear("span", { texto: NOMBRE_SERVICIO[s] })],
      )
    );
    return chip;
  });

  const descripcion = /** @type {HTMLTextAreaElement} */ (
    crear("textarea", {
      attrs: { id: "descripcion", rows: 4, maxlength: MAX_DESCRIPCION, required: true, placeholder: "Ej. La suela izquierda está despegada y el cuero tiene manchas de agua." },
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
    if (fotos.length === 0) {
      errorFotos.textContent = MENSAJES.photo_required;
      return;
    }
    if (texto === "") {
      errorGeneral.replaceChildren(crear("p", { clase: "aviso aviso--error", texto: "Describe el problema de tu calzado." }));
      descripcion.focus();
      return;
    }
    enviar.disabled = true;
    textoBoton("Enviando…");
    try {
      // Si un intento anterior falló a medias, el borrador se reutiliza y no se vuelven a subir las fotos ya subidas.
      const borrador = await api.createRequestDraft({ workshop_id: taller.id, service_type: servicio, description: texto });
      borradorId = borrador.id;
      for (const foto of fotos) {
        if (foto.subidaId) continue;
        const subida = await api.addRequestPhoto(borradorId, await comprimirImagen(foto.archivo));
        foto.subidaId = subida.id;
      }
      await api.submitRequest(borradorId);
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

  return crear("form", { clase: "solicitar__formulario", attrs: { novalidate: true }, on: { submit: /** @type {EventListener} */ (alEnviar) } }, [
    crear("div", { clase: "tarjeta tarjeta--enlace solicitar__para" }, [
      crearFoto(taller.photos.find((/** @type {any} */ f) => f.kind === "profile")?.url, `Foto de ${taller.name}`, "foto--chica"),
      crear("div", { clase: "tarjeta__cuerpo" }, [crear("p", { clase: "tarjeta__detalle", texto: "Para" }), crear("p", { clase: "tarjeta__titulo", texto: taller.name })]),
    ]),
    crear("fieldset", { clase: "campo" }, [crear("legend", { texto: "Fotos del calzado" }), entradaArchivo, rejilla, errorFotos]),
    crear("fieldset", { clase: "campo" }, [crear("legend", { texto: "Tipo de servicio" }), crear("div", { clase: "chips", attrs: { role: "radiogroup", "aria-label": "Tipo de servicio" } }, chips)]),
    crear("div", { clase: "campo" }, [crear("label", { texto: "Describe el problema", attrs: { for: "descripcion" } }), descripcion, contador]),
    errorGeneral,
    crear("div", { clase: "acciones" }, [enviar]),
  ]);
}

/** @param {import("../../../router.js").Contexto} contexto */
export async function renderSolicitar({ params }) {
  const contenido = crear("div", { clase: "solicitar__contenido" });
  const pantalla = crearPantalla({ titulo: "Solicitar cotización", volver: `/taller/${params.tallerId}`, clase: "solicitar" }, [contenido]);
  cargarEn(contenido, () => apiMapa.getWorkshopProfile(params.tallerId), crearFormulario, {
    not_found: "Este taller ya no está disponible.",
    invalid_input: "Este taller ya no está disponible.",
  });
  return pantalla;
}
