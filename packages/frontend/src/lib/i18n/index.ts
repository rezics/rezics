// ponytail: i18n setup — expand locale files when features are ported
export const defaultLocale = "en";
export const locales = ["en", "zh-hans", "zh-hant", "ja", "ko", "de"] as const;
export type Locale = (typeof locales)[number];
