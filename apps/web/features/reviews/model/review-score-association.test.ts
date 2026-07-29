import { describe, expect, it } from "vitest";

import { resolveReviewScoreAssociationOptions } from "./review-score-association";

describe("Review Score association options", () => {
	it("uses localized viewer Realms and preserves an attached Score from another viewer", () => {
		expect(
			resolveReviewScoreAssociationOptions(
				[
					{
						scoreId: "score-1",
						realmId: "realm-1",
						realmTitle: "Global",
						value: 8,
						visibility: "public",
						updatedAt: "2026-07-26T00:00:00.000Z",
					},
				],
				[{ scoreId: "score-2", realmId: "realm-2", value: "6" }],
			),
		).toEqual([
			{
				scoreId: "score-1",
				realmId: "realm-1",
				realmLabel: "Global",
				value: 8,
			},
			{
				scoreId: "score-2",
				realmId: "realm-2",
				realmLabel: "realm-2",
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
						realmId: "realm-1",
						realmTitle: null,
						value: 10,
						visibility: "private",
						updatedAt: "2026-07-26T00:00:00.000Z",
					},
					{
						scoreId: "invalid",
						realmId: "realm-2",
						realmTitle: null,
						value: 11,
						visibility: "unlisted",
						updatedAt: "2026-07-26T00:00:00.000Z",
					},
				],
				[{ scoreId: "score-1", realmId: "realm-1", value: 10 }],
			),
		).toHaveLength(1);
	});
});
