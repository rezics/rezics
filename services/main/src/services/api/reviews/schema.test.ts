import { createPortableTextDocument } from "@rezics/block";
import { Check } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";

import {
	CreateReviewBody,
	GetReviewQuery,
	ListReviewsQuery,
	ListViewerScoresQuery,
	resolveReviewScoreFilter,
	SetScoreBody,
	UpdateReviewBody,
} from "./schema";

const targetId = "019b76da-a800-7300-8000-000000000001";
const realmId = "019b76da-a800-7300-8000-000000000002";
const review = {
	targetId,
	language: "en",
	body: createPortableTextDocument([], "0123456789ab"),
	publishRealmIds: [],
};

describe("review creation schema", () => {
	it("keeps title, summary, and Score optional", () => {
		expect(Check(CreateReviewBody, review)).toBe(true);
		expect(
			Check(CreateReviewBody, {
				...review,
				title: "A review",
				summary: "A concise preview",
			}),
		).toBe(true);
	});

	it("rejects blank authored metadata", () => {
		expect(Check(CreateReviewBody, { ...review, title: "" })).toBe(false);
		expect(Check(CreateReviewBody, { ...review, summary: "" })).toBe(false);
	});

	it("accepts a Realm-addressed Score", () => {
		expect(
			Check(CreateReviewBody, {
				...review,
				publishRealmIds: [realmId],
				score: { realmId: realmId, value: 8 },
			}),
		).toBe(true);
	});

	it("rejects out-of-range or extensible Score payloads", () => {
		expect(
			Check(CreateReviewBody, {
				...review,
				score: { realmId: realmId, value: 11 },
			}),
		).toBe(false);
		expect(
			Check(CreateReviewBody, {
				...review,
				score: { realmId: realmId, value: 8, copied: true },
			}),
		).toBe(false);
	});
});

describe("review update schema", () => {
	it("uses explicit nulls to clear authored metadata during replacement", () => {
		expect(
			Check(UpdateReviewBody, {
				language: "en",
				title: null,
				summary: null,
				body: review.body,
			}),
		).toBe(true);
		expect(Check(UpdateReviewBody, { language: "en", body: review.body })).toBe(false);
	});
});

describe("viewer Score list schema", () => {
	it("accepts supported content languages and rejects UI locale identifiers", () => {
		expect(Check(ListViewerScoresQuery, {})).toBe(true);
		expect(Check(ListViewerScoresQuery, { localizationLanguages: ["zh"] })).toBe(true);
		expect(Check(ListViewerScoresQuery, { language: "zh" })).toBe(false);
		expect(Check(ListViewerScoresQuery, { localizationLanguages: ["zh-Hant"] })).toBe(false);
	});

	it("accepts an optional per-Score visibility control", () => {
		expect(
			Check(SetScoreBody, {
				realmId: realmId,
				score: 8,
				visibility: "unlisted",
			}),
		).toBe(true);
		expect(
			Check(SetScoreBody, {
				realmId: realmId,
				score: 8,
				visibility: "followers",
			}),
		).toBe(false);
	});
});

describe("review list schema", () => {
	it("accepts supported discovery filters", () => {
		expect(
			Check(ListReviewsQuery, {
				targetId,
				realmIds: [realmId],
				languages: ["zh", "en"],
				localizationLanguages: ["en", "zh"],
				scoreRealmId: realmId,
				scores: [8, 9, 10],
				sort: "best",
				cursor: "opaque",
				limit: 3,
			}),
		).toBe(true);
	});

	it("requires Score values and their Realm together", () => {
		expect(resolveReviewScoreFilter({ scoreRealmId: realmId, scores: [8] })).toEqual({
			status: "present",
			realmId: realmId,
			values: [8],
		});
		expect(resolveReviewScoreFilter({ scores: [8] })).toEqual({ status: "invalid" });
		expect(resolveReviewScoreFilter({ scoreRealmId: realmId })).toEqual({
			status: "invalid",
		});
		expect(resolveReviewScoreFilter({})).toEqual({ status: "absent" });
	});

	it("rejects unsupported filters, sorting, and out-of-range Scores", () => {
		expect(Check(ListReviewsQuery, { languages: ["zh-Hant"] })).toBe(false);
		expect(Check(ListReviewsQuery, { scoreRealmId: realmId, scores: [0] })).toBe(false);
		expect(Check(ListReviewsQuery, { scoreRealmId: realmId, scores: [11] })).toBe(false);
		expect(Check(ListReviewsQuery, { languages: [] })).toBe(false);
		expect(Check(ListReviewsQuery, { realmIds: [] })).toBe(false);
		expect(Check(ListReviewsQuery, { scoreRealmId: realmId, scores: [] })).toBe(false);
		expect(Check(ListReviewsQuery, { scoreRealmId: realmId, scores: [10, 10] })).toBe(false);
		expect(Check(ListReviewsQuery, { realmId })).toBe(false);
		expect(Check(ListReviewsQuery, { sort: "relevance" })).toBe(false);
		expect(Check(ListReviewsQuery, { search: "review text" })).toBe(false);
	});
});

describe("review localization query", () => {
	it("uses the shared fallback list", () => {
		expect(Check(GetReviewQuery, {})).toBe(true);
		expect(Check(GetReviewQuery, { localizationLanguages: ["zh", "en"] })).toBe(true);
		expect(Check(GetReviewQuery, { localizationLanguages: [] })).toBe(true);
		expect(Check(GetReviewQuery, { unknown: true })).toBe(false);
	});
});
