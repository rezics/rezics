import { Check, Decode, Encode } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";

import { DateTime, DateTimeString } from ".";
import {
	CollectionContentResponse,
	toPortableTextResponse,
	ChapterDetailResponse,
	ContentMetricResponse,
	FeedNonReviewPostItemResponse,
	FeedReviewItemResponse,
	FeedUnitItemResponse,
	FeedWikiItemResponse,
	LocalizedContentMetricResponse,
	MediaContentStructureNodeListResponse,
	OrdinaryPostDetailResponse,
	PostDetailResponse,
	ReviewDetailResponse,
	UnitDetailAttributionSummaryResponse,
	UnitProgressStatisticsResponse,
	UnitVariantContextResponse,
	WikiPostDetailResponse,
} from "./response";
import { ReactionSummaryResponse } from "./action-response";

describe("API response values", () => {
	it("keeps Date values in code and ISO timestamps on the wire", () => {
		const value = "2026-07-14T08:00:00.000Z";
		const decoded = Decode(DateTime, value);

		expect(Check(DateTimeString, value)).toBe(true);
		expect(decoded).toBeInstanceOf(Date);
		expect(decoded.toISOString()).toBe(value);
		expect(Encode(DateTime, decoded)).toBe(value);
	});

	it("encodes every Feed union variant from an explicit wire representation", () => {
		const createdAt = "2026-07-14T08:00:00.000Z";
		const updatedAt = "2026-07-15T09:30:00.000Z";
		const base = {
			id: "00000000-0000-4000-8000-000000000001",
			language: "en" as const,
			attributions: [],
			realmId: null,
			realms: [],
			title: null,
			createdAt,
			updatedAt,
			reactions: { upvote: 0, downvote: 0 },
			viewerReaction: null,
			recommendationReason: null,
			tracking: null,
		};
		const postBase = {
			...base,
			itemType: "post" as const,
			unitKind: "post" as const,
			summary: null,
			cover: null,
			subjectId: null,
			rootPostId: null,
			parentPostId: null,
			body: null,
			replyCount: 0,
			latestRevisionId: null,
			replyContext: null,
			subject: null,
		};
		const contents = [
			{
				...base,
				itemType: "unit" as const,
				unitKind: "book" as const,
				postKind: null,
				summary: null,
				cover: null,
				collection: null,
				presentation: { kind: "general" as const },
			} satisfies typeof FeedUnitItemResponse.static,
			{
				...postBase,
				postKind: "post" as const,
			} satisfies typeof FeedNonReviewPostItemResponse.static,
			{
				...postBase,
				postKind: "review" as const,
				scores: [],
			} satisfies typeof FeedReviewItemResponse.static,
			{
				...postBase,
				postKind: "wiki" as const,
				realmTagContext: null,
			} satisfies typeof FeedWikiItemResponse.static,
		];
		const response = {
			items: contents.map((content, index) => ({
				membership: {
					targetId: `00000000-0000-4000-8000-00000000000${index + 1}`,
					position: `a${index}`,
					createdAt,
				},
				content,
			})),
			nextCursor: null,
		} satisfies typeof CollectionContentResponse.static;

		expect(Check(CollectionContentResponse, response)).toBe(true);
		expect(Encode(CollectionContentResponse, response)).toEqual(response);
	});

	it("accepts proven Portable Text and rejects malformed persisted data", () => {
		const value = {
			_type: "portable-text" as const,
			_key: "001122aabbcc",
			content: [
				{
					_key: "block-1",
					_type: "block" as const,
					children: [
						{ _key: "span-1", _type: "span" as const, text: "Safe by construction" },
					],
				},
			],
		};

		expect(toPortableTextResponse(value)).toBe(value);
		expect(() =>
			toPortableTextResponse({
				_type: "portable-text",
				_key: "not-a-block-key",
				content: [],
			}),
		).toThrow("Invalid Block document");
	});

	it("keeps every viewer-safe Main-Variant state explicit", () => {
		const summary = {
			id: "00000000-0000-7000-8000-000000000001",
			type: "book",
			title: "Main title",
			cover: null,
		};
		expect(Check(UnitVariantContextResponse, { role: "standalone" })).toBe(true);
		expect(Check(UnitVariantContextResponse, { role: "main", variants: [summary] })).toBe(true);
		expect(
			Check(UnitVariantContextResponse, {
				role: "variant",
				relationUpdatedAt: "2026-07-20T00:00:00.000Z",
				main: { state: "available", unit: summary },
			}),
		).toBe(true);
		expect(
			Check(UnitVariantContextResponse, {
				role: "variant",
				relationUpdatedAt: "2026-07-20T00:00:00.000Z",
				main: { state: "unavailable" },
			}),
		).toBe(true);
		expect(
			Check(UnitVariantContextResponse, {
				role: "variant",
				relationUpdatedAt: "2026-07-20T00:00:00.000Z",
				main: { state: "unavailable", unit: summary },
			}),
		).toBe(false);
	});

	it("accepts only non-negative integer Unit progress statistics", () => {
		expect(Check(UnitProgressStatisticsResponse, { active: 2_540, backlog: 90_307 })).toBe(
			true,
		);
		expect(Check(UnitProgressStatisticsResponse, { active: -1, backlog: 0 })).toBe(false);
		expect(Check(UnitProgressStatisticsResponse, { active: 1.5, backlog: 0 })).toBe(false);
	});

	it("keeps word and character content metrics distinct and non-negative", () => {
		expect(Check(ContentMetricResponse, { wordCount: 2, characterCount: 4 })).toBe(true);
		expect(Check(ContentMetricResponse, { wordCount: -1, characterCount: 4 })).toBe(false);
		expect(
			Check(LocalizedContentMetricResponse, {
				language: "zh",
				chapterCount: 3,
				wordCount: 200,
				characterCount: 400,
			}),
		).toBe(true);
		expect(
			Check(LocalizedContentMetricResponse, {
				language: "zh",
				chapterCount: 3,
				wordCount: 200.5,
				characterCount: 400,
			}),
		).toBe(false);
	});

	it("keeps uninitialized Media structures distinct from initialized revisions", () => {
		const structureId = "00000000-0000-7000-8000-000000000001";
		const latestRevisionId = "00000000-0000-7000-8000-000000000002";

		expect(
			Check(MediaContentStructureNodeListResponse, {
				state: "uninitialized",
				items: [],
			}),
		).toBe(true);
		expect(
			Check(MediaContentStructureNodeListResponse, {
				state: "uninitialized",
				structureId,
				latestRevisionId,
				items: [],
			}),
		).toBe(false);
		expect(
			Check(MediaContentStructureNodeListResponse, {
				state: "initialized",
				structureId,
				latestRevisionId,
				items: [],
			}),
		).toBe(true);
		expect(
			Check(MediaContentStructureNodeListResponse, {
				state: "initialized",
				items: [],
			}),
		).toBe(false);
	});

	it("requires Scores only for Review Feed items", () => {
		expect(FeedReviewItemResponse.required).toContain("scores");
		expect(FeedReviewItemResponse.properties.postKind.const).toBe("review");
		expect(FeedReviewItemResponse.properties.scores.items.required).toEqual([
			"scoreId",
			"realmId",
			"realmTitle",
			"value",
		]);
		expect("scores" in FeedNonReviewPostItemResponse.properties).toBe(false);
	});

	it("keeps Post detail presentation and engagement context explicit", () => {
		expect(PostDetailResponse.anyOf).toHaveLength(5);
		expect(OrdinaryPostDetailResponse.required).toContain("subject");
		expect(OrdinaryPostDetailResponse.required).toContain("scores");
		expect(OrdinaryPostDetailResponse.properties.capabilities.required).toEqual([
			"canEdit",
			"canManageAttributions",
			"canManageAccess",
			"canReply",
		]);
		expect(ReviewDetailResponse.required).toContain("postKind");
		expect(ReviewDetailResponse.required).toContain("subject");
		expect(ReviewDetailResponse.required).toContain("scores");
		expect(ReviewDetailResponse.properties.scores.items.required).toEqual([
			"scoreId",
			"realmId",
			"realmTitle",
			"value",
		]);
		expect(ReviewDetailResponse.required).toContain("replyCount");
		expect(ReviewDetailResponse.properties.capabilities.required).toEqual([
			"canEdit",
			"canManageAttributions",
			"canManageAccess",
			"canManageScores",
			"canReply",
		]);
		expect(WikiPostDetailResponse.properties.postKind.const).toBe("wiki");
		expect(ChapterDetailResponse.properties.capabilities.required).toEqual(["canReply"]);
		expect(ReactionSummaryResponse.required).toContain("viewerReaction");
	});

	it("requires non-negative attribution statistics in Unit summaries", () => {
		const attribution = {
			id: "00000000-0000-7000-8000-000000000001",
			role: "author",
			position: "a0",
			creditedUnit: {
				id: "00000000-0000-7000-8000-000000000002",
				kind: "profile",
				language: "en",
				slugAddress: null,
				title: "Author",
				summary: null,
				avatar: null,
				creditedBookCount: 1,
				followerCount: 746,
			},
		};

		expect(Check(UnitDetailAttributionSummaryResponse, attribution)).toBe(true);
		expect(
			Check(UnitDetailAttributionSummaryResponse, {
				...attribution,
				creditedUnit: { ...attribution.creditedUnit, creditedBookCount: -1 },
			}),
		).toBe(false);
		expect(
			Check(UnitDetailAttributionSummaryResponse, {
				...attribution,
				creditedUnit: { ...attribution.creditedUnit, followerCount: 1.5 },
			}),
		).toBe(false);
	});
});
