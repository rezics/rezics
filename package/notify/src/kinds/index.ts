import {
  isSupportedLocale,
  resolveLocale,
  type SupportedLocale,
} from "./locale";

export type { SupportedLocale } from "./locale";
export { resolveLocale, SUPPORTED_LOCALES } from "./locale";

export interface KindRender {
  systemBody: string;
  emailSubject: string;
  emailText: string;
}

/**
 * Render any registered kind in the given locale.
 *
 * If `requested` is not in the supported set, falls back to the platform
 * default `en` (caller should usually pre-resolve via `resolveLocale`).
 */
export function renderKind(
  kind: string,
  payload: Record<string, unknown>,
  locale: string,
): KindRender {
  const safeLocale: SupportedLocale = isSupportedLocale(locale) ? locale : "en";
  const subject =
    typeof payload.emailSubject === "string" && payload.emailSubject.trim()
      ? payload.emailSubject
      : kind;
  const text =
    typeof payload.emailText === "string" && payload.emailText.trim()
      ? payload.emailText
      : subject;
  const systemBody =
    typeof payload.systemBody === "string" && payload.systemBody.trim()
      ? payload.systemBody
      : text;

  return {
    systemBody,
    emailSubject: subject,
    emailText: safeLocale === "en" ? text : text,
  };
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
