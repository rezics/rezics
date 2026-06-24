import { ApiError } from "@rezics/contract/api";
import { type DecisionCode, decisionCodes } from "@rezics/contract";

/**
 * A user-facing policy denial extracted from a failed mutation. `code` is the
 * server's `PolicyDecision` code; `message` is the server-provided safe
 * message when present (forms prefer it over the generic per-code copy).
 */
export interface PolicyDenial {
  code: DecisionCode;
  message?: string;
}

const DENIAL_CODES = new Set<DecisionCode>(
  decisionCodes.filter((code) => code !== "ALLOWED"),
);

function isDenialCode(code: string): code is DecisionCode {
  return DENIAL_CODES.has(code as DecisionCode);
}

/**
 * Read a `PolicyDenial` from a thrown error. Returns `null` for anything that
 * is not an `ApiError` carrying a recognized non-`ALLOWED` decision code, so
 * callers can fall back to their normal error handling. Denials surfaced as a
 * plain message (no structured `code`) are intentionally not matched here —
 * there is no decision code to drive an inline state.
 */
export function policyDenialFromError(error: unknown): PolicyDenial | null {
  if (!(error instanceof ApiError)) return null;
  if (!isDenialCode(error.code)) return null;
  return {
    code: error.code,
    ...(error.message ? { message: error.message } : {}),
  };
}
