// ============================================================
// CANONICAL LANGUAGE CODES
// ============================================================

export const LANGUAGES = {
  ZH_HANT: "zh-hant",
  ZH_HANS: "zh-hans",
  EN: "en",
  JA: "ja",
  DE: "de",
  KO: "ko",
} as const;

export type Language = (typeof LANGUAGES)[keyof typeof LANGUAGES];

// ============================================================
// DISPLAY METADATA
// ============================================================

export const LANGUAGE_META: Record<
  Language,
  { name: string; nativeName: string }
> = {
  "zh-hant": { name: "Traditional Chinese", nativeName: "繁體中文" },
  "zh-hans": { name: "Simplified Chinese", nativeName: "简体中文" },
  en: { name: "English", nativeName: "English" },
  ja: { name: "Japanese", nativeName: "日本語" },
  de: { name: "German", nativeName: "Deutsch" },
  ko: { name: "Korean", nativeName: "한국어" },
};

// ============================================================
// DEFAULTS
// ============================================================

export const DEFAULT_LANGUAGE: Language = "zh-hant";
export const FALLBACK_LANGUAGE: Language = "en";

const ALL_CANONICAL = new Set<string>(Object.values(LANGUAGES));

/**
 * Normalize a language code to its canonical form.
 * Handles case-insensitive matching against canonical codes.
 * Returns null for unknown codes.
 */
export function normalizeLanguage(code: string): Language | null {
  const lower = code.toLowerCase();
  if (ALL_CANONICAL.has(lower)) return lower as Language;

  return null;
}
