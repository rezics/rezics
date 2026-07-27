import { Check } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";

import { CollectionDetailQuery, ListCollectionsQuery } from "./schema";

const targetId = "019b76da-a800-7300-8000-000000000001";

describe("collection list schema", () => {
	it("accepts an optional direct-membership target", () => {
		expect(Check(ListCollectionsQuery, {})).toBe(true);
		expect(
			Check(ListCollectionsQuery, {
				targetId,
				localizationLanguages: ["zh", "en"],
				limit: 50,
			}),
		).toBe(true);
	});

	it("requires target identities to be UUIDs", () => {
		expect(Check(ListCollectionsQuery, { targetId: "book-1" })).toBe(false);
	});
});

describe("collection localization query", () => {
	it("accepts a unique, non-empty ordered language list", () => {
		expect(Check(CollectionDetailQuery, {})).toBe(true);
		expect(Check(CollectionDetailQuery, { localizationLanguages: ["en", "zh"] })).toBe(true);
		expect(Check(CollectionDetailQuery, { localizationLanguages: [] })).toBe(false);
		expect(Check(CollectionDetailQuery, { localizationLanguages: ["zh", "zh"] })).toBe(false);
		expect(Check(CollectionDetailQuery, { unknown: true })).toBe(false);
	});
});
