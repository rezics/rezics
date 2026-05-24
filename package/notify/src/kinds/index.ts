import { SystemEmailKind } from "@rezics/contract";
import {
  isSupportedLocale,
  resolveLocale,
  type SupportedLocale,
} from "./locale";
import {
  type KindRender,
  renderApproved,
  renderPending,
  renderRejected,
} from "./work-link-claim";

export type { SupportedLocale } from "./locale";
export { resolveLocale, SUPPORTED_LOCALES } from "./locale";

/**
 * Render any registered kind in the given locale.
 *
 * If `requested` is not in the supported set, falls back to `en` per the spec
 * fallback chain (caller should usually pre-resolve via `resolveLocale`).
 */
export function renderKind(
  kind: string,
  payload: Record<string, unknown>,
  locale: string,
): KindRender {
  const safeLocale: SupportedLocale = isSupportedLocale(locale) ? locale : "en";
  switch (kind) {
    case SystemEmailKind.WORK_LINK_CLAIM_PENDING:
      return renderPending(safeLocale, {
        workTitle: payload["workTitle"] as string | undefined,
        releaseSummary: payload["releaseSummary"] as string | undefined,
      });
    case SystemEmailKind.WORK_LINK_CLAIM_APPROVED:
      return renderApproved(safeLocale, {
        workTitle: payload["workTitle"] as string | undefined,
      });
    case SystemEmailKind.WORK_LINK_CLAIM_REJECTED:
      return renderRejected(safeLocale, {
        workTitle: payload["workTitle"] as string | undefined,
        rejectReason: payload["rejectReason"] as string | undefined,
      });
    default:
      throw new Error(`renderKind: unknown kind "${kind}"`);
  }
}

export { resolveLocale as resolveSystemLocale };
export const FALLBACK_LOCALE: SupportedLocale = "en";

/**
 * Resolve a recipient's preferred locale using the fallback chain.
 * Currently we have no direct access to the user's preferredLanguage from
 * the notify DB; callers should pass it via `requested` if known.
 */
export function pickLocale(requested?: string | null): SupportedLocale {
  return resolveLocale(requested, undefined) as SupportedLocale;
}
