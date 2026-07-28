import { describe, expect, it } from "vitest";

import {
	nextFeaturedUnitTagPosition,
	partitionUnitTagCuration,
	positionForFeaturedUnitTagMove,
} from "./unit-tag-curation";

const items = [
	{ tagId: "tag-a", pinned: true, position: "a0" },
	{ tagId: "tag-b", pinned: true, position: "a1" },
	{ tagId: "tag-c", pinned: true, position: "a2" },
] as const;

describe("Unit Tag curation ordering", () => {
	it("proves the persisted pin and position invariant while partitioning", () => {
		expect(
			partitionUnitTagCuration([
				...items,
				{ tagId: "ranked", pinned: false, position: null },
			]),
		).toEqual({
			featured: items,
			ranked: [{ tagId: "ranked", pinned: false, position: null }],
		});
		expect(() =>
			partitionUnitTagCuration([{ tagId: "broken", pinned: true, position: null }]),
		).toThrow("Pinned Unit Tag is missing its ordered position");
		expect(() =>
			partitionUnitTagCuration([{ tagId: "broken", pinned: false, position: "a0" }]),
		).toThrow("Community-ranked Unit Tag unexpectedly has a position");
	});

	it("places newly featured Tags after the current featured list", () => {
		expect(nextFeaturedUnitTagPosition(items)).toBe("a3");
		expect(nextFeaturedUnitTagPosition([])).toBe("a0");
	});

	it("generates a position between the destination neighbors", () => {
		const movedFirst = positionForFeaturedUnitTagMove(items, "tag-c", 0);
		const movedLast = positionForFeaturedUnitTagMove(items, "tag-a", 2);
		expect(movedFirst.ok && movedFirst.position < items[0].position).toBe(true);
		expect(movedLast.ok && movedLast.position > items[2].position).toBe(true);
	});

	it("reports invalid or unchanged moves explicitly", () => {
		expect(positionForFeaturedUnitTagMove(items, "missing", 0)).toEqual({
			ok: false,
			reason: "tag-not-featured",
		});
		expect(positionForFeaturedUnitTagMove(items, "tag-a", -1)).toEqual({
			ok: false,
			reason: "target-out-of-range",
		});
		expect(positionForFeaturedUnitTagMove(items, "tag-a", 0)).toEqual({
			ok: false,
			reason: "unchanged",
		});
	});
});
