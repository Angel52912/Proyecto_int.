// 04 · Elegir rol (CU-01): "Soy cliente" o "Soy artesano". Se elige una sola vez (`set_my_role`); el mockup dice
// "Puedes cambiarlo después", pero el backend no lo permite, así que el texto avisa que es definitivo.
import { crear, ir } from "../../../ui/dom.js";
import { icono } from "../../../ui/iconos.js";
import { crearBoton, crearPantalla } from "../../../ui/layout.js";
import { mensajeDeError } from "../../../ui/mensajes.js";
import { continuarTrasEntrar } from "../flujo.js";
import { olvidarPerfil, sincronizarSesionSimulada } from "../guardia.js";
import { api } from "../index.js";

export const OPCIONES_ROL = Object.freeze([
  { valor: /** @type {const} */ ("client"), titulo: "Soy cliente", detalle: "Quiero reparar o limpiar mi calzado", icono: "perfil" },
  { valor: /** @type {const} */ ("craftsman"), titulo: "Soy artesano", detalle: "Tengo un taller y ofrezco servicios", icono: "reparacion" },
]);

/** @returns {Node} */
export function renderRol() {
  const aviso = crear("p", { clase: "campo__error", attrs: { "aria-live": "polite" } });
  const continuar = crearBoton("Continuar", { tipo: "submit" });

  const opciones = OPCIONES_ROL.map((opcion) =>
    crear("label", { clase: "rol-opcion" }, [
      crear("span", { clase: "rol-opcion__icono", attrs: { "aria-hidden": "true" } }, [icono(opcion.icono, { tam: 28 })]),
      crear("span", { clase: "rol-opcion__texto" }, [crear("p", { clase: "rol-opcion__titulo", texto: opcion.titulo }), crear("p", { clase: "rol-opcion__detalle", texto: opcion.detalle })]),
      crear("input", { attrs: { type: "radio", name: "rol", value: opcion.valor } }),
    ]),
  );

  const formulario = /** @type {HTMLFormElement} */ (
    crear(
      "form",
      {
        clase: "acceso__formulario",
        on: {
          submit: async (evento) => {
            evento.preventDefault();
            const elegido = /** @type {HTMLInputElement | null} */ (formulario.querySelector('input[name="rol"]:checked'));
            if (elegido === null) {
              aviso.textContent = "Elige una opción para continuar.";
              return;
            }
            continuar.disabled = true;
            aviso.textContent = "";
            try {
              const { role } = await api.setMyRole(elegido.value);
              olvidarPerfil();
              await sincronizarSesionSimulada({ sesion: true, rol: role });
              ir("/acceso/perfil");
            } catch (error) {
              // Si ya tenía rol, se le lleva a donde le toca en lugar de mostrar un error.
              if (/** @type {any} */ (error)?.code === "role_already_set") {
                await continuarTrasEntrar().catch(() => ir("/acceso"));
                return;
              }
              aviso.textContent = mensajeDeError(error);
              continuar.disabled = false;
            }
          },
        },
      },
      [
        crear("h2", { clase: "acceso__titulo", texto: "¿Cómo usarás MiXanab?" }),
        crear("p", { clase: "acceso__texto", texto: "Solo lo eliges una vez; después no se puede cambiar." }),
        crear("fieldset", { clase: "rol-opciones" }, [crear("legend", { clase: "oculto-visual", texto: "Tipo de cuenta" }), ...opciones]),
        crear("div", { clase: "acceso__pie" }, [aviso, continuar]),
      ],
    )
  );

  return crearPantalla({ titulo: "Tu perfil", clase: "acceso" }, [formulario]);
}
