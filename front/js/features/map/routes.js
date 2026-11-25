import { soloPara } from "../auth/guardia.js";
import { REQUIERE_SESION } from "../../ui/sesion.js";
import { renderPrincipal } from "./pages/inicio.js";
import { renderMapa } from "./pages/mapa.js";
import { renderTalleres } from "./pages/talleres.js";
import { renderPerfilTaller } from "./pages/perfil-taller.js";

/** @type {ReadonlyArray<import("../../router.js").Ruta>} */
export const rutas = [
  { path: "/principal", requiereSesion: REQUIERE_SESION, render: soloPara(["client"], renderPrincipal) },
  { path: "/mapa", requiereSesion: REQUIERE_SESION, render: soloPara(["client"], renderMapa) },
  { path: "/talleres", requiereSesion: REQUIERE_SESION, render: soloPara(["client"], renderTalleres) },
  { path: "/taller/:id", requiereSesion: REQUIERE_SESION, render: soloPara(["client"], renderPerfilTaller) },
];
