import type { DashboardSectionResult } from "@rezics/contract";

/** Wrap a fan-out section so one source failing never fails the response. */
export async function section<T>(
  load: () => Promise<T>,
  code = "SECTION_FAILED",
): Promise<DashboardSectionResult<T>> {
  try {
    return { ok: await load() };
  } catch {
    return { error: { code, retryable: true } };
  }
}

/**
 * Sections the server does not aggregate yet (they live in the notify
 * service or have no unified server source). The client fetches these
 * through their dedicated `@rezics/api` hooks; the dashboard reports a
 * non-retryable "not aggregated here" marker so the UI can decide to fetch
 * directly rather than show a transient error.
 */
export function notAggregated(): {
  error: { code: string; retryable: boolean };
} {
  return { error: { code: "NOT_AGGREGATED", retryable: false } };
}
