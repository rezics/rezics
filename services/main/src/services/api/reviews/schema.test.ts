import { createPortableTextDocument } from "@rezics/block";
import { Check } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";

import { CreateReviewBody, ListReviewsQuery, ListViewerScoresQuery } from "./schema";

const targetId = "019b76da-a800-7300-8000-000000000001";
const realmId = "019b76da-a800-7300-8000-000000000002";
const review = {
	targetId,
	language: "en",
	title: "A review",
	body: createPortableTextDocument([], "0123456789ab"),
};

describe("review creation schema", () => {
	it("keeps Score optional", () => {
		expect(Check(CreateReviewBody, review)).toBe(true);
	});

	it("accepts a context-addressed Score", () => {
		expect(
			Check(CreateReviewBody, {
				...review,
				realmId,
				score: { contextUnitId: realmId, value: 8 },
			}),
		).toBe(true);
	});

	it("rejects out-of-range or extensible Score payloads", () => {
		expect(
			Check(CreateReviewBody, {
				...review,
				score: { contextUnitId: realmId, value: 11 },
			}),
		).toBe(false);
		expect(
			Check(CreateReviewBody, {
				...review,
				score: { contextUnitId: realmId, value: 8, copied: true },
			}),
		).toBe(false);
	});
});

describe("viewer Score list schema", () => {
	it("accepts supported content languages and rejects UI locale identifiers", () => {
		expect(Check(ListViewerScoresQuery, {})).toBe(true);
		expect(Check(ListViewerScoresQuery, { language: "zh" })).toBe(true);
		expect(Check(ListViewerScoresQuery, { language: "zh-Hant" })).toBe(false);
	});
});

describe("review list schema", () => {
	it("accepts supported discovery filters", () => {
		expect(
			Check(ListReviewsQuery, {
				targetId,
				languages: ["zh", "en"],
				search: "好看",
				scoreContextUnitId: realmId,
				scores: [8, 9, 10],
				limit: 3,
			}),
		).toBe(true);
	});

	it("rejects unsupported languages and out-of-range Scores", () => {
		expect(Check(ListReviewsQuery, { languages: ["zh-Hant"] })).toBe(false);
		expect(Check(ListReviewsQuery, { scores: [0] })).toBe(false);
		expect(Check(ListReviewsQuery, { scores: [11] })).toBe(false);
		expect(Check(ListReviewsQuery, { languages: [] })).toBe(false);
		expect(Check(ListReviewsQuery, { scores: [] })).toBe(false);
		expect(Check(ListReviewsQuery, { scores: [10, 10] })).toBe(false);
	});
});
