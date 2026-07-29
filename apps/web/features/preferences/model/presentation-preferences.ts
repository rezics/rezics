import {
	isChineseContentDisplay,
	isContentLanguage,
	isStoredUiLocale,
	type ChineseContentDisplay,
	type ContentLanguage,
	type StoredUiLocale,
} from "@rezics/i18n";

export interface PresentationPreferences {
	readonly profileId: string;
	readonly interfaceLocale: StoredUiLocale;
	readonly chineseContentDisplay: ChineseContentDisplay;
	readonly filterFeedByPreferredLanguages: boolean;
	readonly preferredLanguages: readonly ContentLanguage[];
}

export const PresentationPreferencesQueryKey = ["current-user-presentation-preferences"] as const;

export function presentationPreferencesQueryKey(accountId: string | null) {
	return [...PresentationPreferencesQueryKey, accountId] as const;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parsePresentationPreferences(value: unknown): PresentationPreferences | undefined {
	if (!isRecord(value)) return undefined;
	const preferredLanguages = value.preferredLanguages;
	if (
		typeof value.profileId !== "string" ||
		typeof value.interfaceLocale !== "string" ||
		!isStoredUiLocale(value.interfaceLocale) ||
		typeof value.chineseContentDisplay !== "string" ||
		!isChineseContentDisplay(value.chineseContentDisplay) ||
		typeof value.filterFeedByPreferredLanguages !== "boolean" ||
		!Array.isArray(preferredLanguages) ||
		!preferredLanguages.every(
			(language): language is ContentLanguage =>
				typeof language === "string" && isContentLanguage(language),
		) ||
		new Set(preferredLanguages).size !== preferredLanguages.length
	)
		return undefined;

	return {
		profileId: value.profileId,
		interfaceLocale: value.interfaceLocale,
		chineseContentDisplay: value.chineseContentDisplay,
		filterFeedByPreferredLanguages: value.filterFeedByPreferredLanguages,
		preferredLanguages: [...preferredLanguages],
	};
}
