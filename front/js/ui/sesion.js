import { USAR_API_SIMULADA } from "../config.js";

/**
 * Con la API simulada no hay Supabase configurado y `js/app.js` reporta "sin sesión", así que las pantallas solo
 * exigen sesión al router con la API real. Con la simulada la sesión la llevan los api.mock.js (cliente por defecto).
 */
export const REQUIERE_SESION = !USAR_API_SIMULADA;
