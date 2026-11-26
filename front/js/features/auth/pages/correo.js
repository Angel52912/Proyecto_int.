// 02 · Crear cuenta / Iniciar sesión (CU-01): nombre (solo al crear), correo y aceptación de términos.
// Sin contraseña: el backend solo usa Google o un código de 6 dígitos por correo (docs/frontend/PENDIENTES.md, 1.1).
import { validarCorreo } from "../../../../../apis/lib/validate.js";
import { crear, ir } from "../../../ui/dom.js";
import { icono } from "../../../ui/iconos.js";
import { crearBoton, crearPantalla } from "../../../ui/layout.js";
import { mensajeDeError } from "../../../ui/mensajes.js";
import { datosAcceso, guardarDatosAcceso } from "../flujo.js";
import { crearPasosRegistro } from "./bienvenida.js";
import { api } from "../index.js";
import { validarEnVivo } from "../../../ui/validacion.js";

/** @typedef {"crear" | "entrar"} ModoAcceso */

/**
 * @param {{ modo: ModoAcceso, nombre: string, correo: string, acepta: boolean }} valores
 * @returns {{ errores: Record<string, string>, datos: { nombre: string, correo: string } }}
 */
export function validarFormularioAcceso({ modo, nombre, correo, acepta }) {
  /** @type {Record<string, string>} */
  const errores = {};
  const limpio = { nombre: nombre.trim().replace(/\s+/g, " "), correo: correo.trim().toLowerCase() };
  if (modo === "crear" && limpio.nombre.length === 0) errores.nombre = "Escribe tu nombre.";
  if (modo === "crear" && limpio.nombre.length > 100) errores.nombre = "Usa máximo 100 caracteres.";
  if (!validarCorreo(limpio.correo)) errores.correo = "Escribe un correo válido, por ejemplo nombre@correo.com.";
  if (modo === "crear" && !acepta) errores.acepta = "Acepta los términos y el aviso de privacidad para continuar.";
  return { errores, datos: limpio };
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
  control.setAttribute("aria-describedby", `${id}-error`);
  error.id = `${id}-error`;
  return crear("div", { clase: "campo", attrs: { "data-campo": id } }, [
    crear("label", { texto: etiqueta, attrs: { for: id } }),
    crear("div", { clase: "campo--icono" }, [icono(nombreIcono, { tam: 18 }), control]),
    error,
  ]);
}

/**
 * @param {ModoAcceso} modo
 * @returns {() => Node}
 */
export function renderCorreo(modo) {
  return () => {
    const crearCuenta = modo === "crear";
    const previos = datosAcceso();
    const error = () => crear("p", { clase: "campo__error", attrs: { "aria-live": "polite" } });
    const errores = { nombre: error(), correo: error(), acepta: error(), general: error() };

    const nombre = /** @type {HTMLInputElement} */ (crear("input", { attrs: { type: "text", name: "nombre", autocomplete: "name", maxlength: 100, placeholder: "José Cámara" } }));
    nombre.value = previos.nombre;
    const correo = /** @type {HTMLInputElement} */ (
      crear("input", { attrs: { type: "email", name: "correo", autocomplete: "email", inputmode: "email", placeholder: "nombre@correo.com", required: true } })
    );
    correo.value = previos.correo;
    const acepta = /** @type {HTMLInputElement} */ (crear("input", { attrs: { type: "checkbox", name: "acepta", id: "acepta", "aria-describedby": "acepta-error" } }));
    errores.acepta.id = "acepta-error";

    const enviar = crearBoton("Enviar código", { tipo: "submit" });

    const formulario = crear(
      "form",
      {
        clase: "acceso__formulario",
        attrs: { novalidate: true },
        on: {
          submit: async (evento) => {
            evento.preventDefault();
            const { errores: fallos, datos } = validarFormularioAcceso({ modo, nombre: nombre.value, correo: correo.value, acepta: acepta.checked });
            for (const [clave, nodo] of Object.entries(errores)) nodo.textContent = /** @type {Record<string, string>} */ (fallos)[clave] ?? "";
            formulario.querySelectorAll("[data-campo]").forEach((nodo) => nodo.classList.toggle("campo--error", Boolean(/** @type {Record<string, string>} */ (fallos)[/** @type {HTMLElement} */ (nodo).dataset.campo ?? ""])));
            const primero = Object.keys(fallos)[0];
            if (primero) {
              /** @type {HTMLElement | null} */ (formulario.querySelector(`#${primero}`))?.focus();
              return;
            }
            enviar.disabled = true;
            try {
              await api.signInWithEmail(datos.correo);
              guardarDatosAcceso({ correo: datos.correo, nombre: crearCuenta ? datos.nombre : previos.nombre });
              ir("/acceso/codigo");
            } catch (fallo) {
              errores.general.textContent = mensajeDeError(fallo, {
                invalid_input: "Revisa tu correo e intenta de nuevo.",
                auth_failed: "No pudimos enviar el código. Intenta de nuevo.",
              });
              enviar.disabled = false;
            }
          },
        },
      },
      [
        crearCuenta ? crearPasosRegistro(1) : null,
        crear("h2", { clase: "acceso__titulo", texto: crearCuenta ? "Únete a MiXanab" : "Hola de nuevo" }),
        crear("p", { clase: "acceso__texto", texto: crearCuenta ? "Te enviaremos un código para verificar tu correo." : "Te enviaremos un código a tu correo para entrar." }),
        crearCuenta ? campo("nombre", "Nombre completo", nombre, "perfil", errores.nombre) : null,
        campo("correo", "Correo electrónico", correo, "correo", errores.correo),
        crearCuenta
          ? crear("div", { clase: "acceso__terminos", attrs: { "data-campo": "acepta" } }, [
              crear("label", { clase: "casilla casilla--terminos", attrs: { for: "acepta" } }, [acepta, crear("span", { texto: "Acepto los términos y el aviso de privacidad" })]),
              errores.acepta,
            ])
          : null,
        crear("div", { clase: "acceso__pie" }, [
          errores.general,
          enviar,
          crear("p", { clase: "acceso__reenviar" }, [
            crear("span", { texto: crearCuenta ? "¿Ya tienes cuenta? " : "¿Aún no tienes cuenta? " }),
            crear("a", { clase: "boton-texto", texto: crearCuenta ? "Inicia sesión" : "Crea una", attrs: { href: crearCuenta ? "#/acceso/entrar" : "#/acceso/crear" } }),
          ]),
        ]),
      ],
    );

    validarEnVivo(
      { nombre: crearCuenta ? nombre : null, correo },
      () => validarFormularioAcceso({ modo, nombre: nombre.value, correo: correo.value, acepta: true }).errores,
    );

    return crearPantalla({ titulo: crearCuenta ? "Crear cuenta" : "Iniciar sesión", volver: "/acceso", clase: "acceso" }, [formulario]);
  };
}
