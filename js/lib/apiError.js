/** Códigos de error del contrato (docs/contrato-api.md). */
export const CODIGOS_ERROR = Object.freeze([
  "not_authenticated",
  "forbidden",
  "inactive_user",
  "not_found",
  "invalid_input",
  "unexpected",
  "auth_failed",
  "invalid_code",
  "rate_limited",
  "role_already_set",
  "limit_reached",
  "invalid_state",
  "photo_required",
  "confirmation_required",
]);

/** Error de la capa api: `code` es siempre uno de CODIGOS_ERROR. */
export class ApiError extends Error {
  /**
   * @param {string} code
   * @param {string} [mensaje]
   */
  constructor(code, mensaje) {
    super(mensaje ?? code);
    this.name = "ApiError";
    this.code = CODIGOS_ERROR.includes(code) ? code : "unexpected";
  }
}

/**
 * Traduce un error de Supabase (Auth o PostgREST) a ApiError del contrato.
 * @param {unknown} error
 * @param {string} [porDefecto] código si no se reconoce el error
 * @returns {ApiError}
 */
export function traducirError(error, porDefecto = "unexpected") {
  if (error instanceof ApiError) return error;
  const e = /** @type {{ message?: string, code?: string, status?: number, statusCode?: string } | null} */ (error);
  const mensaje = typeof e?.message === "string" ? e.message : "";
  if (CODIGOS_ERROR.includes(mensaje)) return new ApiError(mensaje);
  if (e?.status === 429 || /rate_limit|over_.*_rate/i.test(e?.code ?? "")) return new ApiError("rate_limited");
  if (e?.code === "42501" || e?.statusCode === "403") return new ApiError("forbidden");
  if (e?.statusCode === "413" || e?.statusCode === "415") return new ApiError("invalid_input");
  if (e?.code === "23514" || e?.code === "22P02") return new ApiError("invalid_input");
  if (/otp_expired|otp_disabled/i.test(e?.code ?? "")) return new ApiError("invalid_code");
  return new ApiError(porDefecto);
}
