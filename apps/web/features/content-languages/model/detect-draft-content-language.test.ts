import { describe, expect, it } from "vitest";

import { detectDraftContentLanguage } from "./detect-draft-content-language";
import { prepareDraftContentLanguageSample } from "./prepare-draft-content-language-sample";

describe("draft content language detection", () => {
	it.each([
		[
			"en",
			"This article explains how communities organize knowledge across several subjects and languages.",
		],
		[
			"de",
			"Dieser Artikel erklärt, wie Gemeinschaften Wissen über verschiedene Themen und Sprachen organisieren.",
		],
		[
			"fr",
			"Cet article explique comment les communautés organisent les connaissances dans plusieurs domaines et langues.",
		],
		[
			"es",
			"Este artículo explica cómo las comunidades organizan el conocimiento en varios ámbitos e idiomas.",
		],
		[
			"ja",
			"これは、コミュニティが複数の分野と言語にわたって知識を整理する方法を説明する記事です。",
		],
		["ko", "이 글은 커뮤니티가 여러 분야와 언어에 걸쳐 지식을 정리하는 방법을 설명합니다."],
		["zh", "這篇文章說明社群如何跨越不同領域與語言整理知識，並共同維護內容品質。"],
	] as const)("detects supported %s prose", (language, sample) => {
		expect(detectDraftContentLanguage(sample)).toEqual({
			status: "detected",
			language,
		});
	});

	it("does not guess from short content", () => {
		expect(detectDraftContentLanguage("A short title")).toEqual({
			status: "insufficient",
		});
	});

	it("reports a confidently detected unsupported language without forcing a supported one", () => {
		expect(
			detectDraftContentLanguage(
				"Эта статья объясняет, как сообщества организуют знания по разным темам и на разных языках.",
			),
		).toEqual({ status: "unsupported" });
	});

	it("removes URLs, code, and mentions before detection", () => {
		expect(
			prepareDraftContentLanguageSample(
				"https://example.com `const language = 'en'` @someone 這是一段足以辨識的繁體中文內容。",
			),
		).toBe("這是一段足以辨識的繁體中文內容");
	});
});
