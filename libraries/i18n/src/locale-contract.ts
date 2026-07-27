export const StoredUiLocaleValues = ["en", "zh-hant"] as const;
export type StoredUiLocale = (typeof StoredUiLocaleValues)[number];

export const UiLocaleByStoredValue = {
	en: "en",
	"zh-hant": "zh-Hant",
} as const satisfies Record<StoredUiLocale, string>;

export type UiLocale = (typeof UiLocaleByStoredValue)[StoredUiLocale];

export const UiLocaleValues = ["en", "zh-Hant"] as const satisfies readonly UiLocale[];

export const DefaultStoredUiLocale = "zh-hant" satisfies StoredUiLocale;

const UiLocaleSet = new Set<string>(UiLocaleValues);

export function isStoredUiLocale(value: string): value is StoredUiLocale {
	return Object.hasOwn(UiLocaleByStoredValue, value);
}

export function isUiLocale(value: string): value is UiLocale {
	return UiLocaleSet.has(value);
}

export function toUiLocale(value: StoredUiLocale): UiLocale {
	return UiLocaleByStoredValue[value];
}

export function toStoredUiLocale(locale: UiLocale): StoredUiLocale {
	switch (locale) {
		case "en":
			return "en";
		case "zh-Hant":
			return "zh-hant";
	}
}

/**
 * Content-language groups currently supported across authoring, discovery,
 * moderation, and localization storage.
 *
 * @todo Add canonical BCP 47 `yue` only after Cantonese is supported end to end.
 */
export const ContentLanguageValues = ["zh", "en"] as const;
export type ContentLanguage = (typeof ContentLanguageValues)[number];

export const DefaultContentLanguage = "zh" satisfies ContentLanguage;
export const DefaultPreferredLanguage = "en" satisfies ContentLanguage;

const ContentLanguageSet = new Set<string>(ContentLanguageValues);

export function isContentLanguage(value: string): value is ContentLanguage {
	return ContentLanguageSet.has(value);
}

export function toContentLanguage(locale: UiLocale): ContentLanguage {
	switch (locale) {
		case "en":
			return "en";
		case "zh-Hant":
			return "zh";
	}
}
