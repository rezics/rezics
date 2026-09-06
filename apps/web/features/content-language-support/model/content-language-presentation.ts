import {
	ContentLanguageChannelValues,
	type ContentLanguageChannel,
	type ContentLanguageSupport,
	type ContentLanguageTag,
} from "@rezics/content-language";

export interface ContentLanguageSupportGroup {
	readonly channel: ContentLanguageChannel | null;
	readonly languageTags: readonly ContentLanguageTag[];
}

export function groupContentLanguageSupport(
	entries: ContentLanguageSupport,
): readonly ContentLanguageSupportGroup[] {
	const grouped = new Map<ContentLanguageChannel | null, ContentLanguageTag[]>(
		ContentLanguageChannelValues.map((channel) => [channel, []]),
	);
	grouped.set(null, []);
	for (const entry of entries) {
		if (!entry.channels) grouped.get(null)?.push(entry.languageTag);
		else for (const channel of entry.channels) grouped.get(channel)?.push(entry.languageTag);
	}
	return [...ContentLanguageChannelValues, null].flatMap((channel) => {
		const languageTags = grouped.get(channel) ?? [];
		return languageTags.length ? [{ channel, languageTags }] : [];
	});
}

const LanguageDisplayNames = new Map<string, Intl.DisplayNames>();

export function formatContentLanguageName(locale: string, languageTag: string): string {
	try {
		// Do not label a distinct IANA language with a CLDR replacement's name.
		if (new Intl.Locale(languageTag).toString().toLowerCase() !== languageTag.toLowerCase())
			return languageTag;
		let displayNames = LanguageDisplayNames.get(locale);
		if (!displayNames) {
			displayNames = new Intl.DisplayNames([locale], {
				fallback: "none",
				languageDisplay: "dialect",
				type: "language",
			});
			LanguageDisplayNames.set(locale, displayNames);
		}
		return displayNames.of(languageTag) ?? languageTag;
	} catch (error) {
		if (!(error instanceof RangeError)) throw error;
		return languageTag;
	}
}
