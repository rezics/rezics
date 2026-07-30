import { describe, expect, it } from "vitest";

import {
	appendReviewScoreDrafts,
	createReviewScoreDrafts,
	createReviewScoreRealmOptions,
	MaximumReviewScoreAssociations,
	moveReviewScoreDraft,
	reviewScoreDraftsAreValid,
	type ReviewScoreDraft,
} from "./review-score-association";

const viewerScores = [
	{
		scoreId: "score-1",
		realmId: "realm-1",
		realmTitle: "Global",
		value: 8,
		visibility: "public" as const,
		updatedAt: "2026-07-26T00:00:00.000Z",
	},
	{
		scoreId: "score-2",
		realmId: "realm-2",
		realmTitle: "Book club",
		value: 6,
		visibility: "private" as const,
		updatedAt: "2026-07-26T00:00:00.000Z",
	},
];

describe("Review Score association drafts", () => {
	it("preserves attached order and uses localized Realm labels", () => {
		expect(
			createReviewScoreDrafts(viewerScores, [
				{ scoreId: "score-2", realmId: "realm-2", realmTitle: "Club", value: "6" },
				{ scoreId: "score-1", realmId: "realm-1", realmTitle: "Global", value: 8 },
				{
					scoreId: "foreign-score",
					realmId: "realm-3",
					realmTitle: "Foreign realm",
					value: 4,
				},
			]),
		).toEqual([
			{
				state: "stored",
				scoreId: "score-2",
				realmId: "realm-2",
				realmLabel: "Book club",
				value: 6,
				persistedValue: 6,
			},
			{
				state: "stored",
				scoreId: "score-1",
				realmId: "realm-1",
				realmLabel: "Global",
				value: 8,
				persistedValue: 8,
			},
			{
				state: "stored",
				scoreId: "foreign-score",
				realmId: "realm-3",
				realmLabel: "Foreign realm",
				value: 4,
				persistedValue: 4,
			},
		]);
	});

	it("offers only valid unbound viewer Scores", () => {
		expect(createReviewScoreRealmOptions(viewerScores, new Set(["realm-1"]))).toEqual([
			{
				scoreId: "score-2",
				realmId: "realm-2",
				realmLabel: "Book club",
				value: 6,
			},
		]);
	});

	it("adds stored and new Realm drafts once and enforces the five-item limit", () => {
		const options = Array.from({ length: MaximumReviewScoreAssociations + 2 }, (_, index) => ({
			realmId: `realm-${index}`,
			realmLabel: `Realm ${index}`,
			...(index === 0 ? { scoreId: "score-0", value: 10 as const } : {}),
		}));
		const result = appendReviewScoreDrafts([], [...options, options[0]!]);
		expect(result).toHaveLength(MaximumReviewScoreAssociations);
		expect(result[0]).toMatchObject({
			state: "stored",
			scoreId: "score-0",
			value: 10,
		});
		expect(result[1]).toMatchObject({ state: "new", value: undefined });
	});

	it("moves a draft without changing its selected Realm identity", () => {
		const drafts = createReviewScoreDrafts(viewerScores, [
			{ scoreId: "score-1", realmId: "realm-1", realmTitle: "Global", value: 8 },
			{ scoreId: "score-2", realmId: "realm-2", realmTitle: "Club", value: 6 },
		]);
		expect(moveReviewScoreDraft(drafts, "realm-2", 0).map(({ realmId }) => realmId)).toEqual([
			"realm-2",
			"realm-1",
		]);
	});

	it("requires every draft to have a Score value", () => {
		const draft = {
			state: "new",
			realmId: "realm-1",
			realmLabel: "Global",
			value: undefined,
		} satisfies ReviewScoreDraft;
		expect(reviewScoreDraftsAreValid([draft])).toBe(false);
		expect(reviewScoreDraftsAreValid([{ ...draft, value: 10 }])).toBe(true);
	});
});
