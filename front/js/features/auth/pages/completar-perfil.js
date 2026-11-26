// 05 · Completar perfil (CU-01): foto, nombre y, solo para el cliente, edad y dirección (`client_private`).
// Con `?desde=perfil` funciona como "Editar perfil" y regresa a la pestaña Perfil.
import { comprimirImagen } from "../../../lib/imagen.js";
import { validarImagen } from "../../../../../apis/lib/validate.js";
import { alSalir } from "../../../ui/ciclo.js";
import { crear, enlace, ir } from "../../../ui/dom.js";
import { cargarEn } from "../../../ui/estados.js";
import { icono } from "../../../ui/iconos.js";
import { crearBoton, crearPantalla, iniciales } from "../../../ui/layout.js";
import { mensajeDeError } from "../../../ui/mensajes.js";
import { datosAcceso, limpiarDatosAcceso } from "../flujo.js";
import { olvidarPerfil } from "../guardia.js";
import { api } from "../index.js";
import { crearPasosRegistro } from "./bienvenida.js";
import { validarEnVivo } from "../../../ui/validacion.js";

/**
 * @param {{ rol: string | null, nombre: string, edad: string, direccion: string }} valores
 * @returns {{ errores: Record<string, string>, datos: { full_name: string, age: number | null, address: string } }}
 */
export function validarDatosPerfil({ rol, nombre, edad, direccion }) {
  /** @type {Record<string, string>} */
  const errores = {};
  const fullName = nombre.trim().replace(/\s+/g, " ");
  const address = direccion.trim();
  const age = /^\d{1,3}$/.test(edad.trim()) ? Number(edad.trim()) : null;
  if (fullName.length === 0) errores.nombre = "Escribe tu nombre.";
  else if (fullName.length > 100) errores.nombre = "Usa máximo 100 caracteres.";
  if (rol === "client") {
    if (age === null || age < 1 || age > 120) errores.edad = "Escribe tu edad en años (de 1 a 120).";
    if (address.length === 0) errores.direccion = "Escribe tu dirección.";
    else if (address.length > 300) errores.direccion = "Usa máximo 300 caracteres.";
  }
  return { errores, datos: { full_name: fullName, age, address } };
}

/**
 * @param {string} id
 * @param {string} etiqueta
 * @param {HTMLInputElement} control
 * @param {string} nombreIcono
 * @param {HTMLElement} error
 */
function campo(id, etiqueta, control, nombreIcono, error) {
  control.id = id;
  error.id = `${id}-error`;
  control.setAttribute("aria-describedby", error.id);
  return crear("div", { clase: "campo", attrs: { "data-campo": id } }, [
    crear("label", { texto: etiqueta, attrs: { for: id } }),
    crear("div", { clase: "campo--icono" }, [icono(nombreIcono, { tam: 18 }), control]),
    error,
  ]);
}

/** Con `?desde=` la pantalla edita el perfil y regresa a la pestaña de origen. */
const REGRESO_AL_EDITAR = Object.freeze({ perfil: "/perfil", taller: "/artesano/perfil" });

/**
 * @param {{ perfil: any, privados: any | null, urlFoto: string | null }} datos
 * @param {string | null} regreso ruta a la que vuelve al editar; null en el alta
 */
