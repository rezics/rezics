import type { ContentLanguage } from "@rezics/i18n";

import { buildLocalizationLanguages } from "@/lib/localization";

export interface UnitLandingProfileLanguagePreferences {
	readonly preferredLanguages: readonly ContentLanguage[];
	readonly interfaceLanguage: ContentLanguage;
}

/** Builds presentation hints before the Unit's stored localization order is used as a last resort. */
export function buildUnitLandingLocalizationLanguages(input: {
	readonly requestedLanguage?: ContentLanguage;
	readonly profile?: UnitLandingProfileLanguagePreferences;
	readonly interfaceLanguage: ContentLanguage;
	readonly browserLanguages?: readonly ContentLanguage[];
}): ContentLanguage[] {
	const fallbackLanguages = input.profile
		? buildLocalizationLanguages(
				input.profile.preferredLanguages,
				input.profile.interfaceLanguage,
				input.browserLanguages,
			)
		: buildLocalizationLanguages([], input.interfaceLanguage, input.browserLanguages);
	return input.requestedLanguage
		? [
				input.requestedLanguage,
				...fallbackLanguages.filter((language) => language !== input.requestedLanguage),
			]
		: fallbackLanguages;
}
