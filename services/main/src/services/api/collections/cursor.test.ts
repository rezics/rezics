import { describe, expect, it } from "vitest";

import { InvalidPaginationCursor } from "../../pagination/errors";
import { decodeCollectionListCursor, encodeCollectionListCursor } from "./cursor";
import type { ListCollectionsQuery } from "./schema";

const ownerId = "019b76da-a800-7300-8000-000000000001";
const targetId = "019b76da-a800-7300-8000-000000000002";
const localizationLanguages: ListCollectionsQuery["localizationLanguages"] = ["zh", "en"];
const boundary = {
	systemRank: 1,
	updatedAt: new Date("2026-07-29T12:00:00.000Z"),
	id: "019b76da-a800-7300-8000-000000000003",
};
const context = {
	ownerListing: true,
	query: {
		acceptsItemsOnly: true,
		ownerId,
		targetId,
		localizationLanguages,
		search: "reading",
		limit: 50,
	},
};

describe("Collection list cursor", () => {
	it("round-trips the stable ordering boundary and query scope", () => {
		const cursor = encodeCollectionListCursor(boundary, context);
		expect(decodeCollectionListCursor(cursor, context)).toEqual(boundary);
	});

	it("rejects a cursor reused with a different search or access scope", () => {
		const cursor = encodeCollectionListCursor(boundary, context);
		expect(() =>
			decodeCollectionListCursor(cursor, {
				...context,
				query: { ...context.query, search: "watching" },
			}),
		).toThrow(InvalidPaginationCursor);
		expect(() =>
			decodeCollectionListCursor(cursor, {
				...context,
				ownerListing: false,
			}),
		).toThrow(InvalidPaginationCursor);
		expect(() =>
			decodeCollectionListCursor(cursor, {
				...context,
				query: { ...context.query, acceptsItemsOnly: false },
			}),
		).toThrow(InvalidPaginationCursor);
	});

	it("rejects malformed cursor data at the runtime boundary", () => {
		expect(() => decodeCollectionListCursor("not-a-cursor", context)).toThrow(
			InvalidPaginationCursor,
		);
	});
});
