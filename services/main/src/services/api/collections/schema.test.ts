import { Check } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";

import {
	CollectionDetailQuery,
	CollectionItemsQuery,
	ListCollectionsQuery,
	MoveCollectionItemsBody,
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
				editableOnly: true,
				publisherProfileId: targetId,
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
				baseItemsRevisionId: targetId,
				placement: "review-with-subject",
			}),
		).toBe(true);
		expect(Check(SaveCollectionItemBody, { placement: "direct" })).toBe(false);
	});

	it("rejects removed item roles and raw positions", () => {
		expect(
			Check(SaveCollectionItemBody, {
				baseItemsRevisionId: targetId,
				placement: "direct",
				role: "item",
				position: "a0",
			}),
		).toBe(false);
	});

	it("accepts an atomic ordered multi-item move", () => {
		expect(
			Check(MoveCollectionItemsBody, {
				baseItemsRevisionId: targetId,
				targetIds: [targetId],
				placement: { kind: "end", parentTargetId: null },
			}),
		).toBe(true);
		expect(
			Check(MoveCollectionItemsBody, {
				baseItemsRevisionId: targetId,
				targetIds: [targetId, targetId],
				placement: { kind: "after", targetId },
			}),
		).toBe(false);
	});

	it("accepts bounded content pagination", () => {
		expect(Check(CollectionItemsQuery, { limit: 100 })).toBe(true);
		expect(Check(CollectionItemsQuery, { limit: 101 })).toBe(false);
	});
});

describe("collection update schema", () => {
	it("rejects removed presentation documents", () => {
		expect(
			Check(UpdateCollectionBody, {
				baseRevisionId: targetId,
				presentationDocument: {},
			}),
		).toBe(false);
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
