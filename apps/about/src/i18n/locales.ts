export const ABOUT_LOCALES = ["zh-hant", "zh-hans", "en", "ja", "de", "ko"] as const;

export type AboutLocale = (typeof ABOUT_LOCALES)[number];

export const DEFAULT_LOCALE = "zh-hant" as const satisfies AboutLocale;
export type FallbackLocale = Exclude<AboutLocale, typeof DEFAULT_LOCALE>;

export const ABOUT_LOCALE_FALLBACKS = {
	"zh-hans": DEFAULT_LOCALE,
	en: DEFAULT_LOCALE,
	ja: DEFAULT_LOCALE,
	de: DEFAULT_LOCALE,
	ko: DEFAULT_LOCALE,
} as const satisfies Record<FallbackLocale, AboutLocale>;

export const ABOUT_SITE_ORIGIN = "https://about.rezics.com";
export const REZICS_APP_ORIGIN = "https://www.rezics.com";

export const ABOUT_LOCALE_META = {
	"zh-hant": {
		nativeName: "繁體中文",
		htmlLang: "zh-Hant",
	},
	"zh-hans": {
		nativeName: "简体中文",
		htmlLang: "zh-Hans",
	},
	en: { nativeName: "English", htmlLang: "en" },
	ja: { nativeName: "日本語", htmlLang: "ja" },
	de: { nativeName: "Deutsch", htmlLang: "de" },
	ko: { nativeName: "한국어", htmlLang: "ko" },
} as const satisfies Record<
	AboutLocale,
	{ readonly nativeName: string; readonly htmlLang: string }
>;

const localeSet: ReadonlySet<string> = new Set(ABOUT_LOCALES);

export function isAboutLocale(value: string): value is AboutLocale {
	return localeSet.has(value);
}

export function requireAboutLocale(value: string | undefined): AboutLocale {
	if (value && isAboutLocale(value)) return value;
	throw new Error(`Unsupported About locale: ${value ?? "missing"}`);
}

export function getAboutLocaleFallback(locale: AboutLocale): AboutLocale | undefined {
	return locale === DEFAULT_LOCALE ? undefined : ABOUT_LOCALE_FALLBACKS[locale];
}

export function normalizeLocaleTag(value: string): string {
	return value.trim().toLowerCase().replaceAll("_", "-");
}

export function matchAboutLocale(value: string): AboutLocale | undefined {
	const localeTag = normalizeLocaleTag(value);
	if (isAboutLocale(localeTag)) return localeTag;

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
	return baseLanguage && isAboutLocale(baseLanguage) ? baseLanguage : undefined;
}

function parseAcceptLanguage(value: string): readonly string[] {
	return value
		.split(",")
		.map((entry, index) => {
			const [tag = "", ...parameters] = entry.trim().split(";");
			const qualityValue = parameters
				.find((parameter) => parameter.trim().startsWith("q="))
				?.trim()
				.slice(2);
			const quality = qualityValue ? Number.parseFloat(qualityValue) : 1;
			return {
				tag,
				index,
				quality: Number.isFinite(quality) ? quality : 0,
			};
		})
		.filter(({ tag, quality }) => tag.length > 0 && quality > 0)
		.sort((left, right) => right.quality - left.quality || left.index - right.index)
		.map(({ tag }) => tag);
}

export function negotiateAboutLocale(acceptLanguage: string | null | undefined): AboutLocale {
	if (!acceptLanguage) return DEFAULT_LOCALE;
	for (const tag of parseAcceptLanguage(acceptLanguage)) {
		const locale = matchAboutLocale(tag);
		if (locale) return locale;
	}
	return DEFAULT_LOCALE;
}

export function getAppEntryUrl(): string {
	return `${REZICS_APP_ORIGIN}/`;
}
