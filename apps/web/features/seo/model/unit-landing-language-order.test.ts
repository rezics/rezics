import { describe, expect, it } from "vitest";

import { buildUnitLandingLocalizationLanguages } from "./unit-landing-language-order";

describe("Unit landing localization language order", () => {
	it("delegates an anonymous request to Unit localization position order", () => {
		expect(buildUnitLandingLocalizationLanguages({})).toEqual([]);
	});

	it("puts an explicit language first without inventing another fallback", () => {
		expect(buildUnitLandingLocalizationLanguages({ requestedLanguage: "ja" })).toEqual(["ja"]);
	});

	it("uses the existing Profile preference fallback order for a session", () => {
		expect(
			buildUnitLandingLocalizationLanguages({
				profile: { preferredLanguages: ["fr", "de"], interfaceLanguage: "en" },
			}),
		).toEqual(["fr", "de", "en"]);
	});

	it("moves an explicit language ahead of Profile fallbacks without duplicates", () => {
		expect(
			buildUnitLandingLocalizationLanguages({
				requestedLanguage: "de",
				profile: { preferredLanguages: ["fr", "de"], interfaceLanguage: "en" },
			}),
		).toEqual(["de", "fr", "en"]);
	});
});
