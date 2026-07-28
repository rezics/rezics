import { PlatformCapabilityValues } from "@rezics/access";
import { type Static, t } from "elysia";
import {
	FontAwesomeIconNamePatternSource,
	FontAwesomeIconPrefixValues,
	FontAwesomeProvider,
} from "@rezics/avatar";
import {
	CollectionDefinitionDocument,
	CollectionPresentationDocument,
	PortableTextDocument,
	parseDocument,
	type PortableTextDocument as PortableTextDocumentValue,
} from "@rezics/block";
import {
	ChineseContentDisplay,
	ContentLanguage,
	ContentRating,
	DateTime,
	FractionalPosition,
	OrdinalPosition,
	PublicationLicense,
	ResourceVisibility,
	StoredUiLocale,
	Uuid,
} from ".";
import {
	ContentRatingValues,
	ContentStructureKindValues,
	CreditAttributionRoleValues,
	ProgressDatePrecisionValues,
	ProgressEntryKindValues,
	ProgressSourceKindValues,
	ProgressStatusValues,
	SubjectAssociationRoleValues,
	UnitKindValues,
} from "../../database/schema/contract-values";
import { FeedNonReviewPostKindValues, FeedUnitKindValues } from "../feed/schema";
import {
	RecommendationReasonSchema,
	RecommendationTrackingSchema,
} from "../recommendations/schema";
import { HealthCheckStateValues } from "../../health/model";
import { CollectionConfigV1 } from "../users/schema";
import { NullablePublicSlugAddressResponse } from "../slug-addresses/schema";
export { toApiErrorResponse } from "./error-response";

const NullableText = t.Nullable(t.String());
const OrdinaryPostKindResponse = t.Union([t.Literal("post"), t.Literal("reply")]);
export function toPortableTextResponse(value: unknown): PortableTextDocumentValue {
	return parseDocument(PortableTextDocument, value);
}

export const CompletionStateResponse = t.Object({ completed: t.Boolean() });
export const UpdateStateResponse = t.Object({ updated: t.Boolean() });

export const HealthResponse = t.Object({ status: t.Literal("ok") });
const ReadinessCheckResponse = t.Object({
	state: t.UnionEnum(HealthCheckStateValues),
	latencyMs: t.Integer({ minimum: 0 }),
});
export const ReadinessResponse = t.Object({
	status: t.Union([t.Literal("ready"), t.Literal("unavailable")]),
	checks: t.Object({
		database: ReadinessCheckResponse,
		storage: ReadinessCheckResponse,
		recommendations: ReadinessCheckResponse,
		search: ReadinessCheckResponse,
	}),
});

export const ImageAssetResponse = t.Nullable(t.Object({ id: Uuid, url: t.String() }));
export const AvatarResponse = t.Nullable(
	t.Union([
		t.Object(
			{ type: t.Literal("image"), image: t.Object({ id: Uuid, url: t.String() }) },
			{ additionalProperties: false },
		),
		t.Object(
			{ type: t.Literal("emoji"), emoji: t.String({ maxLength: 64 }) },
			{ additionalProperties: false },
		),
		t.Object(
			{
				type: t.Literal("icon"),
				icon: t.Object(
					{
						provider: t.Literal(FontAwesomeProvider),
						prefix: t.UnionEnum(FontAwesomeIconPrefixValues, { default: undefined }),
						name: t.String({
							pattern: FontAwesomeIconNamePatternSource,
							maxLength: 128,
						}),
					},
					{ additionalProperties: false },
				),
			},
			{ additionalProperties: false },
		),
	]),
);
const LocalizationImageResponse = {
	avatar: AvatarResponse,
	banner: ImageAssetResponse,
	cover: ImageAssetResponse,
};

export const LocalizationResponse = t.Object({
	unitId: Uuid,
	language: ContentLanguage,
	position: FractionalPosition,
	title: NullableText,
	summary: NullableText,
	description: t.Nullable(PortableTextDocument),
	...LocalizationImageResponse,
	createdAt: DateTime,
	updatedAt: DateTime,
});
export const ContentMetricResponse = t.Object(
	{
		wordCount: t.Integer({ minimum: 0 }),
		characterCount: t.Integer({ minimum: 0 }),
	},
	{ additionalProperties: false },
);

export const LocalizedContentMetricResponse = t.Object(
	{
		language: ContentLanguage,
		chapterCount: t.Integer({ minimum: 0 }),
		...ContentMetricResponse.properties,
	},
	{ additionalProperties: false },
);

const UnitSummaryFields = {
	id: Uuid,
	kind: t.UnionEnum(UnitKindValues),
	language: ContentLanguage,
	slugAddress: NullablePublicSlugAddressResponse,
	title: NullableText,
	summary: NullableText,
	avatar: AvatarResponse,
} as const;

export const UnitSummaryResponse = t.Object(UnitSummaryFields);
export const UnitPresentationListResponse = t.Object({
	items: t.Array(
		t.Object({
			id: Uuid,
			kind: t.UnionEnum(UnitKindValues),
			title: NullableText,
			avatar: AvatarResponse,
		}),
	),
});

const UnitAttributionSummaryFields = {
	id: Uuid,
	role: t.UnionEnum(CreditAttributionRoleValues),
	position: FractionalPosition,
} as const;

