import { canonicalizeContentLanguageTag } from "@rezics/content-language";
import { describe, expect, it } from "vitest";

import {
	contentLanguageSearchHref,
	contentLanguageSearchRouteParsers,
	createContentLanguageSearchPredicate,
} from "./content-language-search-route";

describe("content-language Search Feed route", () => {
	it("writes the canonical language tag and the matching Unit/channel scope", () => {
		const languageTag = canonicalizeContentLanguageTag("zh-hant");
		expect(
			contentLanguageSearchHref({
				owner: "publishing",
				shape: "text_version",
				languageTag,
				channel: "text",
			}),
		).toBe(
			"/search?contentOwner=publishing&contentShape=text_version&consumptionLanguage=zh-Hant&consumptionChannel=text",
		);
		expect(
			createContentLanguageSearchPredicate({
				owner: "publishing",
				shape: "text_version",
				languageTag,
				channel: "text",
			}),
		).toEqual({
			all: [
				{ owner: { in: ["publishing"] }, shape: { in: ["text_version"] } },
				{
					contentLanguageSupport: {
						some: { languageTag: "zh-Hant", channel: "text" },
					},
				},
			],
		});
	});

	it("canonicalizes a manually entered, differently cased tag", () => {
		expect(contentLanguageSearchRouteParsers.consumptionLanguage.parseServerSide("zh-hant")).toBe(
			"zh-Hant",
		);
		expect(
			contentLanguageSearchRouteParsers.consumptionLanguage.parseServerSide("not_a_tag"),
		).toBeNull();
	});
});
