import { describe, expect, it } from "vitest";

import { withContentLanguage } from "./content-language-route";

describe("withContentLanguage", () => {
	it("adds a language without losing route context or a fragment", () => {
		expect(withContentLanguage("/posts/123?realmId=abc#replies", "ja")).toBe(
			"/posts/123?realmId=abc&language=ja#replies",
		);
	});

	it("replaces an existing language override", () => {
		expect(withContentLanguage("/units/book/123?language=ja", "ko")).toBe(
			"/units/book/123?language=ko",
		);
	});

	it("clears only the language override", () => {
		expect(withContentLanguage("/posts/123?realmId=abc&language=ja", undefined)).toBe(
			"/posts/123?realmId=abc",
		);
	});
});