export const UnitAttributionSummaryResponse = t.Object({
	...UnitAttributionSummaryFields,
	creditedUnit: UnitSummaryResponse,
});

export const UnitDetailAttributionSummaryResponse = t.Object({
	...UnitAttributionSummaryFields,
	creditedUnit: t.Object({
		...UnitSummaryFields,
		creditedBookCount: t.Integer({ minimum: 0 }),
		followerCount: t.Integer({ minimum: 0 }),
	}),
});

export const UnitListResponse = t.Object({
	items: t.Array(
		t.Object({
			id: Uuid,
			language: ContentLanguage,
			contentRating: t.String(),
			publishedAt: t.Nullable(DateTime),
			createdAt: DateTime,
			updatedAt: DateTime,
			title: NullableText,
			summary: NullableText,
			attributions: t.Array(UnitAttributionSummaryResponse),
			avatar: AvatarResponse,
			banner: ImageAssetResponse,
			cover: ImageAssetResponse,
		}),
	),
	nextCursor: NullableText,
});

export const UnitVariantSummaryResponse = t.Object(
	{
		id: Uuid,
		type: t.UnionEnum(["book", "software", "media"]),
		title: NullableText,
		cover: ImageAssetResponse,
	},
	{ additionalProperties: false },
);

export const UnitVariantContextResponse = t.Union([
	t.Object({ role: t.Literal("standalone") }, { additionalProperties: false }),
	t.Object(
		{
			role: t.Literal("main"),
			variants: t.Array(UnitVariantSummaryResponse),
		},
		{ additionalProperties: false },
	),
	t.Object(
		{
			role: t.Literal("variant"),
			relationUpdatedAt: DateTime,
			main: t.Union([
				t.Object(
					{ state: t.Literal("available"), unit: UnitVariantSummaryResponse },
					{ additionalProperties: false },
				),
				t.Object({ state: t.Literal("unavailable") }, { additionalProperties: false }),
			]),
		},
		{ additionalProperties: false },
	),
]);

const CatalogUnitTypeResponse = t.Union([
	t.Literal("book"),
	t.Literal("software"),
	t.Literal("media"),
	t.Literal("series"),
]);

const UnitDetailsResponse = t.Union([
	t.Object(
		{
			type: t.Literal("book"),
			isbn13: NullableText,
			publicationDate: t.Nullable(t.String({ format: "date" })),
			pageCount: t.Nullable(t.Integer({ minimum: 1 })),
			/** Editorial catalog metadata; never derived from hosted chapters. */
			wordCount: t.Nullable(t.Integer({ minimum: 0 })),
			publishedContentMetrics: t.Array(LocalizedContentMetricResponse),
			format: NullableText,
			licensed: t.Boolean(),
		},
		{ additionalProperties: false },
	),
	t.Object(
		{
			type: t.Literal("software"),
			releaseDate: t.Nullable(t.String({ format: "date" })),
			versionLabel: NullableText,
			licensed: t.Boolean(),
		},
		{ additionalProperties: false },
	),
	t.Object(
		{
			type: t.Literal("media"),
			releaseDate: t.Nullable(t.String({ format: "date" })),
			kind: t.String(),
			runtimeMinutes: t.Nullable(t.Integer({ minimum: 1 })),
			episodeCount: t.Nullable(t.Integer({ minimum: 1 })),
			seasonCount: t.Nullable(t.Integer({ minimum: 1 })),
			licensed: t.Boolean(),
		},
		{ additionalProperties: false },
	),
	t.Object({ type: t.Literal("series"), kind: t.String() }, { additionalProperties: false }),
]);

export const UnitProgressStatisticsResponse = t.Object({
	active: t.Integer({ minimum: 0 }),
	backlog: t.Integer({ minimum: 0 }),
});

export const AssociationContextPostResponse = t.Object({
	id: Uuid,
	subjectId: t.Nullable(Uuid),
	title: NullableText,
	tags: t.Array(
		t.Object({
			tagId: Uuid,
			title: NullableText,
			score: t.Integer(),
			voteCount: t.Integer({ minimum: 0 }),
			pinned: t.Boolean(),
		}),
	),
});

