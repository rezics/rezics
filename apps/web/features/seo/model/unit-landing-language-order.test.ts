import { describe, expect, it } from "vitest";

import { buildUnitLandingLocalizationLanguages } from "./unit-landing-language-order";

describe("Unit landing localization language order", () => {
	it("uses interface and browser preferences for an anonymous request", () => {
		expect(
			buildUnitLandingLocalizationLanguages({
				interfaceLanguage: "zh",
				browserLanguages: ["zh", "en"],
			}),
		).toEqual(["zh", "en"]);
	});

	it("puts an explicit language before anonymous fallbacks", () => {
		expect(
			buildUnitLandingLocalizationLanguages({
				requestedLanguage: "ja",
				interfaceLanguage: "zh",
				browserLanguages: ["en"],
			}),
		).toEqual(["ja", "zh", "en"]);
	});

	it("uses the existing Profile preference fallback order for a session", () => {
		expect(
			buildUnitLandingLocalizationLanguages({
				interfaceLanguage: "zh",
				profile: { preferredLanguages: ["fr", "de"], interfaceLanguage: "en" },
				browserLanguages: ["zh"],
			}),
		).toEqual(["fr", "de", "en", "zh"]);
	});

	it("moves an explicit language ahead of Profile fallbacks without duplicates", () => {
		expect(
			buildUnitLandingLocalizationLanguages({
				requestedLanguage: "de",
				interfaceLanguage: "zh",
				profile: { preferredLanguages: ["fr", "de"], interfaceLanguage: "en" },
				browserLanguages: ["zh"],
			}),
		).toEqual(["de", "fr", "en", "zh"]);
	});
});
