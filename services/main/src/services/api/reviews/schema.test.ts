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

	it("accepts a Realm-scoped Score", () => {
		expect(
			Check(CreateReviewBody, {
				...review,
				realmId,
				score: { realmId, value: 8 },
			}),
		).toBe(true);
	});

	it("rejects out-of-range or extensible Score payloads", () => {
		expect(
			Check(CreateReviewBody, {
				...review,
				score: { realmId, value: 11 },
			}),
		).toBe(false);
		expect(
			Check(CreateReviewBody, {
				...review,
				score: { realmId, value: 8, copied: true },
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
				language: "zh",
				search: "好看",
				scoreRealmId: realmId,
				score: 10,
				limit: 3,
			}),
		).toBe(true);
	});

	it("rejects unsupported languages and out-of-range Scores", () => {
		expect(Check(ListReviewsQuery, { language: "zh-Hant" })).toBe(false);
		expect(Check(ListReviewsQuery, { score: 0 })).toBe(false);
		expect(Check(ListReviewsQuery, { score: 11 })).toBe(false);
	});
});