export const UnitDetailResponse = t.Object({
	id: Uuid,
	type: CatalogUnitTypeResponse,
	status: t.String(),
	visibility: t.String(),
	language: t.Nullable(ContentLanguage),
	contentRating: t.String(),
	aiDisclosure: t.String(),
	license: t.Nullable(PublicationLicense),
	postTargetingLocked: t.Boolean(),
	publishedAt: t.Nullable(DateTime),
	attributions: t.Array(UnitDetailAttributionSummaryResponse),
	createdAt: DateTime,
	updatedAt: DateTime,
	releasedOn: t.Nullable(t.String()),
	details: UnitDetailsResponse,
	avatar: AvatarResponse,
	banner: ImageAssetResponse,
	cover: ImageAssetResponse,
	localizations: t.Array(LocalizationResponse),
	subjectAssociations: t.Array(
		t.Object({
			id: Uuid,
			entityEntryId: Uuid,
			role: t.UnionEnum(SubjectAssociationRoleValues),
			position: FractionalPosition,
			title: NullableText,
			contextPost: t.Nullable(AssociationContextPostResponse),
		}),
	),
	links: t.Array(
		t.Object({
			id: Uuid,
			unitId: Uuid,
			kind: t.String(),
			url: t.String(),
			sourceEntityEntryId: t.Nullable(Uuid),
			normalizedUrl: NullableText,
			normalizedUrlHash: NullableText,
			position: FractionalPosition,
			createdAt: DateTime,
			updatedAt: DateTime,
		}),
	),
	tags: t.Array(
		t.Object({
			id: Uuid,
			tagId: Uuid,
			realmId: t.Nullable(Uuid),
			score: t.Integer(),
			voteCount: t.Integer(),
			pinned: t.Boolean(),
			position: t.Nullable(FractionalPosition),
			title: NullableText,
			createdAt: DateTime,
			updatedAt: DateTime,
		}),
	),
	progressStatistics: t.Nullable(UnitProgressStatisticsResponse),
	versions: t.Array(
		t.Object({
			id: Uuid,
			kind: t.String(),
			canonicalUnitId: t.Nullable(Uuid),
		}),
	),
	variantContext: UnitVariantContextResponse,
	capabilities: t.Object({
		canEdit: t.Boolean(),
		canManageAccess: t.Boolean(),
		canManageAssociations: t.Boolean(),
		canManageTags: t.Boolean(),
		hasDevelopmentPreviewAccess: t.Boolean(),
	}),
});

const SearchHit = t.Object({
	id: Uuid,
	slugAddress: NullablePublicSlugAddressResponse,
	category: t.String(),
	kind: t.String(),
	titles: t.Array(t.String()),
	summaries: t.Array(t.String()),
	avatar: t.Optional(AvatarResponse),
	variantRole: t.Optional(t.UnionEnum(["standalone", "main", "variant"])),
	variantMain: t.Optional(
		t.Union([
			t.Object({ state: t.Literal("unavailable") }),
			t.Object({
				state: t.Literal("available"),
				unit: UnitVariantSummaryResponse,
			}),
		]),
	),
	name: t.Optional(NullableText),
	summary: t.Optional(NullableText),
});
const SearchExactness = t.Object({
	value: t.Integer({ minimum: 0 }),
	relation: t.UnionEnum(["exact", "lower-bound"]),
});
export const SearchResponse = t.Object({
	query: t.String(),
	nextCursor: t.Optional(t.String({ maxLength: 4096, pattern: "^s2_[A-Za-z0-9_-]+$" })),
	facets: t.Optional(
		t.Array(
			t.Object({
				controlKey: t.Optional(t.String()),
				field: t.String(),
				options: t.Array(t.Object({ value: t.String(), count: SearchExactness })),
			}),
		),
	),
	groups: t.Array(
		t.Object({
			index: t.String(),
			hits: t.Array(SearchHit),
			total: SearchExactness,
			limit: t.Integer(),
			processingTimeMs: t.Number(),
		}),
	),
});
export const DomainSearchResponse = t.Object({
	hits: t.Array(SearchHit),
	total: SearchExactness,
	nextCursor: t.Optional(t.String({ maxLength: 4096, pattern: "^s2_[A-Za-z0-9_-]+$" })),
	limit: t.Integer(),
	processingTimeMs: t.Number(),
});

export const EntityListResponse = t.Object({
	items: t.Array(
		t.Object({
			id: Uuid,
			kind: t.String(),
			verified: t.Boolean(),
			language: ContentLanguage,
			avatar: AvatarResponse,
			banner: ImageAssetResponse,
			cover: ImageAssetResponse,
			title: NullableText,
			summary: NullableText,
		}),
	),
});
export const TagListResponse = t.Object({
	items: t.Array(
		t.Object({
			id: Uuid,
			language: ContentLanguage,
			title: NullableText,
			summary: NullableText,
		}),
	),
});
export const CollectionListResponse = t.Object({
	items: t.Array(
		t.Object({
			id: Uuid,
			ownerId: Uuid,
			source: t.UnionEnum(["manual", "search", "system"]),
			systemKey: t.Nullable(t.Literal("favorites")),
			language: ContentLanguage,
			itemCount: t.Integer(),
			containsTarget: t.Boolean(),
			acceptsItems: t.Boolean(),
			latestRevisionId: Uuid,
			title: NullableText,
			summary: NullableText,
			cover: ImageAssetResponse,
			updatedAt: DateTime,
		}),
	),
});
export const RealmListResponse = t.Object({
	items: t.Array(
		t.Object({
			id: Uuid,
			slugAddress: NullablePublicSlugAddressResponse,
			joinPolicy: t.String(),
			memberCount: t.Integer({ minimum: 0 }),
			language: ContentLanguage,
			title: NullableText,
			summary: NullableText,
			avatar: AvatarResponse,
			banner: ImageAssetResponse,
			cover: ImageAssetResponse,
			createdAt: DateTime,
			updatedAt: DateTime,
		}),
	),
});
export const PostListResponse = t.Object({
	items: t.Array(
		t.Object({
			id: Uuid,
			postKind: OrdinaryPostKindResponse,
			language: ContentLanguage,
			attributions: t.Array(UnitAttributionSummaryResponse),
			realmId: t.Nullable(Uuid),
			subjectId: t.Nullable(Uuid),
			rootPostId: t.Nullable(Uuid),
			parentPostId: t.Nullable(Uuid),
			body: PortableTextDocument,
			replyCount: t.Integer(),
			title: NullableText,
			latestRevisionId: t.Nullable(Uuid),
			createdAt: DateTime,
			updatedAt: DateTime,
		}),
	),
});
const FeedItemBaseResponse = {
	id: Uuid,
	language: t.Nullable(ContentLanguage),
	attributions: t.Array(UnitAttributionSummaryResponse),
	realmId: t.Nullable(Uuid),
	realms: t.Array(
		t.Object({
			id: Uuid,
			language: ContentLanguage,
			slugAddress: NullablePublicSlugAddressResponse,
			title: NullableText,
			summary: NullableText,
			avatar: AvatarResponse,
		}),
	),
	title: NullableText,
	createdAt: DateTime,
	updatedAt: DateTime,
	reactions: t.Object({ upvote: t.Integer(), downvote: t.Integer() }),
	viewerReaction: NullableText,
	recommendationReason: t.Nullable(RecommendationReasonSchema),
	tracking: t.Nullable(RecommendationTrackingSchema),
};

