import { describe, expect, it } from "vitest";

import { buildLocalizationLanguages, contentLanguagesFromLocaleTags } from "./localization";

describe("buildLocalizationLanguages", () => {
	it("preserves preferred-language order and appends a missing interface language", () => {
		expect(buildLocalizationLanguages(["zh"], "en")).toEqual(["zh", "en"]);
	});

	it("does not duplicate an interface language already in the preference list", () => {
		expect(buildLocalizationLanguages(["en", "zh"], "en")).toEqual(["en", "zh"]);
	});

	it("uses the interface language as the anonymous lookup hint", () => {
		expect(buildLocalizationLanguages([], "zh")).toEqual(["zh"]);
	});

	it("appends deduplicated browser fallbacks after explicit preferences and interface language", () => {
		expect(buildLocalizationLanguages(["fr"], "zh", ["zh", "en", "fr"])).toEqual([
			"fr",
			"zh",
			"en",
		]);
	});
});

describe("contentLanguagesFromLocaleTags", () => {
	it("validates BCP 47 tags, maps UI variants, and removes content-language duplicates", () => {
		expect(contentLanguagesFromLocaleTags(["zh-Hant", "zh-TW", "en-US", "pt-BR", "en"])).toEqual([
			"zh",
			"en",
		]);
	});
});
