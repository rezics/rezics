import { describe, expect, it } from "vitest";

import { resolveReviewScoreAssociationOptions } from "./review-score-association";

describe("Review Score association options", () => {
	it("uses localized viewer contexts and preserves an attached Score from another viewer", () => {
		expect(
			resolveReviewScoreAssociationOptions(
				[
					{
						scoreId: "score-1",
						contextUnitId: "context-1",
						contextUnitTitle: "Global",
						value: 8,
						updatedAt: "2026-07-26T00:00:00.000Z",
					},
				],
				[{ scoreId: "score-2", contextUnitId: "context-2", value: "6" }],
			),
		).toEqual([
			{
				scoreId: "score-1",
				contextUnitId: "context-1",
				contextLabel: "Global",
				value: 8,
			},
			{
				scoreId: "score-2",
				contextUnitId: "context-2",
				contextLabel: "context-2",
				value: 6,
			},
		]);
	});

	it("deduplicates the attached Score and rejects values outside the Score domain", () => {
		expect(
			resolveReviewScoreAssociationOptions(
				[
					{
						scoreId: "score-1",
						contextUnitId: "context-1",
						contextUnitTitle: null,
						value: 10,
						updatedAt: "2026-07-26T00:00:00.000Z",
					},
					{
						scoreId: "invalid",
						contextUnitId: "context-2",
						contextUnitTitle: null,
						value: 11,
						updatedAt: "2026-07-26T00:00:00.000Z",
					},
				],
				[{ scoreId: "score-1", contextUnitId: "context-1", value: 10 }],
			),
		).toHaveLength(1);
	});
});