const FeedUnitItemFields = {
	...FeedItemBaseResponse,
	itemType: t.Literal("unit"),
	unitKind: t.UnionEnum(FeedUnitKindValues),
	postKind: t.Null(),
	summary: NullableText,
	cover: ImageAssetResponse,
	collection: t.Nullable(
		t.Object({
			directItemCount: t.Integer({ minimum: 0 }),
		}),
	),
} as const;

const FeedRatingAggregateResponse = t.Object({
	contextUnitId: Uuid,
	contextTitle: NullableText,
	totalScore: t.Integer({ minimum: 1 }),
	totalCount: t.Integer({ minimum: 1 }),
});

const FeedScoreCandidatesResponse = t.Object({
	preferred: t.Nullable(FeedRatingAggregateResponse),
	global: t.Nullable(FeedRatingAggregateResponse),
});

const PostSubjectPresentationFields = {
	id: Uuid,
	type: t.String(),
	language: ContentLanguage,
	title: NullableText,
	summary: NullableText,
	cover: ImageAssetResponse,
} as const;

const PostAttachedScoreResponse = t.Object({
	scoreId: Uuid,
	contextUnitId: Uuid,
	value: t.Integer({ minimum: 1, maximum: 10 }),
});

const FeedUnitPresentationResponse = t.Union([
	t.Object({
		kind: t.Literal("rated-work"),
		scores: FeedScoreCandidatesResponse,
	}),
	t.Object({
		kind: t.Literal("identity"),
		avatar: AvatarResponse,
		banner: ImageAssetResponse,
		memberCount: t.Nullable(t.Integer({ minimum: 0 })),
	}),
	t.Object({
		kind: t.Literal("general"),
	}),
]);

export const FeedUnitItemResponse = t.Object({
	...FeedUnitItemFields,
	presentation: FeedUnitPresentationResponse,
});

const FeedPostItemFields = {
	...FeedItemBaseResponse,
	itemType: t.Literal("post"),
	unitKind: t.Literal("post"),
	summary: NullableText,
	cover: ImageAssetResponse,
	subjectId: t.Nullable(Uuid),
	rootPostId: t.Nullable(Uuid),
	parentPostId: t.Nullable(Uuid),
	body: t.Nullable(PortableTextDocument),
	replyCount: t.Integer(),
	latestRevisionId: t.Nullable(Uuid),
	replyContext: t.Nullable(
		t.Object({
			rootPostId: Uuid,
			title: NullableText,
			attributions: t.Array(UnitAttributionSummaryResponse),
			subjectId: t.Nullable(Uuid),
		}),
	),
	subject: t.Nullable(
		t.Object({
			...PostSubjectPresentationFields,
			scores: FeedScoreCandidatesResponse,
		}),
	),
} as const;

export const FeedNonReviewPostItemResponse = t.Object({
	...FeedPostItemFields,
	postKind: t.UnionEnum(FeedNonReviewPostKindValues),
});

export const FeedReviewItemResponse = t.Object({
	...FeedPostItemFields,
	postKind: t.Literal("review"),
	scores: t.Array(PostAttachedScoreResponse),
});

export const FeedPostItemResponse = t.Union([
	FeedNonReviewPostItemResponse,
	FeedReviewItemResponse,
]);

export type FeedItemResponseValue =
	| Static<typeof FeedUnitItemResponse>
	| Static<typeof FeedNonReviewPostItemResponse>
	| Static<typeof FeedReviewItemResponse>;

export const FeedResponse = t.Object({
	items: t.Array(t.Union([FeedUnitItemResponse, FeedPostItemResponse])),
	nextCursor: NullableText,
});

export const SearchFeedResponse = t.Object({
	items: t.Array(t.Union([FeedUnitItemResponse, FeedPostItemResponse])),
	nextCursor: SearchResponse.properties.nextCursor,
	facets: SearchResponse.properties.facets,
	total: t.Integer({ minimum: 0 }),
});

export const PostFeedResponse = t.Object({
	items: t.Array(FeedPostItemResponse),
	nextCursor: NullableText,
});
export const ReviewListResponse = t.Object({
	totalCount: t.Integer({ minimum: 0 }),
	nextCursor: NullableText,
	items: t.Array(
		t.Object({
			...FeedReviewItemResponse.properties,
			targetId: Uuid,
		}),
	),
});

