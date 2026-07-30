import { createPortableTextDocument } from "@rezics/block";
import { Check } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";

import {
	CreatePostBody,
	MaximumPostScoreCount,
	PostScoreListResponse,
	ReplacePostScoresBody,
	UpdatePostBody,
} from "./schema";

const body = createPortableTextDocument([], "0123456789ab");
const baseRevisionId = "019b76da-a800-7300-8000-000000000001";

describe("Post localization API contracts", () => {
	it("allows creating a Post without a title or summary", () => {
		expect(Check(CreatePostBody, { postKind: "post", language: "en", body })).toBe(true);
		expect(
			Check(CreatePostBody, {
				postKind: "post",
				language: "en",
				title: "A title",
				summary: "A concise preview",
				body,
			}),
		).toBe(true);
	});

	it("requires every Excerpt to have a subject", () => {
		expect(
			Check(CreatePostBody, {
				postKind: "excerpt",
				language: "en",
				subjectId: "019b76da-a800-7300-8000-000000000002",
				body,
			}),
		).toBe(true);
		expect(Check(CreatePostBody, { postKind: "excerpt", language: "en", body })).toBe(false);
		expect(Check(CreatePostBody, { language: "en", body })).toBe(false);
	});

	it("rejects blank authored metadata", () => {
		expect(Check(CreatePostBody, { postKind: "post", language: "en", title: "", body })).toBe(
			false,
		);
		expect(Check(CreatePostBody, { postKind: "post", language: "en", summary: "", body })).toBe(
			false,
		);
	});

	it("uses explicit nulls to clear authored metadata during replacement", () => {
		expect(
			Check(UpdatePostBody, {
				language: "en",
				title: null,
				summary: null,
				body,
				baseRevisionId,
			}),
		).toBe(true);
		expect(
			Check(UpdatePostBody, {
				language: "en",
				body,
				baseRevisionId,
			}),
		).toBe(false);
	});
});

describe("Post Score API contracts", () => {
	it("accepts up to five ordered Scores", () => {
		const items = Array.from({ length: MaximumPostScoreCount + 1 }, (_, index) => ({
			scoreId: `0195c49b-8f3b-7e18-8c45-c2f36ee8d${String(index).padStart(3, "0")}`,
		}));
		expect(Check(ReplacePostScoresBody, [])).toBe(true);
		expect(Check(ReplacePostScoresBody, items.slice(0, MaximumPostScoreCount))).toBe(true);
		expect(Check(ReplacePostScoresBody, items)).toBe(false);
	});

	it("returns the localized Realm title with every attached Score", () => {
		const score = {
			scoreId: "019b76da-a800-7300-8000-000000000001",
			profileId: "019b76da-a800-7300-8000-000000000002",
			unitId: "019b76da-a800-7300-8000-000000000003",
			realmId: "019b76da-a800-7300-8000-000000000004",
			realmTitle: "Global Scores",
			value: 8,
			visibility: "public",
			position: "a0",
			updatedAt: "2026-07-30T00:00:00.000Z",
		};
		expect(Check(PostScoreListResponse, { items: [score] })).toBe(true);
		expect(Check(PostScoreListResponse, { items: [{ ...score, realmTitle: null }] })).toBe(
			true,
		);
		const { realmTitle: _realmTitle, ...scoreWithoutRealmTitle } = score;
		expect(Check(PostScoreListResponse, { items: [scoreWithoutRealmTitle] })).toBe(false);
	});
});
