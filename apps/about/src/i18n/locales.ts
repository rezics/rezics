export const ABOUT_LOCALES = ["zh-hant", "zh-hans", "en", "ja", "de", "ko"] as const;

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
export const REZICS_APP_ORIGIN = "https://www.rezics.com";

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

export function normalizeLocaleTag(value: string): string {
	return value.trim().toLowerCase().replaceAll("_", "-");
}

export function matchAboutLocale(value: string): AboutLocale | undefined {
	const localeTag = normalizeLocaleTag(value);

	if (isAboutLocale(localeTag)) {
		return localeTag;
	}

	if (localeTag === "zh" || localeTag.startsWith("zh-")) {
		if (
			localeTag.startsWith("zh-hant") ||
			["zh-tw", "zh-hk", "zh-mo"].some((prefix) => localeTag.startsWith(prefix))
		) {
			return "zh-hant";
		}

		if (
			localeTag.startsWith("zh-hans") ||
			["zh-cn", "zh-sg"].some((prefix) => localeTag.startsWith(prefix))
		) {
			return "zh-hans";
		}

		return DEFAULT_LOCALE;
	}

	const baseLanguage = localeTag.split("-")[0];
	if (baseLanguage && isAboutLocale(baseLanguage)) {
		return baseLanguage;
	}

	return undefined;
}

function parseAcceptLanguage(acceptLanguage: string): string[] {
	return acceptLanguage
		.split(",")
		.map((entry, index) => {
			const [tag = "", ...parameters] = entry.trim().split(";");
			const qualityParameter = parameters.find((parameter) =>
				parameter.trim().startsWith("q="),
			);
			const quality = qualityParameter
				? Number.parseFloat(qualityParameter.trim().slice(2))
				: 1;

			return {
				index,
				tag,
				quality: Number.isFinite(quality) ? quality : 0,
			};
		})
		.filter((entry) => entry.tag.length > 0 && entry.quality > 0)
		.sort((left, right) => right.quality - left.quality || left.index - right.index)
		.map((entry) => entry.tag);
}

export function negotiateAboutLocale(acceptLanguage: string | null | undefined): AboutLocale {
	if (!acceptLanguage) {
		return DEFAULT_LOCALE;
	}

	for (const localeTag of parseAcceptLanguage(acceptLanguage)) {
		const matchedLocale = matchAboutLocale(localeTag);
		if (matchedLocale) {
			return matchedLocale;
		}
	}

	return DEFAULT_LOCALE;
}

export function getPagePath(locale: AboutLocale, page: AboutPageId): string {
	const pagePath = ABOUT_PAGE_PATHS[page];
	return pagePath ? `/${locale}/${pagePath}/` : `/${locale}/`;
}

export function getProductDetailPath(locale: AboutLocale, productSlug: string): string {
	return `/${locale}/product/${productSlug}/`;
}

export function getCanonicalUrl(locale: AboutLocale, page: AboutPageId): string {
	return `${ABOUT_SITE_ORIGIN}${getPagePath(locale, page)}`;
}

export function getAppEntryUrl(locale: AboutLocale): string {
	return `${REZICS_APP_ORIGIN}/${locale}/`;
}