export const PublicProfileResponse = t.Object({
	id: Uuid,
	slugAddress: NullablePublicSlugAddressResponse,
	status: t.String(),
	visibility: t.String(),
	language: ContentLanguage,
	name: NullableText,
	avatar: AvatarResponse,
	banner: ImageAssetResponse,
	summary: NullableText,
	description: t.Nullable(PortableTextDocument),
	createdAt: DateTime,
	updatedAt: DateTime,
	viewerFollowing: t.Optional(t.Boolean()),
});
export const CurrentProfileResponse = t.Intersect([
	PublicProfileResponse,
	t.Object({
		email: t.String(),
		emailVerified: t.Boolean(),
		onboarding: t.String(),
		platformCapabilities: t.Array(t.UnionEnum(PlatformCapabilityValues), {
			uniqueItems: true,
		}),
	}),
]);
export const PreferencesResponse = t.Object({
	profileId: Uuid,
	interfaceLocale: StoredUiLocale,
	chineseContentDisplay: ChineseContentDisplay,
	defaultLicense: t.Nullable(PublicationLicense),
	defaultRealmManageMode: t.Boolean(),
	defaultScoreContextUnitId: Uuid,
	scoreVisibility: ResourceVisibility,
	progressVisibility: ResourceVisibility,
	collectionConfig: t.Nullable(CollectionConfigV1),
	personalizedFeed: t.Boolean(),
	filterFeedByPreferredLanguages: t.Boolean(),
	contentRatings: t.Array(ContentRating, {
		minItems: 1,
		uniqueItems: true,
	}),
	preferredLanguages: t.Array(ContentLanguage),
});
export const PrivacyPreferencesResponse = t.Object({
	scoreVisibility: ResourceVisibility,
	progressVisibility: ResourceVisibility,
});
export const ProfileActivityResponse = t.Object({
	scores: t.Array(
		t.Object({
			scoreId: Uuid,
			unitId: Uuid,
			unitKind: t.UnionEnum(UnitKindValues),
			unitLanguage: t.Nullable(ContentLanguage),
			unitTitle: NullableText,
			contextUnitId: Uuid,
			contextTitle: NullableText,
			value: t.Integer({ minimum: 1, maximum: 10 }),
			visibility: ResourceVisibility,
			updatedAt: DateTime,
		}),
	),
	progress: t.Array(
		t.Object({
			unitId: Uuid,
			unitKind: t.UnionEnum(UnitKindValues),
			unitLanguage: t.Nullable(ContentLanguage),
			unitTitle: NullableText,
			status: t.UnionEnum(ProgressStatusValues),
			progress: t.Number({ minimum: 0, maximum: 1 }),
			completedCount: t.Integer({ minimum: 0 }),
			visibility: ResourceVisibility,
			lastSeenAt: DateTime,
		}),
	),
});
const ProgressStatusResponse = t.UnionEnum(ProgressStatusValues);
const ProgressEntryKindResponse = t.UnionEnum(ProgressEntryKindValues);
const ProgressDatePrecisionResponse = t.UnionEnum(ProgressDatePrecisionValues);
const ProgressSourceKindResponse = t.UnionEnum(ProgressSourceKindValues);
export const ProgressListResponse = t.Object({
	items: t.Array(
		t.Object({
			unitId: Uuid,
			status: ProgressStatusResponse,
			progress: t.Number(),
			completedCount: t.Integer(),
			totalTimeMs: t.Integer(),
			firstSeenAt: DateTime,
			lastSeenAt: DateTime,
			lastContentStructureNodeId: t.Nullable(Uuid),
			lastReadAnchor: t.Nullable(t.Unknown()),
			visibility: ResourceVisibility,
			type: t.String(),
			language: ContentLanguage,
			title: NullableText,
		}),
	),
});
export const ProgressResponse = t.Object({
	profileId: Uuid,
	unitId: Uuid,
	status: ProgressStatusResponse,
	progress: t.Number(),
	isDeleted: t.Boolean(),
	completedCount: t.Integer(),
	totalTimeMs: t.Integer(),
	firstSeenAt: DateTime,
	lastSeenAt: DateTime,
	lastContentStructureNodeId: t.Nullable(Uuid),
	currentEntryId: t.Nullable(Uuid),
	lastReadAnchor: t.Nullable(t.Unknown()),
	visibility: ResourceVisibility,
	createdAt: DateTime,
	updatedAt: DateTime,
});
export const ProgressEntryResponse = t.Object({
	id: Uuid,
	profileId: Uuid,
	unitId: Uuid,
	entryKind: ProgressEntryKindResponse,
	status: ProgressStatusResponse,
	progress: t.Number({ minimum: 0, maximum: 1 }),
	completionDelta: t.Integer({ minimum: 0, maximum: 1 }),
	totalTimeMs: t.Integer({ minimum: 0 }),
	lastContentStructureNodeId: t.Nullable(Uuid),
	contentStructureRevisionId: t.Nullable(Uuid),
	occurredAt: t.Nullable(DateTime),
	datePrecision: ProgressDatePrecisionResponse,
	sourceKind: ProgressSourceKindResponse,
	sourceProvider: NullableText,
	sourceExternalId: NullableText,
	affectsCurrent: t.Boolean(),
	reviewId: t.Nullable(Uuid),
	createdAt: DateTime,
	updatedAt: DateTime,
});
export const ProgressEntryListResponse = t.Object({
	items: t.Array(ProgressEntryResponse),
	nextCursor: NullableText,
});
const ReviewProgressEntryResponse = t.Object({
	unitId: Uuid,
	entryKind: ProgressEntryKindResponse,
	status: ProgressStatusResponse,
	progress: t.Number({ minimum: 0, maximum: 1 }),
	completionDelta: t.Integer({ minimum: 0, maximum: 1 }),
	occurredAt: t.Nullable(DateTime),
	datePrecision: ProgressDatePrecisionResponse,
});
export const ImportProgressResponse = t.Object({
	createdCount: t.Integer({ minimum: 1, maximum: 500 }),
	entryIds: t.Array(Uuid, { minItems: 1, maxItems: 500 }),
});
export const ProgressNodeListResponse = t.Object({
	items: t.Array(
		t.Object({
			nodeId: Uuid,
			completedAt: DateTime,
		}),
	),
});
export const PollDetailResponse = t.Object({
	id: Uuid,
	language: ContentLanguage,
	question: t.String(),
	voteMode: t.String(),
	anonymous: t.Boolean(),
	resultsVisibility: t.String(),
	closesAt: t.Nullable(DateTime),
	createdAt: DateTime,
	closed: t.Boolean(),
	viewerOptionIds: t.Array(Uuid),
	options: t.Array(
		t.Union([
			t.Object({
				id: Uuid,
				sourceKind: t.Literal("literal"),
				targetUnitId: t.Null(),
				label: t.String(),
				position: OrdinalPosition,
				voteCount: t.Nullable(t.Integer()),
			}),
			t.Object({
				id: Uuid,
				sourceKind: t.Literal("unit"),
				targetUnitId: Uuid,
				label: t.String(),
				position: OrdinalPosition,
				voteCount: t.Nullable(t.Integer()),
			}),
		]),
	),
});
const LocalizationSummary = t.Object({
	language: ContentLanguage,
	title: NullableText,
	summary: NullableText,
	...LocalizationImageResponse,
});
export const EntityDetailResponse = t.Object({
	id: Uuid,
	kind: t.String(),
	verified: t.Boolean(),
	language: t.Nullable(ContentLanguage),
	avatar: AvatarResponse,
	banner: ImageAssetResponse,
	cover: ImageAssetResponse,
	createdAt: DateTime,
	updatedAt: DateTime,
	localizations: t.Array(LocalizationResponse),
	attributions: t.Array(UnitAttributionSummaryResponse),
	owner: t.Nullable(UnitSummaryResponse),
	capabilities: t.Object({
		canEdit: t.Boolean(),
		canEditCreditAttributions: t.Boolean(),
		canManageAccess: t.Boolean(),
		canManageCreditAssociations: t.Boolean(),
		canManageSubjectAssociations: t.Boolean(),
	}),
	creditAttributions: t.Array(
		t.Object({
			id: Uuid,
			sourceUnitId: Uuid,
			role: t.UnionEnum(CreditAttributionRoleValues),
		}),
	),
	subjectAssociations: t.Array(
		t.Object({
			id: Uuid,
			unitId: Uuid,
			role: t.UnionEnum(SubjectAssociationRoleValues),
			contextPost: t.Nullable(AssociationContextPostResponse),
		}),
	),
});
export const CollectionDetailResponse = t.Object({
	id: Uuid,
	status: t.String(),
	visibility: t.String(),
	language: ContentLanguage,
	source: t.Union([t.Literal("manual"), t.Literal("search"), t.Literal("system")]),
	systemKey: t.Nullable(t.Literal("favorites")),
	definitionDocument: CollectionDefinitionDocument,
	presentationDocument: CollectionPresentationDocument,
	ownerId: Uuid,
	itemCount: t.Integer(),
	latestRevisionId: Uuid,
	createdAt: DateTime,
	updatedAt: DateTime,
	localizations: t.Array(LocalizationSummary),
	capabilities: t.Object({
		canEditDetails: t.Boolean(),
		canManageItems: t.Boolean(),
		canEditPresentation: t.Boolean(),
		canManageLocalizations: t.Boolean(),
		canManageAccess: t.Boolean(),
		canViewHistory: t.Boolean(),
		canRestoreHistory: t.Boolean(),
		canDelete: t.Boolean(),
	}),
});
export const CollectionContentResponse = t.Object({
	items: t.Array(
		t.Object({
			membership: t.Object({
				targetId: Uuid,
				role: t.UnionEnum(["item", "featured", "favorite"]),
				parentTargetId: t.Nullable(Uuid),
				position: FractionalPosition,
				createdAt: DateTime,
			}),
			content: t.Union([FeedUnitItemResponse, FeedPostItemResponse]),
		}),
	),
	nextCursor: NullableText,
});
export const RealmDetailResponse = t.Object({
	id: Uuid,
	slugAddress: NullablePublicSlugAddressResponse,
	status: t.String(),
	visibility: t.String(),
	language: t.Nullable(ContentLanguage),
	joinPolicy: t.String(),
	memberCount: t.Integer({ minimum: 0 }),
	createdAt: DateTime,
	updatedAt: DateTime,
	avatar: AvatarResponse,
	banner: ImageAssetResponse,
	cover: ImageAssetResponse,
	localizations: t.Array(LocalizationSummary),
	viewerFollowing: t.Boolean(),
	viewerMembership: t.Optional(t.Object({ isOwner: t.Boolean(), state: t.String() })),
	capabilities: t.Object({
		canCreateUnits: t.Boolean(),
		canCreateReplies: t.Boolean(),
		canUpdateSettings: t.Boolean(),
		canReadMembers: t.Boolean(),
		canManageMembers: t.Boolean(),
		canUpdateRules: t.Boolean(),
		canManagePins: t.Boolean(),
		canModerateUnits: t.Boolean(),
		canManageAccess: t.Boolean(),
		canRestoreHistory: t.Boolean(),
	}),
});
const PostThreadDetailFields = {
	id: Uuid,
	attributions: t.Array(UnitAttributionSummaryResponse),
	realmId: t.Nullable(Uuid),
	subjectId: t.Nullable(Uuid),
	rootPostId: t.Nullable(Uuid),
	parentPostId: t.Nullable(Uuid),
	replyCount: t.Integer(),
	language: ContentLanguage,
	title: NullableText,
	summary: NullableText,
	body: PortableTextDocument,
	latestRevisionId: t.Nullable(Uuid),
	createdAt: DateTime,
	updatedAt: DateTime,
	subject: t.Nullable(t.Object(PostSubjectPresentationFields)),
	scores: t.Array(PostAttachedScoreResponse),
	capabilities: t.Object({
		canEdit: t.Boolean(),
		canManageAttributions: t.Boolean(),
		canManageAccess: t.Boolean(),
		canReply: t.Boolean(),
	}),
} as const;
export const OrdinaryPostDetailResponse = t.Object({
	...PostThreadDetailFields,
	postKind: t.Literal("post"),
});
export const ReplyPostDetailResponse = t.Object({
	...PostThreadDetailFields,
	postKind: t.Literal("reply"),
});
export const WikiPostDetailResponse = t.Object({
	...PostThreadDetailFields,
	postKind: t.Literal("wiki"),
});
export const ReviewDetailResponse = t.Object({
	id: Uuid,
	postKind: t.Literal("review"),
	attributions: t.Array(UnitAttributionSummaryResponse),
	targetId: Uuid,
	realmId: t.Nullable(Uuid),
	title: NullableText,
	summary: NullableText,
	language: ContentLanguage,
	body: t.Nullable(PortableTextDocument),
	replyCount: t.Integer(),
	createdAt: DateTime,
	updatedAt: DateTime,
	subject: t.Nullable(t.Object(PostSubjectPresentationFields)),
	scores: t.Array(PostAttachedScoreResponse),
	progressEntry: t.Nullable(ReviewProgressEntryResponse),
	capabilities: t.Object({
		canEdit: t.Boolean(),
		canManageAttributions: t.Boolean(),
		canManageAccess: t.Boolean(),
		canManageScores: t.Boolean(),
		canReply: t.Boolean(),
	}),
});
export const PostDetailResponse = t.Union([
	OrdinaryPostDetailResponse,
	ReplyPostDetailResponse,
	ReviewDetailResponse,
	WikiPostDetailResponse,
]);
const BookContentStructureNodeResponse = t.Object({
	id: Uuid,
	parentId: t.Nullable(Uuid),
	contentUnitId: Uuid,
	contentKind: t.Union([t.Literal("chapter"), t.Literal("label")]),
	language: ContentLanguage,
	title: t.String(),
	position: FractionalPosition,
	contentMetrics: ContentMetricResponse,
});
export const ContentStructureNodeListResponse = t.Object({
	structureId: t.Nullable(Uuid),
	latestRevisionId: t.Nullable(Uuid),
	items: t.Array(BookContentStructureNodeResponse),
});
export const SaveBookContentStructureDraftResponse = t.Object({
	structureId: Uuid,
	latestRevisionId: Uuid,
	revisionCreated: t.Boolean(),
	items: t.Array(BookContentStructureNodeResponse),
});
const GenericContentStructureTargetResponse = t.Union([
	t.Object({ kind: t.Literal("content") }, { additionalProperties: false }),
	t.Object({ kind: t.Literal("none") }, { additionalProperties: false }),
	t.Object({ kind: t.Literal("unit"), unitId: Uuid }, { additionalProperties: false }),
	t.Object({ kind: t.Literal("external"), url: t.String() }, { additionalProperties: false }),
]);
export const GenericContentStructureNodeResponse = t.Object({
	id: Uuid,
	structureId: Uuid,
	ownerUnitId: Uuid,
	parentId: t.Nullable(Uuid),
	contentUnitId: Uuid,
	documentKey: t.Nullable(t.String()),
	target: GenericContentStructureTargetResponse,
	position: FractionalPosition,
	contentRating: t.Nullable(t.UnionEnum(ContentRatingValues)),
	createdAt: DateTime,
	updatedAt: DateTime,
});
export const ContentStructureSummaryResponse = t.Object({
	id: Uuid,
	ownerUnitId: Uuid,
	kind: t.UnionEnum(ContentStructureKindValues),
	documentKey: t.Nullable(t.String()),
	latestRevisionId: t.Nullable(Uuid),
	createdAt: DateTime,
	updatedAt: DateTime,
});
export const ContentStructureListResponse = t.Object({
	items: t.Array(ContentStructureSummaryResponse),
});
export const ContentStructureDetailResponse = t.Intersect([
	ContentStructureSummaryResponse,
	t.Object({ nodes: t.Array(GenericContentStructureNodeResponse) }),
]);
export const ContentStructureMutationResponse = t.Object({
	structure: ContentStructureSummaryResponse,
	revisionCreated: t.Boolean(),
});
export const ContentStructureNodeMutationResponse = t.Object({
	node: GenericContentStructureNodeResponse,
	latestRevisionId: Uuid,
	revisionCreated: t.Boolean(),
});
export const ContentStructureDeleteResponse = t.Object({
	updated: t.Literal(true),
	latestRevisionId: Uuid,
	revisionCreated: t.Boolean(),
});
export const ContentStructureRevisionListResponse = t.Object({
	items: t.Array(
		t.Object({
			id: Uuid,
			parentRevisionId: t.Nullable(Uuid),
			sourceRevisionId: t.Nullable(Uuid),
			actorProfileId: t.Nullable(Uuid),
			kind: t.UnionEnum(["create", "update", "delete", "restore"]),
			editSummary: t.Nullable(t.String()),
			minor: t.Boolean(),
			replayByteSize: t.Integer({ minimum: 0 }),
			checkpointByteSize: t.Integer({ minimum: 0 }),
			createdAt: DateTime,
		}),
	),
});
export const ContentStructureNodeResponse = t.Object({
	id: Uuid,
	unitId: Uuid,
	structureId: Uuid,
	latestRevisionId: Uuid,
	parentId: t.Nullable(Uuid),
	contentUnitId: Uuid,
	contentKind: t.Union([t.Literal("chapter"), t.Literal("label")]),
	language: ContentLanguage,
	title: t.String(),
	position: FractionalPosition,
	createdAt: DateTime,
	updatedAt: DateTime,
});
export const ChapterDetailResponse = t.Object({
	nodeId: Uuid,
	bookId: Uuid,
	chapterId: Uuid,
	title: t.String(),
	position: FractionalPosition,
	language: ContentLanguage,
	availableLanguages: t.Array(ContentLanguage),
	content: t.Nullable(PortableTextDocument),
	contentMetrics: t.Nullable(ContentMetricResponse),
	status: t.Nullable(t.String()),
	updatedAt: DateTime,
	previousChapterId: t.Nullable(Uuid),
	nextChapterId: t.Nullable(Uuid),
	capabilities: t.Object({ canReply: t.Boolean() }),
});
export const ReplyResponse = t.Object({
	id: Uuid,
	postKind: t.Literal("reply"),
	language: ContentLanguage,
	attributions: t.Array(UnitAttributionSummaryResponse),
	rootPostId: Uuid,
	parentPostId: t.Nullable(Uuid),
	depth: t.Integer(),
	body: PortableTextDocument,
	status: t.String(),
	latestRevisionId: t.Nullable(Uuid),
	hasMoreChildren: t.Boolean(),
	childEndCursor: NullableText,
	createdAt: DateTime,
	updatedAt: DateTime,
	capabilities: t.Object({ canEdit: t.Boolean(), canReply: t.Boolean() }),
});

