import { REQUIERE_SESION } from "../../ui/sesion.js";
import { soloPara } from "../auth/guardia.js";
import { renderBitacora } from "./pages/bitacora.js";
import { renderPedidosAdmin, renderSolicitudesAdmin } from "./pages/consultas.js";
import { renderPanel } from "./pages/panel.js";
import { renderResenas } from "./pages/resenas.js";
import { renderTalleresAdmin } from "./pages/talleres.js";
import { renderUsuarios } from "./pages/usuarios.js";

/** Solo el admin activo abre estas rutas (CU-08). */
const ADMIN = /** @type {const} */ (["admin"]);

/** @type {ReadonlyArray<import("../../router.js").Ruta>} */
export const rutas = [
  { path: "/admin", requiereSesion: REQUIERE_SESION, render: soloPara(ADMIN, renderPanel) },
  { path: "/admin/usuarios", requiereSesion: REQUIERE_SESION, render: soloPara(ADMIN, renderUsuarios) },
  { path: "/admin/talleres", requiereSesion: REQUIERE_SESION, render: soloPara(ADMIN, renderTalleresAdmin) },
  { path: "/admin/resenas", requiereSesion: REQUIERE_SESION, render: soloPara(ADMIN, renderResenas) },
  { path: "/admin/solicitudes", requiereSesion: REQUIERE_SESION, render: soloPara(ADMIN, renderSolicitudesAdmin) },
  { path: "/admin/pedidos", requiereSesion: REQUIERE_SESION, render: soloPara(ADMIN, renderPedidosAdmin) },
  { path: "/admin/bitacora", requiereSesion: REQUIERE_SESION, render: soloPara(ADMIN, renderBitacora) },
];
