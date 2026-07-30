import type { ContentLanguage } from "@rezics/i18n";
import { francAll } from "franc-min";

import {
	MinimumDraftContentLanguageDetectionLetters,
	prepareDraftContentLanguageSample,
} from "./prepare-draft-content-language-sample";

const LetterPattern = /\p{L}/gu;
const HanPattern = /\p{Script=Han}/gu;
const HiraganaKatakanaPattern = /[\p{Script=Hiragana}\p{Script=Katakana}]/gu;
const HangulPattern = /\p{Script=Hangul}/gu;

const MinimumStatisticalLetters = 40;
const MinimumConfidenceMargin = 0.1;

const ContentLanguageByIso6393 = new Map<string, ContentLanguage>([
	["cmn", "zh"],
	["deu", "de"],
	["eng", "en"],
	["fra", "fr"],
	["jpn", "ja"],
	["kor", "ko"],
	["spa", "es"],
]);

export type DraftContentLanguageDetection =
	| { readonly status: "insufficient" }
	| {
			readonly status: "detected";
			readonly language: ContentLanguage;
	  }
	| { readonly status: "ambiguous" }
	| { readonly status: "unsupported" };

export function detectDraftContentLanguage(value: string): DraftContentLanguageDetection {
	const sample = prepareDraftContentLanguageSample(value);
	if (!sample) return { status: "insufficient" };

	const letters = sample.match(LetterPattern)?.length ?? 0;
	const kana = sample.match(HiraganaKatakanaPattern)?.length ?? 0;
	if (kana >= MinimumDraftContentLanguageDetectionLetters && kana / letters >= 0.15)
		return { status: "detected", language: "ja" };

	const hangul = sample.match(HangulPattern)?.length ?? 0;
	if (hangul >= MinimumDraftContentLanguageDetectionLetters && hangul / letters >= 0.25)
		return { status: "detected", language: "ko" };

	const han = sample.match(HanPattern)?.length ?? 0;
	if (han >= MinimumDraftContentLanguageDetectionLetters && han / letters >= 0.5)
		return { status: "detected", language: "zh" };

	if (letters < MinimumStatisticalLetters) return { status: "insufficient" };
	const [first, second] = francAll(sample, { minLength: MinimumStatisticalLetters });
	if (!first || first[0] === "und") return { status: "ambiguous" };
	const language = ContentLanguageByIso6393.get(first[0]);
	if (!language) return { status: "unsupported" };
	const confidenceMargin = first[1] - (second?.[1] ?? 0);
	return confidenceMargin >= MinimumConfidenceMargin
		? { status: "detected", language }
		: { status: "ambiguous" };
}