export const ReplyListResponse = t.Object({
	items: t.Array(ReplyResponse),
	nextCursor: NullableText,
});

export const CreditAttributionResponse = UnitAttributionSummaryResponse;
export const SubjectAssociationResponse = t.Object({
	id: Uuid,
	unitId: Uuid,
	entityId: Uuid,
	contextPostId: t.Nullable(Uuid),
	role: t.UnionEnum(SubjectAssociationRoleValues),
	position: FractionalPosition,
	createdAt: DateTime,
	updatedAt: DateTime,
});
export const ExternalLinkResponse = t.Object({
	id: Uuid,
	unitId: Uuid,
	sourceEntityId: Uuid,
	url: t.String(),
	normalizedUrl: t.String(),
	normalizedUrlHash: t.String(),
	role: t.String(),
	position: FractionalPosition,
	createdAt: DateTime,
	updatedAt: DateTime,
});
export const TagApplicationResponse = t.Object({
	unitId: Uuid,
	tagId: Uuid,
	createdByProfileId: t.Nullable(Uuid),
	score: t.Integer(),
	voteCount: t.Integer(),
	pinned: t.Boolean(),
	position: t.Nullable(FractionalPosition),
	createdAt: DateTime,
	updatedAt: DateTime,
});
export const AliasResponse = t.Object({
	id: Uuid,
	unitId: Uuid,
	term: t.String(),
	normalizedTerm: t.String(),
	language: NullableText,
	kind: t.String(),
	createdByProfileId: t.Nullable(Uuid),
	score: t.Integer(),
	voteCount: t.Integer(),
	searchable: t.Boolean(),
	createdAt: DateTime,
	updatedAt: DateTime,
});
export const AliasListResponse = t.Object({ items: t.Array(AliasResponse) });
export const VoteResponse = t.Object({
	value: t.Nullable(t.Integer()),
	score: t.Integer(),
	voteCount: t.Integer(),
});
export const UnitVersionResponse = t.Object({
	unitId: Uuid,
	canonicalUnitId: Uuid,
	createdAt: DateTime,
	updatedAt: DateTime,
});
