// Punto de entrada del módulo: elige la API real o la simulada según USAR_API_SIMULADA (apis/config.js).
// Las pantallas importan `api` de aquí y nunca de api.js ni de Supabase.
import { USAR_API_SIMULADA } from "../../../../apis/config.js";
import * as real from "../../../../apis/api-mixanab/requests/api.js";
import * as simulada from "../../../../apis/api-mixanab/requests/api.mock.js";

export const api = USAR_API_SIMULADA ? simulada : real;
