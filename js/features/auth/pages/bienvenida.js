// 01 · Bienvenida (CU-01): Iniciar sesión, Crear cuenta y Continuar con Google.
import { USAR_API_SIMULADA } from "../../../config.js";
import { crear, enlace, ir } from "../../../ui/dom.js";
import { icono } from "../../../ui/iconos.js";
import { crearPantalla } from "../../../ui/layout.js";
import { mensajeDeError } from "../../../ui/mensajes.js";
import { continuarTrasEntrar } from "../flujo.js";
import { destinoPorPerfil, obtenerPerfilActual } from "../guardia.js";
import { api } from "../index.js";

/** @returns {HTMLElement} */
export function crearMarca() {
  return crear("p", { clase: "acceso__marca" }, [crear("span", { clase: "acceso__logo", attrs: { "aria-hidden": "true" } }, [icono("reparacion", { tam: 24 })]), "MiXanab"]);
}

/** @returns {Node} */
export function renderBienvenida() {
  const aviso = crear("p", { clase: "campo__error", attrs: { "aria-live": "polite" } });

  const google = /** @type {HTMLButtonElement} */ (
    crear(
      "button",
      {
        clase: "boton boton--bloque boton--blanco",
        attrs: { type: "button" },
        on: {
          click: async () => {
            google.disabled = true;
            aviso.textContent = "";
            try {
              await api.signInWithGoogle();
              // Con Supabase el navegador sale a Google y vuelve a la app; el simulado entra de inmediato.
              if (USAR_API_SIMULADA) await continuarTrasEntrar();
            } catch (error) {
              aviso.textContent = mensajeDeError(error, { auth_failed: "No pudimos conectar con Google. Intenta de nuevo." });
              google.disabled = false;
            }
          },
        },
      },
      [crear("span", { clase: "google-g", texto: "G", attrs: { "aria-hidden": "true" } }), crear("span", { texto: "Continuar con Google" })],
    )
  );

  // Si ya hay sesión (por ejemplo, al volver de Google), se continúa sin pasar por la bienvenida.
  if (!USAR_API_SIMULADA) {
    obtenerPerfilActual()
      .then((perfil) => {
        if (perfil !== null) ir(destinoPorPerfil(perfil));
      })
      .catch(() => {});
  }

  return crearPantalla({ clase: "acceso acceso--bienvenida" }, [
    crearMarca(),
    crear("div", { clase: "acceso__ilustracion", attrs: { "aria-hidden": "true" } }, [
      crear("span", { clase: "acceso__chip", texto: "Mérida, Yuc." }),
      crear("span", { clase: "acceso__circulo" }, [icono("reparacion", { tam: 72 })]),
    ]),
    crear("h1", { clase: "acceso__titulo", texto: "No lo tires, restáuralo." }),
    crear("p", { clase: "acceso__texto", texto: "Encuentra talleres de calzado y talabartería cerca de ti y sigue tu pedido paso a paso." }),
    crear("div", { clase: "acceso__pie" }, [
      enlace("/acceso/entrar", { clase: "boton boton--bloque", texto: "Iniciar sesión" }),
      enlace("/acceso/crear", { clase: "boton boton--bloque boton--secundario", texto: "Crear cuenta" }),
      google,
      aviso,
    ]),
  ]);
}
