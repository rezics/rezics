import { describe, expect, it } from "vitest";

import {
	calculateObjective,
	EmptyRecommendationStats,
	rankRecommendations,
	type RecommendationCandidate,
} from "./ranking";

const now = new Date("2026-07-15T12:00:00.000Z");

function candidate(
	id: string,
	input: Partial<RecommendationCandidate> = {},
): RecommendationCandidate {
	return {
		id,
		createdAt: new Date("2026-07-15T00:00:00.000Z"),
		personalizedRelevance: 0,
		stats: { ...EmptyRecommendationStats },
		...input,
	};
}

describe("recommendation ranking", () => {
	it("keeps every objective finite for empty and populated signals", () => {
		const item = candidate("a", {
			stats: {
				...EmptyRecommendationStats,
				impressions: 20,
				upvotes: 5,
				engagement6h: 4,
				engagement24h: 10,
				engagement7d: 30,
			},
		});
		for (const sort of ["best", "hot", "new", "top", "rising"] as const) {
			expect(Number.isFinite(calculateObjective(sort, item, now))).toBe(true);
			expect(Number.isFinite(calculateObjective(sort, candidate("empty"), now))).toBe(true);
		}
	});

	it("uses personalization in every feed sort", () => {
		for (const sort of ["best", "hot", "new", "top", "rising"] as const) {
			const ranked = rankRecommendations(
				[
					candidate("preferred", { personalizedRelevance: 100 }),
					candidate("other", { personalizedRelevance: 0 }),
				],
				{ sort, personalized: true, asOf: now, pageSize: 20 },
			);
			expect(ranked[0]?.id).toBe("preferred");
		}
	});

	it("preserves strict objective ordering when personalization is disabled", () => {
		const ranked = rankRecommendations(
			[
				candidate("older", {
					createdAt: new Date("2026-07-01T00:00:00.000Z"),
					personalizedRelevance: 100,
				}),
				candidate("newer", {
					createdAt: new Date("2026-07-15T11:00:00.000Z"),
				}),
			],
			{ sort: "new", personalized: false, asOf: now, pageSize: 20 },
		);
		expect(ranked[0]?.id).toBe("newer");
	});

	it("does not turn identifier ordering into relevance when signals tie", () => {
		const ranked = rankRecommendations(
			[
				candidate("z-old", { createdAt: new Date("2026-07-01T00:00:00.000Z") }),
				candidate("a-new", { createdAt: new Date("2026-07-15T11:00:00.000Z") }),
			],
			{ sort: "best", personalized: false, asOf: now, pageSize: 20 },
		);
		expect(ranked[0]?.id).toBe("a-new");
	});

	it("diversifies repeated authors before relaxing the soft cap", () => {
		const items = Array.from({ length: 5 }, (_, index) =>
			candidate(`same-${index}`, {
				authorId: "same-author",
				personalizedRelevance: 10 - index,
			}),
		);
		items.push(candidate("different", { authorId: "different-author" }));
		const ranked = rankRecommendations(items, {
			sort: "best",
			personalized: true,
			asOf: now,
			pageSize: 20,
		});
		expect(ranked.findIndex(({ id }) => id === "different")).toBeLessThan(4);
		expect(new Set(ranked.map(({ id }) => id)).size).toBe(items.length);
	});

	it("resets the diversity cap at each page boundary", () => {
		const items = Array.from({ length: 6 }, (_, index) =>
			candidate(`same-${index}`, {
				authorId: "same-author",
				personalizedRelevance: 20 - index,
			}),
		);
		items.push(
			...Array.from({ length: 3 }, (_, index) =>
				candidate(`different-${index}`, {
					authorId: `different-author-${index}`,
					personalizedRelevance: 1,
				}),
			),
		);
		const ranked = rankRecommendations(items, {
			sort: "best",
			personalized: true,
			asOf: now,
			pageSize: 4,
		});
		expect(
			ranked.slice(0, 4).filter(({ authorId }) => authorId === "same-author"),
		).toHaveLength(3);
		expect(ranked[4]?.authorId).toBe("same-author");
	});

	it("reserves first-page capacity for fresh low-exposure candidates", () => {
		const established = Array.from({ length: 20 }, (_, index) =>
			candidate(`established-${index}`, {
				createdAt: new Date("2026-07-01T00:00:00.000Z"),
				stats: {
					...EmptyRecommendationStats,
					impressions: 100,
					upvotes: 20 - index,
				},
			}),
		);
		const exploration = [
			candidate("explore-a", { createdAt: new Date("2026-07-15T11:00:00.000Z") }),
			candidate("explore-b", { createdAt: new Date("2026-07-15T10:00:00.000Z") }),
		];
		const ranked = rankRecommendations([...established, ...exploration], {
			sort: "top",
			personalized: false,
			asOf: now,
			pageSize: 20,
		});
		expect(ranked.slice(0, 20).filter(({ id }) => id.startsWith("explore-"))).toHaveLength(2);
	});

	it("is deterministic", () => {
		const items = [candidate("a"), candidate("b"), candidate("c")];
		const options = { sort: "best" as const, personalized: true, asOf: now, pageSize: 20 };
		expect(rankRecommendations(items, options)).toEqual(rankRecommendations(items, options));
	});
});