function pintar({ perfil, privados, urlFoto }, regreso) {
  const editando = regreso !== null;
  const esCliente = perfil.role === "client";
  const error = () => crear("p", { clase: "campo__error", attrs: { "aria-live": "polite" } });
  const errores = { nombre: error(), edad: error(), direccion: error(), foto: error(), general: error() };

  const nombre = /** @type {HTMLInputElement} */ (crear("input", { attrs: { type: "text", autocomplete: "name", maxlength: 100, placeholder: "José Cámara" } }));
  nombre.value = perfil.full_name || datosAcceso().nombre;
  const edad = /** @type {HTMLInputElement} */ (crear("input", { attrs: { type: "text", inputmode: "numeric", maxlength: 3, placeholder: "22", autocomplete: "off" } }));
  edad.value = privados?.age ? String(privados.age) : "";
  const direccion = /** @type {HTMLInputElement} */ (crear("input", { attrs: { type: "text", autocomplete: "street-address", maxlength: 300, placeholder: "C. 60 #491, Centro, Mérida" } }));
  direccion.value = privados?.address ?? "";
  validarEnVivo({ nombre, edad: esCliente ? edad : null, direccion: esCliente ? direccion : null }, () =>
    validarDatosPerfil({ rol: perfil.role, nombre: nombre.value, edad: edad.value, direccion: direccion.value }).errores,
  );

  // Foto de perfil: vista previa local hasta guardar.
  /** @type {File | null} */
  let fotoNueva = null;
  let quitarFoto = false;
  /** @type {string | null} */
  let urlVista = null;
  alSalir(() => {
    if (urlVista) URL.revokeObjectURL(urlVista);
  });
  const avatar = crear("span", { clase: "avatar avatar--grande" });
  // Sin nombre todavía: ícono de persona en lugar de "?"; con nombre, sus iniciales.
  const sinFoto = () => (nombre.value.trim() === "" ? icono("perfil", { tam: 40 }) : iniciales(nombre.value));
  const textoFoto = crear("button", { clase: "boton-texto", attrs: { type: "button" } });
  const entrada = /** @type {HTMLInputElement} */ (crear("input", { clase: "oculto-visual", attrs: { type: "file", accept: "image/jpeg,image/png,image/webp", tabindex: -1, "aria-hidden": "true" } }));
  const pintarAvatar = () => {
    const url = quitarFoto ? null : (urlVista ?? urlFoto);
    if (url) {
      const img = crear("img", { attrs: { src: url, alt: "Tu foto de perfil" } });
      img.addEventListener("error", () => avatar.replaceChildren(sinFoto()));
      avatar.replaceChildren(img);
    } else {
      avatar.replaceChildren(sinFoto());
    }
    textoFoto.textContent = url ? "Quitar foto" : "Agregar foto";
  };
  entrada.addEventListener("change", () => {
    const archivo = entrada.files?.[0];
    entrada.value = "";
    if (!archivo) return;
    if (!validarImagen(archivo).valido) {
      errores.foto.textContent = "Usa una foto JPG, PNG o WebP de hasta 5 MB.";
      return;
    }
    errores.foto.textContent = "";
    if (urlVista) URL.revokeObjectURL(urlVista);
    urlVista = URL.createObjectURL(archivo);
    fotoNueva = archivo;
    quitarFoto = false;
    pintarAvatar();
  });
  textoFoto.addEventListener("click", () => {
    if (textoFoto.textContent === "Agregar foto") {
      entrada.click();
      return;
    }
    if (urlVista) URL.revokeObjectURL(urlVista);
    urlVista = null;
    fotoNueva = null;
    quitarFoto = urlFoto !== null;
    pintarAvatar();
  });
  nombre.addEventListener("input", () => {
    if (avatar.querySelector("img") === null) avatar.replaceChildren(sinFoto());
  });
  pintarAvatar();

  const guardar = crearBoton(editando ? "Guardar cambios" : "Guardar y continuar", { tipo: "submit" });

  const formulario = crear(
    "form",
    {
      clase: "acceso__formulario",
      attrs: { novalidate: true },
      on: {
        submit: async (evento) => {
          evento.preventDefault();
          const { errores: fallos, datos } = validarDatosPerfil({ rol: perfil.role, nombre: nombre.value, edad: edad.value, direccion: direccion.value });
          for (const clave of ["nombre", "edad", "direccion"]) {
            errores[/** @type {"nombre"} */ (clave)].textContent = fallos[clave] ?? "";
            formulario.querySelector(`[data-campo="${clave}"]`)?.classList.toggle("campo--error", Boolean(fallos[clave]));
          }
          const primero = Object.keys(fallos)[0];
          if (primero) {
            /** @type {HTMLElement | null} */ (formulario.querySelector(`#${primero}`))?.focus();
            return;
          }
          guardar.disabled = true;
          errores.general.textContent = "";
          try {
            if (fotoNueva) await api.addAvatar(await comprimirImagen(fotoNueva));
            else if (quitarFoto) await api.removeAvatar();
            await api.updateMyProfile({ full_name: datos.full_name });
            if (esCliente) await api.saveMyClientPrivate({ age: /** @type {number} */ (datos.age), address: datos.address });
            olvidarPerfil();
            limpiarDatosAcceso();
            ir(regreso ?? (esCliente ? "/" : "/artesano/taller"));
          } catch (fallo) {
            errores.general.textContent = mensajeDeError(fallo, { invalid_input: "Revisa tus datos e intenta de nuevo." });
            guardar.disabled = false;
          }
        },
      },
    },
    [
      editando ? null : crearPasosRegistro(4),
      crear("div", { clase: "foto-perfil" }, [
        crear("div", { clase: "foto-perfil__marco" }, [
          avatar,
          crear("button", { clase: "foto-perfil__camara", attrs: { type: "button", "aria-label": "Elegir foto de perfil" }, on: { click: () => entrada.click() } }, [icono("camara", { tam: 16 })]),
        ]),
        textoFoto,
        entrada,
        errores.foto,
      ]),
      campo("nombre", "Nombre", nombre, "perfil", errores.nombre),
      esCliente ? campo("edad", "Edad", edad, "calendario", errores.edad) : null,
      esCliente ? campo("direccion", "Dirección", direccion, "mapa", errores.direccion) : null,
      esCliente ? crear("p", { clase: "tarjeta__detalle", texto: "Tu edad y dirección solo las ves tú; el taller no tiene acceso a ellas." }) : null,
      crear("div", { clase: "acceso__pie" }, [errores.general, guardar]),
    ],
  );
  return formulario;
}

/**
 * @param {import("../../../router.js").Contexto} contexto
 * @returns {Node}
 */
export function renderCompletarPerfil({ consulta }) {
  const regreso = REGRESO_AL_EDITAR[/** @type {keyof typeof REGRESO_AL_EDITAR} */ (consulta.get("desde") ?? "")];
  const editando = regreso !== undefined;
  const contenido = crear("div", { clase: "acceso__formulario" });
  cargarEn(
    contenido,
    async () => {
      const perfil = await api.getMyProfile();
      if (perfil.role === null) {
        ir("/acceso/rol");
        return null;
      }
      const [privados, urlFoto] = await Promise.all([
        perfil.role === "client" ? api.getMyClientPrivate().catch(() => null) : null,
        perfil.avatar_path ? api.getAvatarUrl(perfil.avatar_path).catch(() => null) : null,
      ]);
      return { perfil, privados, urlFoto };
    },
    (datos) => (datos === null ? [] : [pintar(datos, regreso ?? null)]),
    { not_authenticated: "Tu sesión terminó. Inicia sesión para continuar." },
  ).then(() => {
    if (contenido.querySelector(".estado-error")) contenido.append(enlace("/acceso", { clase: "boton boton--bloque", texto: "Iniciar sesión" }));
  });
  return crearPantalla({ titulo: editando ? "Editar perfil" : "Completa tu perfil", volver: regreso, clase: "acceso" }, [contenido]);
}
