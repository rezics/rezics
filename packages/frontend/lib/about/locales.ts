export const ABOUT_LOCALES = [
  "zh-hant",
  "zh-hans",
  "en",
  "ja",
  "de",
  "ko",
] as const;

export type AboutLocale = (typeof ABOUT_LOCALES)[number];

export const DEFAULT_LOCALE: AboutLocale = "zh-hant";
export const FALLBACK_LOCALE: AboutLocale = "en";

export const ABOUT_CONTENT_PAGES = ["home", "product"] as const;
export const ABOUT_LIBRARY_PAGES = ["game", "media"] as const;

export type AboutContentPageId = (typeof ABOUT_CONTENT_PAGES)[number];
export type AboutLibraryPageId = (typeof ABOUT_LIBRARY_PAGES)[number];

export const ABOUT_PAGES = [
  ...ABOUT_CONTENT_PAGES,
  ...ABOUT_LIBRARY_PAGES,
] as const;

export type AboutPageId = (typeof ABOUT_PAGES)[number];

export const ABOUT_PAGE_PATHS = {
  home: "",
  product: "product",
  game: "game",
  media: "media",
} as const satisfies Record<AboutPageId, string>;

export const ABOUT_SITE_ORIGIN = "https://about.rezics.com";
export const REZICS_APP_ORIGIN = "https://book.rezics.com";

export const ABOUT_LOCALE_META: Record<
  AboutLocale,
  { name: string; nativeName: string; htmlLang: string }
> = {
  "zh-hant": {
    name: "Traditional Chinese",
    nativeName: "繁體中文",
    htmlLang: "zh-Hant",
  },
  "zh-hans": {
    name: "Simplified Chinese",
    nativeName: "简体中文",
    htmlLang: "zh-Hans",
  },
  en: { name: "English", nativeName: "English", htmlLang: "en" },
  ja: { name: "Japanese", nativeName: "日本語", htmlLang: "ja" },
  de: { name: "German", nativeName: "Deutsch", htmlLang: "de" },
  ko: { name: "Korean", nativeName: "한국어", htmlLang: "ko" },
};

const ABOUT_LOCALE_SET = new Set<string>(ABOUT_LOCALES);

export function isAboutLocale(value: string): value is AboutLocale {
  return ABOUT_LOCALE_SET.has(value);
}

export function getPagePath(locale: AboutLocale, page: AboutPageId): string {
  const pagePath = ABOUT_PAGE_PATHS[page];
  return pagePath ? `/${locale}/${pagePath}/` : `/${locale}/`;
}

export function getCanonicalUrl(
  locale: AboutLocale,
  page: AboutPageId,
): string {
  return `${ABOUT_SITE_ORIGIN}${getPagePath(locale, page)}`;
}

export function getAppEntryUrl(locale: AboutLocale): string {
  return `${REZICS_APP_ORIGIN}/${locale}/`;
}
