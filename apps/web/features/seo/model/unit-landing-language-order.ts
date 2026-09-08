import type { ContentLanguage } from "@rezics/i18n";
import { canonicalizeContentLanguageTag, type ContentLanguageTag } from "@rezics/content-language";
export interface UnitLandingProfileLanguagePreferences {
	readonly preferredLanguages: readonly ContentLanguage[];
	readonly interfaceLanguage: ContentLanguage;
}
/** Canonical native name preferences retain region and script; unknown source languages stay unknown. */
export function buildUnitLandingLocalizationLanguages(input: {
	readonly requestedLanguage?: ContentLanguage | ContentLanguageTag;
	readonly profile?: UnitLandingProfileLanguagePreferences;
	readonly interfaceLanguage: ContentLanguage;
	readonly browserLanguages?: readonly string[];
}): ContentLanguageTag[] {
	const values = [
		...(input.requestedLanguage ? [input.requestedLanguage] : []),
		...(input.profile?.preferredLanguages ?? []),
		input.profile?.interfaceLanguage ?? input.interfaceLanguage,
		...(input.browserLanguages ?? []),
	];
	const result = new Set<ContentLanguageTag>();
	for (const value of values) {
		try {
			result.add(canonicalizeContentLanguageTag(value));
		} catch {
			/* Invalid browser hints do not become persisted language claims. */
		}
		if (result.size === 32) break;
	}
	return [...result];
}
