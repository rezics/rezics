import { describe, expect, it } from "vitest";

import {
	ContentLanguageValues,
	matchUiLocaleTag,
	toContentLanguage,
	UiLocaleValues,
} from "./locale-contract";

describe("locale contract", () => {
	it.each([
		["zh", "zh-Hant"],
		["zh-Hant", "zh-Hant"],
		["zh-TW", "zh-Hant"],
		["zh-HK", "zh-Hant"],
		["zh-MO", "zh-Hant"],
		["zh-Hans", "zh-Hans"],
		["zh-CN", "zh-Hans"],
		["zh-SG", "zh-Hans"],
		["ja-JP", "ja"],
		["ko-KR", "ko"],
		["de-AT", "de"],
		["fr-CA", "fr"],
		["es-MX", "es"],
	] as const)("matches %s to %s", (input, expected) => {
		expect(matchUiLocaleTag(input)).toBe(expected);
	});

	it("maps every UI locale to a supported backend content language", () => {
		for (const locale of UiLocaleValues) {
			expect(ContentLanguageValues).toContain(toContentLanguage(locale));
		}
		expect(toContentLanguage("zh-Hant")).toBe("zh");
		expect(toContentLanguage("zh-Hans")).toBe("zh");
	});

	it("rejects invalid or unsupported locale tags", () => {
		expect(matchUiLocaleTag("not a locale")).toBeUndefined();
		expect(matchUiLocaleTag("pt-BR")).toBeUndefined();
	});
});
