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

export const ABOUT_PAGES = ["home", "product"] as const;

export type AboutPageId = (typeof ABOUT_PAGES)[number];

export const ABOUT_PAGE_PATHS = {
  home: "",
  product: "product",
} as const satisfies Record<AboutPageId, string>;

export const ABOUT_SITE_ORIGIN = "https://about.rezics.com";
// The about site is static; signed-in catalog workflows live at the product origin.
// about 站点是静态的；登录后的目录工作流位于 product origin。
export const REZICS_APP_ORIGIN = "https://book.rezics.com";

// Keep these values aligned with package/contract/src/language-core.ts while
// avoiding a dependency on shared app runtime i18n namespaces.
// 保持这些值与 package/contract/src/language-core.ts 一致，同时避免依赖共享的应用
// 运行时 i18n 命名空间。
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
