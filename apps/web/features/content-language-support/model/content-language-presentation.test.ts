import { normalizeContentLanguageSupport } from "@rezics/content-language";
import { describe, expect, it } from "vitest";

import {
	formatContentLanguageName,
	groupContentLanguageSupport,
} from "./content-language-presentation";

describe("content-language presentation", () => {
	it("groups languages by channel and preserves language-level declarations", () => {
		const value = normalizeContentLanguageSupport([
			{ languageTag: "en", channels: ["text", "audio"] },
			{ languageTag: "zh-hant", channels: ["text"] },
			{ languageTag: "ja" },
		]);
		expect(groupContentLanguageSupport(value)).toEqual([
			{ channel: "text", languageTags: ["en", "zh-Hant"] },
			{ channel: "audio", languageTags: ["en"] },
			{ channel: null, languageTags: ["ja"] },
		]);
	});

	it("renders a language name in the active UI locale", () => {
		expect(formatContentLanguageName("zh-Hans", "zh-Hant")).toBe("繁体中文");
		expect(formatContentLanguageName("zh-Hant", "zh-Hant")).toBe("繁體中文");
	});
});
