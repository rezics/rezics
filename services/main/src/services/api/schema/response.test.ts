import { Check, Decode, Encode } from "@sinclair/typebox/value";
import { getActiveObservability } from "@rezics/observability";
import { SearchContinuationToken } from "@rezics/filter";
import { describe, expect, it, vi } from "vitest";

import {
	MaximumAudioTracksPerVideo,
	SubjectAssociationEntityTagPreviewLimit,
} from "../../database/schema/contract-values";

import { DateTime, DateTimeString } from ".";
import {
	CollectionContentResponse,
	toPortableTextResponse,
	BookChapterNodeDetailResponse,
	ChapterPostDetailResponse,
	ContentMetricResponse,
	EntityDetailResponse,
	FeedNonReviewPostItemResponse,
	FeedReviewItemResponse,
	FeedUnitItemResponse,
	FeedWikiItemResponse,
	LocalizedContentMetricResponse,
	MediaContentStructureNodeListResponse,
	ContentStructureNodeListResponse,
	OrdinaryPostDetailResponse,
	PostDetailResponse,
	ReviewDetailResponse,
	SearchResponse,
	UnitDetailResponse,
	UnitDetailAttributionSummaryResponse,
	UnitProgressStatisticsResponse,
	UnitVariantContextResponse,
	WikiPostDetailResponse,
} from "./response";
import { ReactionSummaryResponse } from "./action-response";

