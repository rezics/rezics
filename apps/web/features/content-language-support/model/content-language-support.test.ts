import { canonicalizeContentLanguageTag } from "@rezics/content-language";
import { describe, expect, it } from "vitest";

import {
	addContentLanguage,
	adoptContentLanguageEvidence,
	contentLanguageSupportChanged,
	ContentLanguageEditorTagValues,
	createContentLanguageSupportDraft,
	isContentLanguageSupportUnitType,
	removeContentLanguage,
	toggleContentLanguageChannel,
} from "./content-language-support";

describe("content language support editor model", () => {
	it("uses the same persisted field for Release Units", () => {
		expect(isContentLanguageSupportUnitType("release")).toBe(true);
	});

	it("offers canonical first-party choices without widening the persistence contract", () => {
		const english = canonicalizeContentLanguageTag("en");
		expect(ContentLanguageEditorTagValues).toContain(canonicalizeContentLanguageTag("zh-Hant"));
		expect(addContentLanguage([], english)).toEqual([{ languageTag: "en" }]);
		expect(
			addContentLanguage(createContentLanguageSupportDraft([{ languageTag: "en" }]), english),
		).toEqual([{ languageTag: "en" }]);
	});

	it("never represents an unqualified language with an empty channel list", () => {
		const japanese = canonicalizeContentLanguageTag("ja");
		const qualified = toggleContentLanguageChannel([], japanese, "audio");
		expect(qualified).toEqual([{ languageTag: "ja", channels: ["audio"] }]);
		expect(toggleContentLanguageChannel(qualified, japanese, "audio")).toEqual([
			{ languageTag: "ja" },
		]);
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
		expect(removeContentLanguage(draft, canonicalizeContentLanguageTag("en"))).toEqual([
			{ languageTag: "ja", channels: ["text", "audio"] },
		]);
	});
});
