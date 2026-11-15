import { ChatScreen } from "./view.js";

/** @type {ReadonlyArray<import("../../router.js").Ruta>} */
export const rutas = [{ path: "/chat/:pedidoId", render: ChatScreen }];
