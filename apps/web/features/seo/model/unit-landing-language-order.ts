import type { ContentLanguage } from "@rezics/i18n";

import { buildLocalizationLanguages } from "@/lib/localization";

export interface UnitLandingProfileLanguagePreferences {
	readonly preferredLanguages: readonly ContentLanguage[];
	readonly interfaceLanguage: ContentLanguage;
}

/**
 * Builds lookup hints without assigning semantic priority to any Unit localization.
 * An empty result deliberately delegates anonymous fallback to the Unit's stored position order.
 */
export function buildUnitLandingLocalizationLanguages(input: {
	readonly requestedLanguage?: ContentLanguage;
	readonly profile?: UnitLandingProfileLanguagePreferences;
}): ContentLanguage[] {
	const fallbackLanguages = input.profile
		? buildLocalizationLanguages(
				input.profile.preferredLanguages,
				input.profile.interfaceLanguage,
			)
		: [];
	return input.requestedLanguage
		? [
				input.requestedLanguage,
				...fallbackLanguages.filter((language) => language !== input.requestedLanguage),
			]
		: fallbackLanguages;
}
