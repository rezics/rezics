import { createCollectionPresentationDocument } from "@rezics/block";
import { Check } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";

import {
	CollectionDetailQuery,
	CollectionItemsQuery,
	ListCollectionsQuery,
	SaveCollectionItemBody,
	UpdateCollectionBody,
} from "./schema";

const targetId = "019b76da-a800-7300-8000-000000000001";

describe("collection list schema", () => {
	it("accepts an optional direct-membership target", () => {
		expect(Check(ListCollectionsQuery, {})).toBe(true);
		expect(
			Check(ListCollectionsQuery, {
				targetId,
				containsTargetId: targetId,
				acceptsItemsOnly: true,
				localizationLanguages: ["zh", "en"],
				search: "reading",
				cursor: "next-page",
				limit: 50,
			}),
		).toBe(true);
	});

	it("requires target identities to be UUIDs", () => {
		expect(Check(ListCollectionsQuery, { targetId: "book-1" })).toBe(false);
		expect(Check(ListCollectionsQuery, { containsTargetId: "book-1" })).toBe(false);
	});

	it("bounds server-side title search", () => {
		expect(Check(ListCollectionsQuery, { search: "books" })).toBe(true);
		expect(Check(ListCollectionsQuery, { search: "" })).toBe(false);
		expect(Check(ListCollectionsQuery, { search: "x".repeat(201) })).toBe(false);
	});
});

describe("collection item mutation schema", () => {
	it("requires a base revision and an explicit placement", () => {
		expect(
			Check(SaveCollectionItemBody, {
				baseRevisionId: targetId,
				placement: "review-with-subject",
				role: "item",
			}),
		).toBe(true);
		expect(Check(SaveCollectionItemBody, { placement: "direct" })).toBe(false);
	});

	it("keeps Collection roles closed", () => {
		expect(
			Check(SaveCollectionItemBody, {
				baseRevisionId: targetId,
				placement: "direct",
				role: "chapter",
			}),
		).toBe(false);
	});

	it("accepts bounded content pagination", () => {
		expect(Check(CollectionItemsQuery, { limit: 100 })).toBe(true);
		expect(Check(CollectionItemsQuery, { limit: 101 })).toBe(false);
	});
});

describe("collection update schema", () => {
	it("accepts a presentation-only partial update", () => {
		expect(
			Check(UpdateCollectionBody, {
				baseRevisionId: targetId,
				presentationDocument: createCollectionPresentationDocument("shelf", "name"),
			}),
		).toBe(true);
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