describe("API response values", () => {
	it("treats Search continuation tokens as opaque response values", () => {
		expect(
			Check(SearchResponse, {
				query: "",
				groups: [],
				facets: [],
				nextCursor: "s1_grouped-token",
			}),
		).toBe(true);
		expect(Check(SearchContinuationToken, "s2_global-token")).toBe(true);
		expect(Check(SearchContinuationToken, "")).toBe(false);
	});

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
			availableLanguages: ["en" as const],
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
			contentSpoiler: { level: 0 as const, concealed: false },
			contentNsfw: { labelled: false, concealed: false },
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

	it("keeps proven Portable Text and isolates malformed persisted data", () => {
		const value = {
			_type: "portable-text" as const,
			_key: "001122aabbcc",
			content: [
				{
					_key: "block-1",
					_type: "block" as const,
					children: [{ _key: "span-1", _type: "span" as const, text: "Safe by construction" }],
				},
			],
		};

		expect(toPortableTextResponse(value, "post.body")).toBe(value);
		const repaired = vi.spyOn(getActiveObservability().metrics, "persistedDocumentRepaired");
		expect(
			toPortableTextResponse(
				{
					_type: "portable-text",
					_key: "not-a-block-key",
					content: [null, { _type: "image", assetId: "not-a-uuid" }],
				},
				"post.body",
			),
		).toEqual({ _type: "portable-text", _key: "000000000000", content: [] });
		expect(repaired).toHaveBeenCalledWith("post.body");
	});

	it("keeps every viewer-safe Main-Variant state explicit", () => {
		const summary = {
			id: "00000000-0000-7000-8000-000000000001",
			type: "book",
			language: "en",
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
		expect(
			Check(UnitProgressStatisticsResponse, {
				active: { kind: "exact", value: 2_540 },
				backlog: { kind: "lower-bound", value: 90_307 },
			}),
		).toBe(true);
		expect(
			Check(UnitProgressStatisticsResponse, {
				active: { kind: "exact", value: -1 },
				backlog: { kind: "exact", value: 0 },
			}),
		).toBe(false);
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

	it("accepts Unit occurrences in Book and Media Content Structures", () => {
		const structureId = "00000000-0000-7000-8000-000000000001";
		const nodeId = "00000000-0000-7000-8000-000000000002";
		const contentUnitId = "00000000-0000-7000-8000-000000000003";
		const latestRevisionId = "00000000-0000-7000-8000-000000000004";

		expect(
			Check(ContentStructureNodeListResponse, {
				ownershipMode: "profile_owned",
				structureId,
				latestRevisionId,
				items: [
					{
						id: nodeId,
						parentId: null,
						contentUnitId,
						contentKind: "book",
						language: "en",
						title: "Referenced Book",
						position: "a0",
						contentMetrics: { wordCount: 120_000, characterCount: 0 },
					},
				],
			}),
		).toBe(true);
		expect(
			Check(MediaContentStructureNodeListResponse, {
				state: "initialized",
				structureId,
				latestRevisionId,
				items: [
					{
						id: nodeId,
						parentId: null,
						contentUnitId,
						contentKind: "media",
						language: "en",
						title: "Referenced Media",
						position: "a0",
						durationSeconds: 5_400,
					},
				],
			}),
		).toBe(true);
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
		expect(PostDetailResponse.anyOf).toHaveLength(6);
		expect(OrdinaryPostDetailResponse.required).toContain("subject");
		expect(OrdinaryPostDetailResponse.required).toContain("scores");
		expect(OrdinaryPostDetailResponse.properties.capabilities.required).toEqual([
			"canEdit",
			"canManageAttributions",
			"canManageRealmPublications",
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
		expect(ReviewDetailResponse.required).toContain("latestRevisionId");
		expect(ReviewDetailResponse.properties.capabilities.required).toEqual([
			"canEdit",
			"canManageAttributions",
			"canManageRealmPublications",
			"canManageAccess",
			"canManageScores",
			"canReply",
		]);
		expect(WikiPostDetailResponse.properties.postKind.const).toBe("wiki");
		expect(ChapterPostDetailResponse.properties.postKind.const).toBe("chapter");
		expect(ChapterPostDetailResponse.properties.body.anyOf).toBeDefined();
		expect(BookChapterNodeDetailResponse.properties.capabilities.required).toEqual(["canReply"]);
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
				creditedBookCount: { kind: "exact", value: 1 },
				followerCount: 746,
			},
		};

		expect(Check(UnitDetailAttributionSummaryResponse, attribution)).toBe(true);
		expect(
			Check(UnitDetailAttributionSummaryResponse, {
				...attribution,
				creditedUnit: {
					...attribution.creditedUnit,
					creditedBookCount: { kind: "exact", value: -1 },
				},
			}),
		).toBe(false);
		expect(
			Check(UnitDetailAttributionSummaryResponse, {
				...attribution,
				creditedUnit: { ...attribution.creditedUnit, followerCount: 1.5 },
			}),
		).toBe(false);
	});

	it("does not include format in Unit detail responses", () => {
		const bookDetails = {
			type: "book" as const,
			releaseStatus: "ongoing" as const,
			metadataOnly: false,
			isbn13: null,
			publicationDate: null,
			pageCount: null,
			wordCount: null,
			publishedContentMetrics: [],
		};

		expect(Check(UnitDetailResponse.properties.details, bookDetails)).toBe(true);
		expect(
			Check(UnitDetailResponse.properties.details, { ...bookDetails, format: "paperback" }),
		).toBe(false);
		expect(
			UnitDetailResponse.properties.details.anyOf.some((schema) => "format" in schema.properties),
		).toBe(false);
	});

	it("requires metadata-only state and its independent update capability", () => {
		for (const type of ["book", "software", "media"] as const) {
			const details = UnitDetailResponse.properties.details.anyOf.find(
				(schema) => schema.properties.type.const === type,
			);
			expect(details?.required).toContain("metadataOnly");
		}
		expect(UnitDetailResponse.properties.capabilities.required).toContain("canUpdateMetadataOnly");
	});

	it("uses canonical nullable adapted Audio sets on Video details", () => {
		const videoDetails = {
			type: "video",
			durationSeconds: null,
			adaptedAudioUnitIds: null,
		} as const;
		expect(Check(UnitDetailResponse.properties.details, videoDetails)).toBe(true);
		expect(
			Check(UnitDetailResponse.properties.details, {
				...videoDetails,
				adaptedAudioUnitIds: ["019b0000-0000-7000-8000-000000000001"],
			}),
		).toBe(true);
		expect(
			Check(UnitDetailResponse.properties.details, {
				...videoDetails,
				adaptedAudioUnitIds: Array.from(
					{ length: MaximumAudioTracksPerVideo + 1 },
					(_, index) => `019b0000-0000-7000-8000-${String(index).padStart(12, "0")}`,
				),
			}),
		).toBe(false);
	});

	it("bounds each subject Entity Tag preview at the shared response limit", () => {
		const tags = UnitDetailResponse.properties.subjectAssociations.items.properties.tags;
		expect(tags.maxItems).toBe(SubjectAssociationEntityTagPreviewLimit);
		const tag = {
			tagId: "019b0000-0000-7000-8000-000000000001",
			title: "Character",
		};
		expect(
			Check(
				tags,
				Array.from({ length: SubjectAssociationEntityTagPreviewLimit }, () => tag),
			),
		).toBe(true);
		expect(
			Check(
				tags,
				Array.from({ length: SubjectAssociationEntityTagPreviewLimit + 1 }, () => tag),
			),
		).toBe(false);
	});

	it("uses one vote-backed external-link contract with source presentation on every detail", () => {
		const unitExternalLink = UnitDetailResponse.properties.externalLinks.items;
		const entityExternalLink = EntityDetailResponse.properties.externalLinks.items;

		expect(unitExternalLink).toBe(entityExternalLink);
		expect(unitExternalLink.required).not.toContain("accepted");
		expect(unitExternalLink.required).toContain("voteSummary");
		expect(unitExternalLink.required).toContain("sourceEntity");
		expect(unitExternalLink.properties.sourceEntity.required).toContain("avatar");
	});
});
