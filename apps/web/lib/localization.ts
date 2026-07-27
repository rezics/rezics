import type { ContentLanguage } from "@rezics/i18n";

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
): ContentLanguage[] {
	return preferredLanguages.includes(interfaceLanguage)
		? [...preferredLanguages]
		: [...preferredLanguages, interfaceLanguage];
}
