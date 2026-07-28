export const ABOUT_LOCALES = ["zh-hant"] as const;

export type AboutLocale = (typeof ABOUT_LOCALES)[number];

export const DEFAULT_LOCALE: AboutLocale = "zh-hant";

export const ABOUT_SITE_ORIGIN = "https://about.rezics.com";

export const ABOUT_LOCALE_META = {
	"zh-hant": {
		name: "Traditional Chinese",
		nativeName: "繁體中文",
		htmlLang: "zh-Hant",
	},
} as const satisfies Record<
	AboutLocale,
	{ readonly name: string; readonly nativeName: string; readonly htmlLang: string }
>;

export function isAboutLocale(value: string): value is AboutLocale {
	return value === DEFAULT_LOCALE;
}

export function normalizeLocaleTag(value: string): string {
	return value.trim().toLowerCase().replaceAll("_", "-");
}

export function matchAboutLocale(value: string): AboutLocale | undefined {
	const localeTag = normalizeLocaleTag(value);
	if (localeTag === "zh" || localeTag.startsWith("zh-")) return DEFAULT_LOCALE;
	return undefined;
}

export function negotiateAboutLocale(): AboutLocale {
	return DEFAULT_LOCALE;
}
