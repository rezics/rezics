import { describe, expect, it } from "vitest";

import { presentBinaryVoteSummary } from "./binary";

describe("binary vote summary", () => {
	it("derives positive and negative counts from a valid aggregate", () => {
		const asOf = new Date("2026-08-09T12:00:00.000Z");
		expect(
			presentBinaryVoteSummary({
				score: 2n,
				voteCount: 6n,
				viewerVote: 1,
				updatedAt: asOf,
				name: "reference",
			}),
		).toEqual({
			positiveCount: 4,
			negativeCount: 2,
			score: 2,
			voteCount: 6,
			viewerVote: 1,
			asOf,
		});
	});

	it.each([
		{ score: 2n, voteCount: 1n, viewerVote: null },
		{ score: 0n, voteCount: 1n, viewerVote: null },
		{ score: 0n, voteCount: -1n, viewerVote: null },
		{ score: 0n, voteCount: 0n, viewerVote: 0 },
	])("rejects an impossible aggregate or viewer vote", (input) => {
		expect(() =>
			presentBinaryVoteSummary({
				...input,
				updatedAt: null,
				name: "reference",
			}),
		).toThrow();
	});
});
