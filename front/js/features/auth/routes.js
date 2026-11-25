import { REQUIERE_SESION } from "../../ui/sesion.js";
import { soloPara } from "./guardia.js";
import { renderBienvenida } from "./pages/bienvenida.js";
import { renderCodigo } from "./pages/codigo.js";
import { renderCompletarPerfil } from "./pages/completar-perfil.js";
import { renderCorreo } from "./pages/correo.js";
import { renderPerfilCliente } from "./pages/perfil-cliente.js";
import { renderPortada } from "./pages/portada.js";
import { renderRol } from "./pages/rol.js";

/** @type {ReadonlyArray<import("../../router.js").Ruta>} */
export const rutas = [
  { path: "/", render: renderPortada },
  { path: "/inicio", render: renderPortada },
  // 01–05 · Acceso (CU-01). `/acceso` es RUTA_ACCESO del router.
  { path: "/acceso", render: renderBienvenida },
  { path: "/acceso/entrar", render: renderCorreo("entrar") },
  { path: "/acceso/crear", render: renderCorreo("crear") },
  { path: "/acceso/codigo", render: renderCodigo },
  { path: "/acceso/rol", requiereSesion: REQUIERE_SESION, render: renderRol },
  { path: "/acceso/perfil", requiereSesion: REQUIERE_SESION, render: renderCompletarPerfil },
  { path: "/perfil", requiereSesion: REQUIERE_SESION, render: soloPara(["client"], renderPerfilCliente) },
];
