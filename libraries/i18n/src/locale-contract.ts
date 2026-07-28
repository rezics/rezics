export const UiLocaleValues = ["en", "zh-Hant", "zh-Hans", "ja", "ko", "de", "fr", "es"] as const;
export type UiLocale = (typeof UiLocaleValues)[number];

/**
 * UI locale values are stored in their canonical BCP 47 form. Keeping the
 * storage name explicit documents the database/API boundary without
 * introducing a second representation of the same locale.
 */
export const StoredUiLocaleValues = UiLocaleValues;
export type StoredUiLocale = UiLocale;

export const DefaultStoredUiLocale = "zh-Hant" satisfies StoredUiLocale;

const UiLocaleSet = new Set<string>(UiLocaleValues);

export function isStoredUiLocale(value: string): value is StoredUiLocale {
	return isUiLocale(value);
}

export function isUiLocale(value: string): value is UiLocale {
	return UiLocaleSet.has(value);
}

export function matchUiLocaleTag(value: string): UiLocale | undefined {
	let locale: Intl.Locale;
	try {
		locale = new Intl.Locale(value.replaceAll("_", "-"));
	} catch {
		return undefined;
	}

	const canonical = locale.toString();
	if (isUiLocale(canonical)) return canonical;
	if (locale.language === "zh") {
		if (locale.script === "Hant" || ["TW", "HK", "MO"].includes(locale.region ?? ""))
			return "zh-Hant";
		if (locale.script === "Hans" || ["CN", "SG"].includes(locale.region ?? ""))
			return "zh-Hans";
		// REZICS deliberately keeps its Traditional Chinese house default.
		return "zh-Hant";
	}
	return isUiLocale(locale.language) ? locale.language : undefined;
}

export function toUiLocale(value: StoredUiLocale): UiLocale {
	return value;
}

export function toStoredUiLocale(locale: UiLocale): StoredUiLocale {
	return locale;
}

/**
 * Content-language groups currently supported across authoring, discovery,
 * moderation, and localization storage.
 *
 * @todo Add canonical BCP 47 `yue` only after Cantonese is supported end to end.
 */
export const ContentLanguageValues = ["zh", "en", "ja", "ko", "de", "fr", "es"] as const;
export type ContentLanguage = (typeof ContentLanguageValues)[number];

export const DeliveryLocaleValues = ContentLanguageValues;
export type DeliveryLocale = (typeof DeliveryLocaleValues)[number];

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
		case "de":
			return "de";
		case "es":
			return "es";
		case "fr":
			return "fr";
		case "ja":
			return "ja";
		case "ko":
			return "ko";
		case "zh-Hans":
		case "zh-Hant":
			return "zh";
	}
}

export function toDeliveryLocale(locale: UiLocale): DeliveryLocale {
	return toContentLanguage(locale);
}

export const ChineseContentDisplayValues = ["original", "hant", "hans"] as const;
export type ChineseContentDisplay = (typeof ChineseContentDisplayValues)[number];

export const DefaultChineseContentDisplay = "original" satisfies ChineseContentDisplay;

const ChineseContentDisplaySet = new Set<string>(ChineseContentDisplayValues);

export function isChineseContentDisplay(value: string): value is ChineseContentDisplay {
	return ChineseContentDisplaySet.has(value);
}
