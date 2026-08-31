import { matchUiLocaleTag, toContentLanguage, type ContentLanguage } from "@rezics/i18n";

export function selectLocalization<T extends { language: string }>(
	items: readonly T[],
	locale?: string | null,
	fallback?: string | null,
): T | undefined {
	return (
		(locale ? items.find((item) => item.language === locale) : undefined) ??
		(fallback ? items.find((item) => item.language === fallback) : undefined) ??
		items[0]
	);
}

export function buildLocalizationLanguages(
	preferredLanguages: readonly ContentLanguage[],
	interfaceLanguage: ContentLanguage,
	fallbackLanguages: readonly ContentLanguage[] = [],
): ContentLanguage[] {
	const languages = new Set(preferredLanguages);
	languages.add(interfaceLanguage);
	for (const language of fallbackLanguages) languages.add(language);
	return [...languages];
}

export function contentLanguagesFromLocaleTags(tags: readonly string[]): ContentLanguage[] {
	const languages = new Set<ContentLanguage>();
	for (const tag of tags) {
		const locale = matchUiLocaleTag(tag);
		if (locale) languages.add(toContentLanguage(locale));
	}
	return [...languages];
}
