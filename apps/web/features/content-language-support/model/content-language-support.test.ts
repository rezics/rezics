import { describe, expect, it } from "vitest";

import {
	addContentLanguage,
	adoptContentLanguageEvidence,
	contentLanguageSupportChanged,
	createContentLanguageSupportDraft,
	isContentLanguageSupportUnitType,
	removeContentLanguage,
	toggleContentLanguageChannel,
} from "./content-language-support";

describe("content language support editor model", () => {
	it("uses the same persisted field for Release Units", () => {
		expect(isContentLanguageSupportUnitType("release")).toBe(true);
	});

	it("canonicalizes language tags without inventing channel support", () => {
		expect(addContentLanguage([], "EN-us")).toEqual([{ languageTag: "en-US" }]);
		expect(() =>
			addContentLanguage(createContentLanguageSupportDraft([{ languageTag: "en-US" }]), "en_us"),
		).toThrow();
	});

	it("never represents an unqualified language with an empty channel list", () => {
		const qualified = toggleContentLanguageChannel([], "ja", "audio");
		expect(qualified).toEqual([{ languageTag: "ja", channels: ["audio"] }]);
		expect(toggleContentLanguageChannel(qualified, "ja", "audio")).toEqual([{ languageTag: "ja" }]);
	});

	it("adopts related Unit evidence only through an explicit draft action", () => {
		const initial = createContentLanguageSupportDraft([{ languageTag: "ja", channels: ["text"] }]);
		const adopted = adoptContentLanguageEvidence(initial, [
			{ languageTag: "en" },
			{ languageTag: "ja", channels: ["audio"] },
		]);
		expect(adopted).toEqual([
			{ languageTag: "en" },
			{ languageTag: "ja", channels: ["text", "audio"] },
		]);
		expect(initial).toEqual([{ languageTag: "ja", channels: ["text"] }]);
	});

	it("lets unqualified evidence dominate channel-specific evidence", () => {
		expect(
			adoptContentLanguageEvidence(
				createContentLanguageSupportDraft([{ languageTag: "en", channels: ["text"] }]),
				[{ languageTag: "en" }],
			),
		).toEqual([{ languageTag: "en" }]);
	});

	it("compares and removes canonical entries deterministically", () => {
		const draft = createContentLanguageSupportDraft([
			{ languageTag: "ja", channels: ["audio", "text"] },
			{ languageTag: "en" },
		]);
		expect(
			contentLanguageSupportChanged(draft, [
				{ languageTag: "en" },
				{ languageTag: "ja", channels: ["text", "audio"] },
			]),
		).toBe(false);
		expect(removeContentLanguage(draft, "EN")).toEqual([
			{ languageTag: "ja", channels: ["text", "audio"] },
		]);
	});
});
