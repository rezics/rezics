import { describe, expect, it } from "vitest";

import { planCollectionItemInsertions } from "./save";

describe("flat Collection item insertion planning", () => {
	it("rejects an empty request before any position can be planned", () => {
		expect(() =>
			planCollectionItemInsertions({
				requestedTargetIds: [],
				existingPositionByTargetId: new Map(),
				lastPosition: undefined,
				positionBeforeReviewByTargetId: new Map(),
				reviewSubjectByTargetId: new Map(),
			}),
		).toThrow("At least one Collection target ID must be requested");
	});

	it("appends a missing Review subject immediately before its Review", () => {
		const result = planCollectionItemInsertions({
			requestedTargetIds: ["review"],
			existingPositionByTargetId: new Map(),
			lastPosition: "a0",
			positionBeforeReviewByTargetId: new Map(),
			reviewSubjectByTargetId: new Map([["review", "book"]]),
		});

		expect(result).toEqual({
			insertions: [
				{ targetId: "book", position: "a1" },
				{ targetId: "review", position: "a2" },
			],
			requestedItems: [{ targetId: "review", state: "created" }],
		});
	});

	it("appends only the Review when its subject already belongs to the Collection", () => {
		const result = planCollectionItemInsertions({
			requestedTargetIds: ["review"],
			existingPositionByTargetId: new Map([["book", "a0"]]),
			lastPosition: "a0",
			positionBeforeReviewByTargetId: new Map(),
			reviewSubjectByTargetId: new Map([["review", "book"]]),
		});

		expect(result.insertions).toEqual([{ targetId: "review", position: "a1" }]);
	});

	it("repairs a missing subject directly before an existing Review without reordering it", () => {
		const result = planCollectionItemInsertions({
			requestedTargetIds: ["review"],
			existingPositionByTargetId: new Map([["review", "a2"]]),
			lastPosition: "a2",
			positionBeforeReviewByTargetId: new Map([["review", "a0"]]),
			reviewSubjectByTargetId: new Map([["review", "book"]]),
		});

		expect(result).toEqual({
			insertions: [{ targetId: "book", position: "a1" }],
			requestedItems: [{ targetId: "review", state: "existing" }],
		});
	});

	it("deduplicates one missing subject shared by multiple requested Reviews", () => {
		const result = planCollectionItemInsertions({
			requestedTargetIds: ["review-a", "review-b"],
			existingPositionByTargetId: new Map(),
			lastPosition: undefined,
			positionBeforeReviewByTargetId: new Map(),
			reviewSubjectByTargetId: new Map([
				["review-a", "book"],
				["review-b", "book"],
			]),
		});

		expect(result.insertions.map(({ targetId }) => targetId)).toEqual([
			"book",
			"review-a",
			"review-b",
		]);
	});
});
