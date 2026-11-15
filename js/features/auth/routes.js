import { REQUIERE_SESION } from "../../ui/sesion.js";
import { renderPerfilCliente } from "./pages/perfil-cliente.js";

/** @type {ReadonlyArray<import("../../router.js").Ruta>} */
export const rutas = [{ path: "/perfil", requiereSesion: REQUIERE_SESION, render: renderPerfilCliente }];
