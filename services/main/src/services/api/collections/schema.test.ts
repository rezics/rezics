import { Check } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";

import {
	AddCollectionItemsBatchBody,
	CollectionDetailQuery,
	CollectionItemsQuery,
	ListCollectionsQuery,
	MoveCollectionItemsBody,
	SaveCollectionItemBody,
	UpdateCollectionItemsBatchBody,
	UpdateCollectionBody,
} from "./schema";

const targetId = "019b76da-a800-7300-8000-000000000001";
const uuid = (index: number) => `019b76da-a800-7300-8000-${index.toString(16).padStart(12, "0")}`;

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
	it("requires only the base revision for a save", () => {
		expect(
			Check(SaveCollectionItemBody, {
				baseItemsRevisionId: targetId,
			}),
		).toBe(true);
		expect(Check(SaveCollectionItemBody, {})).toBe(false);
	});

	it("rejects removed hierarchy controls, item roles, and raw positions", () => {
		expect(
			Check(SaveCollectionItemBody, {
				baseItemsRevisionId: targetId,
				placement: "direct",
				parentTargetId: targetId,
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
				placement: { kind: "end" },
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

	it("does not count the members referenced by one move as batch commands", () => {
		const targetIds = Array.from({ length: 10_001 }, (_, index) => uuid(index + 2));
		expect(
			Check(MoveCollectionItemsBody, {
				baseItemsRevisionId: targetId,
				targetIds,
				placement: { kind: "end" },
			}),
		).toBe(true);
		expect(
			Check(UpdateCollectionItemsBatchBody, {
				baseItemsRevisionId: targetId,
				changes: [
					{
						opId: "move-all",
						type: "items.move",
						targetIds,
						placement: { kind: "end" },
					},
				],
			}),
		).toBe(true);
	});

	it("gives the legacy add adapter the shared 10,000-command limit", () => {
		const items = Array.from({ length: 10_001 }, (_, index) => ({
			targetId: uuid(index + 2),
		}));
		expect(
			Check(AddCollectionItemsBatchBody, {
				baseItemsRevisionId: targetId,
				items: items.slice(0, 10_000),
			}),
		).toBe(true);
		expect(
			Check(AddCollectionItemsBatchBody, {
				baseItemsRevisionId: targetId,
				items,
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
	it("accepts omitted, empty, or unique ordered language hints", () => {
		expect(Check(CollectionDetailQuery, {})).toBe(true);
		expect(Check(CollectionDetailQuery, { localizationLanguages: ["en", "zh"] })).toBe(true);
		expect(Check(CollectionDetailQuery, { localizationLanguages: [] })).toBe(true);
		expect(Check(CollectionDetailQuery, { localizationLanguages: ["zh", "zh"] })).toBe(false);
		expect(Check(CollectionDetailQuery, { unknown: true })).toBe(false);
	});
});
