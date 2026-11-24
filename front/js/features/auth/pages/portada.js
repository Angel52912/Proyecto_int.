// Pantalla de inicio pública (cara de la PWA): marca, eslogan y acceso a iniciar sesión.
import { USAR_API_SIMULADA } from "../../../../../apis/config.js";
import { crear, enlace } from "../../../ui/dom.js";
import { icono } from "../../../ui/iconos.js";
import { crearPantalla } from "../../../ui/layout.js";
import { crearMarca } from "./bienvenida.js";

/** @returns {Node} */
export function renderPortada() {
  return crearPantalla({ clase: "portada" }, [
    crear("div", { clase: "portada__marca" }, [crearMarca()]),
    crear("h1", { clase: "portada__eslogan", texto: "No lo tires, restáuralo." }),
    enlace("/acceso", { clase: "boton boton--bloque portada__entrar", texto: "Iniciar sesión" }),
    USAR_API_SIMULADA
      ? enlace("/simulacion", { clase: "portada__simulado", attrs: { "aria-label": "Cambiar de rol (modo simulado)" } }, [icono("ajustes", { tam: 16 }), crear("span", { texto: "Modo simulado" })])
      : null,
  ]);
}
