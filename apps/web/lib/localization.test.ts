import { describe, expect, it } from "vitest";

import { buildLocalizationLanguages } from "./localization";

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
});
