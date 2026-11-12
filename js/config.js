// Configuración pública del frontend. La anon key puede ir aquí; la service_role NUNCA.
// Reemplaza los valores con los de tu proyecto de Supabase (Settings → API).
export const SUPABASE_URL = "https://REEMPLAZAR.supabase.co";
export const SUPABASE_ANON_KEY = "REEMPLAZAR";

// true: cada módulo usa api.mock.js (sin Docker ni Supabase). Cambiar a false al conectar el backend.
export const USAR_API_SIMULADA = true;
