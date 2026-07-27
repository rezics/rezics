import type { ContentLanguage } from "@rezics/i18n";

export function resolveFeedFilterLanguages(input: {
	readonly allowDefault: boolean;
	readonly defaultInitialized: boolean;
	readonly filterByPreferredLanguages: boolean;
	readonly preferredLanguages: readonly ContentLanguage[];
	readonly requestedLanguages: readonly ContentLanguage[];
}): readonly ContentLanguage[] {
	if (
		input.allowDefault &&
		!input.defaultInitialized &&
		input.requestedLanguages.length === 0 &&
		input.filterByPreferredLanguages
	)
		return input.preferredLanguages;
	return input.requestedLanguages;
}
