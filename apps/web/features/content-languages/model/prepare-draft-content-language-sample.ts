const CodeBlockPattern = /```[\s\S]*?```|`[^`]*`/gu;
const UrlPattern = /\b(?:https?:\/\/|www\.)\S+/giu;
const MentionPattern = /(?:^|\s)@[\p{L}\p{N}_.-]+/gu;
const NonLetterPattern = /[^\p{L}\s]+/gu;
const WhitespacePattern = /\s+/gu;
const LetterPattern = /\p{L}/gu;

export const MinimumDraftContentLanguageDetectionLetters = 8;
export const MaximumDraftContentLanguageDetectionSampleLength = 5_000;

export function prepareDraftContentLanguageSample(value: string): string | undefined {
	const sample = value
		.replace(CodeBlockPattern, " ")
		.replace(UrlPattern, " ")
		.replace(MentionPattern, " ")
		.replace(NonLetterPattern, " ")
		.replace(WhitespacePattern, " ")
		.trim()
		.slice(0, MaximumDraftContentLanguageDetectionSampleLength);
	const letterCount = sample.match(LetterPattern)?.length ?? 0;
	if (letterCount < MinimumDraftContentLanguageDetectionLetters) return undefined;
	return sample;
}
