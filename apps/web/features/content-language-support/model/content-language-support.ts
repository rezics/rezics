import {
	type ContentLanguageChannel,
	type ContentLanguageSupport,
	type ContentLanguageSupportEntry,
	type ContentLanguageTag,
	canonicalizeContentLanguageTag,
	normalizeContentLanguageSupport,
} from "@rezics/content-language";
import { ContentLanguageValues, UiLocaleValues } from "@rezics/i18n";

export type ContentLanguageSupportDraft = ContentLanguageSupport;

/**
 * Bounded first-party authoring choices. The persistence/API contract remains
 * open to every canonical BCP 47 tag, including values introduced by imports
 * or related-Unit evidence.
 */
export const ContentLanguageEditorTagValues: readonly ContentLanguageTag[] = Object.freeze(
	[...new Set([...ContentLanguageValues, ...UiLocaleValues])].map((value) =>
		canonicalizeContentLanguageTag(value),
	),
);

export const ContentLanguageSupportUnitTypes = [
	"book",
	"software",
	"media",
	"video",
	"audio",
	"release",
] as const;

export type ContentLanguageSupportUnitType = (typeof ContentLanguageSupportUnitTypes)[number];

export function isContentLanguageSupportUnitType(
	value: string,
): value is ContentLanguageSupportUnitType {
	return ContentLanguageSupportUnitTypes.some((candidate) => candidate === value);
}

function replaceEntry(
	draft: ContentLanguageSupportDraft,
	nextEntry: ContentLanguageSupportEntry,
): ContentLanguageSupportDraft {
	return normalizeContentLanguageSupport([
		...draft.filter((entry) => entry.languageTag !== nextEntry.languageTag),
		nextEntry,
	]);
}

export function createContentLanguageSupportDraft(value: unknown): ContentLanguageSupportDraft {
	return normalizeContentLanguageSupport(value);
}

export function addContentLanguage(
	draft: ContentLanguageSupportDraft,
	languageTag: ContentLanguageTag,
): ContentLanguageSupportDraft {
	if (draft.some((entry) => entry.languageTag === languageTag)) return draft;
	return normalizeContentLanguageSupport([...draft, { languageTag }]);
}

export function removeContentLanguage(
	draft: ContentLanguageSupportDraft,
	languageTag: ContentLanguageTag,
): ContentLanguageSupportDraft {
	return normalizeContentLanguageSupport(
		draft.filter((entry) => entry.languageTag !== languageTag),
	);
}

export function toggleContentLanguageChannel(
	draft: ContentLanguageSupportDraft,
	languageTag: ContentLanguageTag,
	channel: ContentLanguageChannel,
): ContentLanguageSupportDraft {
	const current = draft.find((entry) => entry.languageTag === languageTag);
	if (!current) return replaceEntry(draft, { languageTag, channels: [channel] });
	const channels = current.channels ?? [];
	const nextChannels = channels.includes(channel)
		? channels.filter((candidate) => candidate !== channel)
		: [...channels, channel];
	return replaceEntry(
		draft,
		nextChannels.length ? { languageTag, channels: nextChannels } : { languageTag },
	);
}

/**
 * Adds one related Unit's declaration to the local editor draft.
 *
 * This is an explicit user action, not a computed field. A language-level
 * declaration dominates channel-specific evidence because omitted channels
 * mean that the related Unit did not qualify its support by channel.
 */
export function adoptContentLanguageEvidence(
	draft: ContentLanguageSupportDraft,
	evidenceValue: unknown,
): ContentLanguageSupportDraft {
	const evidence = normalizeContentLanguageSupport(evidenceValue);
	let next = draft;
	for (const candidate of evidence) {
		const current = next.find((entry) => entry.languageTag === candidate.languageTag);
		if (!current) {
			next = replaceEntry(next, candidate);
			continue;
		}
		if (!current.channels || !candidate.channels) {
			next = replaceEntry(next, { languageTag: candidate.languageTag });
			continue;
		}
		next = replaceEntry(next, {
			languageTag: candidate.languageTag,
			channels: [...new Set([...current.channels, ...candidate.channels])],
		});
	}
	return next;
}

export function contentLanguageSupportChanged(left: unknown, right: unknown): boolean {
	return (
		JSON.stringify(normalizeContentLanguageSupport(left)) !==
		JSON.stringify(normalizeContentLanguageSupport(right))
	);
}
