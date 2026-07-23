import { describe, expect, it } from "vitest";

import { compareGlobalTagRank, wilsonLowerBound } from "./ranking";

describe("global Unit Tag ranking", () => {
	it("keeps pinned Tags before community-ranked candidates", () => {
		const items = [
			{ tagId: "popular", pinned: false, position: null, score: 100, voteCount: 100 },
			{ tagId: "curated", pinned: true, position: "a0", score: -1, voteCount: 1 },
		];
		expect(items.toSorted(compareGlobalTagRank).map(({ tagId }) => tagId)).toEqual([
			"curated",
			"popular",
		]);
	});

	it("does not let one positive vote outrank sustained agreement", () => {
		expect(wilsonLowerBound(1, 1)).toBeLessThan(wilsonLowerBound(80, 100));
	});

	it("honors curator order within the pinned group", () => {
		const items = [
			{ tagId: "later", pinned: true, position: "a2", score: 100, voteCount: 100 },
			{ tagId: "earlier", pinned: true, position: "a1", score: 0, voteCount: 0 },
		];
		expect(items.toSorted(compareGlobalTagRank).map(({ tagId }) => tagId)).toEqual([
			"earlier",
			"later",
		]);
	});

	it("uses stable position and identity tie breakers", () => {
		const items = [
			{ tagId: "b", pinned: false, position: null, score: 0, voteCount: 0 },
			{ tagId: "c", pinned: false, position: "a1", score: 0, voteCount: 0 },
			{ tagId: "a", pinned: false, position: "a1", score: 0, voteCount: 0 },
		];
		expect(items.toSorted(compareGlobalTagRank).map(({ tagId }) => tagId)).toEqual([
			"a",
			"c",
			"b",
		]);
	});
});
