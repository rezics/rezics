import { describe, expect, it } from "vitest";

import { rankRecommendations, type RecommendationCandidate } from "./ranking";

function candidate(
	id: string,
	input: Partial<RecommendationCandidate> = {},
): RecommendationCandidate {
	return {
		id,
		createdAt: new Date("2026-07-15T00:00:00.000Z"),
		updatedAt: new Date("2026-07-15T00:00:00.000Z"),
		bestScore: 0,
		...input,
	};
}

describe("recommendation ranking", () => {
	it("orders best by one materialized score", () => {
		const ranked = rankRecommendations(
			[candidate("low", { bestScore: 1 }), candidate("high", { bestScore: 2 })],
			{ sort: "best" },
		);
		expect(ranked.map(({ id }) => id)).toEqual(["high", "low"]);
	});

	it("orders zero-score best fallback by update time and identifier", () => {
		const ranked = rankRecommendations(
			[
				candidate("a", { updatedAt: new Date("2026-07-15T10:00:00.000Z") }),
				candidate("z", { updatedAt: new Date("2026-07-15T10:00:00.000Z") }),
				candidate("old", { updatedAt: new Date("2026-07-14T10:00:00.000Z") }),
			],
			{ sort: "best" },
		);
		expect(ranked.map(({ id }) => id)).toEqual(["z", "a", "old"]);
	});

	it("orders new by creation time without consulting best", () => {
		const ranked = rankRecommendations(
			[
				candidate("older-high", {
					createdAt: new Date("2026-07-14T00:00:00.000Z"),
					bestScore: 100,
				}),
				candidate("newer", { createdAt: new Date("2026-07-15T11:00:00.000Z") }),
			],
			{ sort: "new" },
		);
		expect(ranked.map(({ id }) => id)).toEqual(["newer", "older-high"]);
	});

	it("normalizes invalid best scores to the zero-score fallback", () => {
		const ranked = rankRecommendations(
			[
				candidate("invalid", {
					bestScore: Number.NaN,
					updatedAt: new Date("2026-07-15T11:00:00.000Z"),
				}),
				candidate("positive", { bestScore: 0.1 }),
			],
			{ sort: "best" },
		);
		expect(ranked.map(({ id }) => id)).toEqual(["positive", "invalid"]);
		expect(ranked.every(({ rankScore }) => Number.isFinite(rankScore))).toBe(true);
	});

	it("is deterministic", () => {
		const items = [candidate("a"), candidate("b"), candidate("c")];
		expect(rankRecommendations(items, { sort: "best" })).toEqual(
			rankRecommendations(items, { sort: "best" }),
		);
	});
});
