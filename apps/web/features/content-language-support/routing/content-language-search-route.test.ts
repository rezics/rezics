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
		expect(contentLanguageSearchHref({ unitType: "book", languageTag, channel: "text" })).toBe(
			"/search?content=unit:book&consumptionLanguage=zh-Hant&consumptionChannel=text",
		);
		expect(
			createContentLanguageSearchPredicate({
				content: "unit:book",
				languageTag,
				channel: "text",
			}),
		).toEqual({
			all: [
				{ kind: { in: ["book"] } },
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
