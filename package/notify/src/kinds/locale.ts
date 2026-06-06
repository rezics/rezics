export const SUPPORTED_LOCALES = [
  "en",
  "zh-hans",
  "zh-hant",
  "ja",
  "de",
] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

const LOCALE_SET = new Set<string>(SUPPORTED_LOCALES);

/**
 * Resolve the rendering locale via the existing fallback chain:
 * requested → user default → platform `en` → first available.
 */
export function resolveLocale(
  requested: string | null | undefined,
  userDefault: string | null | undefined,
  available: string[] = [...SUPPORTED_LOCALES],
): string {
  const candidates = [requested, userDefault, "en", available[0]].filter(
    (x): x is string => typeof x === "string" && x.length > 0,
  );
  for (const candidate of candidates) {
    if (available.includes(candidate)) return candidate;
  }
  return available[0] ?? "en";
}

export function isSupportedLocale(locale: string): locale is SupportedLocale {
  return LOCALE_SET.has(locale);
}
