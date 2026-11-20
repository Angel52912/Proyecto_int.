// Punto de entrada del módulo: elige la API real o la simulada según USAR_API_SIMULADA (js/config.js).
// Las pantallas importan `api` de aquí y nunca de api.js ni de Supabase.
import { USAR_API_SIMULADA } from "../../config.js";
import * as real from "./api.js";
import * as simulada from "./api.mock.js";

export const api = USAR_API_SIMULADA ? simulada : real;
