import { type Static, t } from "elysia";
import {
	FontAwesomeIconNamePatternSource,
	FontAwesomeIconPrefixValues,
	FontAwesomeProvider,
} from "@rezics/avatar";
import { SearchConfiguration } from "@rezics/search";
import {
	CollectionDefinitionDocument,
	CollectionPresentationDocument,
	PortableTextDocument,
	parseDocument,
	type PortableTextDocument as PortableTextDocumentValue,
} from "@rezics/block";
import {
	ContentLanguage,
	DateTime,
	FractionalPosition,
	OrdinalPosition,
	PublicationLicense,
	StoredUiLocale,
	Uuid,
} from ".";
import {
	ContentRatingValues,
	ContentStructureKindValues,
	EntityAssociationPolicyModeValues,
} from "../../database/schema/contract-values";
import { FeedPostKindValues, FeedUnitKindValues } from "../feed/schema";
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
const EntityAssociationPolicyModeResponse = t.UnionEnum(EntityAssociationPolicyModeValues);
export const EntityAssociationPolicyResponse = t.Object({
	creditAttribution: EntityAssociationPolicyModeResponse,
	subjectAssociation: EntityAssociationPolicyModeResponse,
});

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

const LocalizationResponse = t.Object({
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

export const UnitPublisherSummaryResponse = t.Object({
	profileId: Uuid,
	slugAddress: NullablePublicSlugAddressResponse,
	name: NullableText,
	summary: NullableText,
	avatar: AvatarResponse,
	firstPublishedAt: DateTime,
	lastPublishedAt: DateTime,
	publicationCount: t.Integer({ minimum: 1 }),
});

export const UnitListResponse = t.Object({
	items: t.Array(
		t.Object({
			id: Uuid,
			language: NullableText,
			contentRating: t.String(),
			publishedAt: t.Nullable(DateTime),
			createdAt: DateTime,
			updatedAt: DateTime,
			title: NullableText,
			summary: NullableText,
			publishers: t.Array(UnitPublisherSummaryResponse),
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

export const UnitDetailResponse = t.Object({
	id: Uuid,
	type: CatalogUnitTypeResponse,
	status: t.String(),
	visibility: t.String(),
	language: NullableText,
	contentRating: t.String(),
	aiDisclosure: t.String(),
	license: t.Nullable(PublicationLicense),
	postTargetingLocked: t.Boolean(),
	publishedAt: t.Nullable(DateTime),
	publishers: t.Array(UnitPublisherSummaryResponse),
	createdAt: DateTime,
	updatedAt: DateTime,
	primaryLanguage: NullableText,
	releasedOn: t.Nullable(t.String()),
	details: UnitDetailsResponse,
	avatar: AvatarResponse,
	banner: ImageAssetResponse,
	cover: ImageAssetResponse,
	localizations: t.Array(LocalizationResponse),
	credits: t.Array(
		t.Object({
			id: Uuid,
			entityEntryId: Uuid,
			role: t.String(),
			position: FractionalPosition,
			evidenceUrl: NullableText,
			note: NullableText,
			title: NullableText,
		}),
	),
	subjectAssociations: t.Array(
		t.Object({
			id: Uuid,
			entityEntryId: Uuid,
			role: t.String(),
			position: FractionalPosition,
			title: NullableText,
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
		}),
	),
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
	}),
});

const SearchHit = t.Object({
	id: Uuid,
	slugAddress: NullablePublicSlugAddressResponse,
	category: t.String(),
	kind: t.String(),
	titles: t.Array(t.String()),
	summaries: t.Array(t.String()),
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
			avatar: AvatarResponse,
			banner: ImageAssetResponse,
			cover: ImageAssetResponse,
			title: NullableText,
			summary: NullableText,
		}),
	),
});
export const TagListResponse = t.Object({
	items: t.Array(t.Object({ id: Uuid, title: NullableText, summary: NullableText })),
});
export const CollectionListResponse = t.Object({
	items: t.Array(
		t.Object({
			id: Uuid,
			ownerId: Uuid,
			itemCount: t.Integer(),
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
			publishers: t.Array(UnitPublisherSummaryResponse),
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
	publishers: t.Array(UnitPublisherSummaryResponse),
	realmId: t.Nullable(Uuid),
	realms: t.Array(
		t.Object({
			id: Uuid,
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
	tracking: RecommendationTrackingSchema,
};

export const FeedUnitItemResponse = t.Object({
	...FeedItemBaseResponse,
	itemType: t.Literal("unit"),
	unitKind: t.UnionEnum(FeedUnitKindValues),
	postKind: t.Null(),
	summary: NullableText,
	cover: ImageAssetResponse,
});

export const FeedPostItemResponse = t.Object({
	...FeedItemBaseResponse,
	itemType: t.Literal("post"),
	unitKind: t.Literal("post"),
	postKind: t.UnionEnum(FeedPostKindValues),
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
			publishers: t.Array(UnitPublisherSummaryResponse),
			subjectId: t.Nullable(Uuid),
		}),
	),
	subject: t.Nullable(
		t.Object({
			id: Uuid,
			type: t.String(),
			title: NullableText,
			summary: NullableText,
			cover: ImageAssetResponse,
			score: t.Nullable(
				t.Object({
					totalScore: t.Integer({ minimum: 1 }),
					totalCount: t.Integer({ minimum: 1 }),
				}),
			),
		}),
	),
});

export type FeedItemResponseValue =
	Static<typeof FeedUnitItemResponse> | Static<typeof FeedPostItemResponse>;

export const FeedResponse = t.Object({
	items: t.Array(t.Union([FeedUnitItemResponse, FeedPostItemResponse])),
	nextCursor: NullableText,
});

export const PostFeedResponse = t.Object({
	items: t.Array(FeedPostItemResponse),
	nextCursor: NullableText,
});
export const ReviewListResponse = t.Object({
	items: t.Array(
		t.Object({
			id: Uuid,
			publishers: t.Array(UnitPublisherSummaryResponse),
			targetId: Uuid,
			realmId: t.Nullable(Uuid),
			title: NullableText,
			summary: NullableText,
			createdAt: DateTime,
			updatedAt: DateTime,
		}),
	),
});

export const PublicProfileResponse = t.Object({
	id: Uuid,
	slugAddress: NullablePublicSlugAddressResponse,
	status: t.String(),
	visibility: t.String(),
	language: NullableText,
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
	t.Object({ email: t.String(), emailVerified: t.Boolean(), onboarding: t.String() }),
]);
export const PreferencesResponse = t.Object({
	profileId: Uuid,
	interfaceLocale: StoredUiLocale,
	defaultLicense: t.Nullable(PublicationLicense),
	defaultRealmManageMode: t.Boolean(),
	collectionConfig: t.Nullable(CollectionConfigV1),
	personalizedFeed: t.Boolean(),
	contentRatings: t.Array(t.String()),
	preferredLanguages: t.Array(ContentLanguage),
});
export const ProgressListResponse = t.Object({
	items: t.Array(
		t.Object({
			unitId: Uuid,
			status: t.String(),
			progress: t.Number(),
			completedCount: t.Integer(),
			totalTimeMs: t.Integer(),
			firstSeenAt: DateTime,
			lastSeenAt: DateTime,
			lastContentStructureNodeId: t.Nullable(Uuid),
			lastReadAnchor: t.Nullable(t.Unknown()),
			type: t.String(),
			title: NullableText,
		}),
	),
});
export const ProgressResponse = t.Object({
	profileId: Uuid,
	unitId: Uuid,
	status: t.String(),
	progress: t.Number(),
	isDeleted: t.Boolean(),
	completedCount: t.Integer(),
	totalTimeMs: t.Integer(),
	firstSeenAt: DateTime,
	lastSeenAt: DateTime,
	lastContentStructureNodeId: t.Nullable(Uuid),
	lastReadAnchor: t.Nullable(t.Unknown()),
	createdAt: DateTime,
	updatedAt: DateTime,
});
export const PollDetailResponse = t.Object({
	id: Uuid,
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
	avatar: AvatarResponse,
	banner: ImageAssetResponse,
	cover: ImageAssetResponse,
	createdAt: DateTime,
	updatedAt: DateTime,
	localizations: t.Array(LocalizationResponse),
	associationPolicy: EntityAssociationPolicyResponse,
	ownerProfileId: t.Nullable(Uuid),
	capabilities: t.Object({
		canEdit: t.Boolean(),
		canManageAccess: t.Boolean(),
		canManageCreditAssociations: t.Boolean(),
		canManageSubjectAssociations: t.Boolean(),
	}),
	creditAttributions: t.Array(t.Object({ id: Uuid, unitId: Uuid, role: t.String() })),
	subjectAssociations: t.Array(t.Object({ id: Uuid, unitId: Uuid, role: t.String() })),
});
export const CollectionDetailResponse = t.Object({
	id: Uuid,
	status: t.String(),
	visibility: t.String(),
	language: NullableText,
	source: t.Union([t.Literal("manual"), t.Literal("search"), t.Literal("system")]),
	systemKey: t.Nullable(t.Literal("favorites")),
	definitionDocument: CollectionDefinitionDocument,
	presentationDocument: CollectionPresentationDocument,
	ownerId: Uuid,
	itemCount: t.Integer(),
	createdAt: DateTime,
	updatedAt: DateTime,
	localizations: t.Array(LocalizationSummary),
	items: t.Array(
		t.Object({
			targetId: Uuid,
			kind: t.String(),
			parentTargetId: t.Nullable(Uuid),
			position: FractionalPosition,
			type: t.String(),
			title: NullableText,
		}),
	),
});
export const RealmDetailResponse = t.Object({
	id: Uuid,
	slugAddress: NullablePublicSlugAddressResponse,
	status: t.String(),
	visibility: t.String(),
	language: NullableText,
	joinPolicy: t.String(),
	createdAt: DateTime,
	updatedAt: DateTime,
	avatar: AvatarResponse,
	banner: ImageAssetResponse,
	cover: ImageAssetResponse,
	localizations: t.Array(LocalizationSummary),
	viewerFollowing: t.Boolean(),
	viewerMembership: t.Optional(t.Object({ role: t.String(), state: t.String() })),
	capabilities: t.Object({
		canUpdateSettings: t.Boolean(),
		canReadMembers: t.Boolean(),
		canManageMembers: t.Boolean(),
		canPublishRules: t.Boolean(),
		canManagePins: t.Boolean(),
		canModerateUnits: t.Boolean(),
		canManageAccess: t.Boolean(),
		canRestoreHistory: t.Boolean(),
	}),
});
export const PostDetailResponse = t.Object({
	id: Uuid,
	postKind: OrdinaryPostKindResponse,
	publishers: t.Array(UnitPublisherSummaryResponse),
	realmId: t.Nullable(Uuid),
	subjectId: t.Nullable(Uuid),
	rootPostId: t.Nullable(Uuid),
	parentPostId: t.Nullable(Uuid),
	replyCount: t.Integer(),
	title: NullableText,
	body: PortableTextDocument,
	latestRevisionId: t.Nullable(Uuid),
	createdAt: DateTime,
	updatedAt: DateTime,
	capabilities: t.Object({ canEdit: t.Boolean(), canReply: t.Boolean() }),
});
export const ReviewDetailResponse = t.Object({
	id: Uuid,
	publishers: t.Array(UnitPublisherSummaryResponse),
	targetId: Uuid,
	realmId: t.Nullable(Uuid),
	title: NullableText,
	summary: NullableText,
	language: NullableText,
	body: t.Nullable(PortableTextDocument),
	createdAt: DateTime,
	updatedAt: DateTime,
	capabilities: t.Object({ canEdit: t.Boolean() }),
});
export const ContentStructureNodeListResponse = t.Object({
	structureId: t.Nullable(Uuid),
	latestRevisionId: t.Nullable(Uuid),
	items: t.Array(
		t.Object({
			id: Uuid,
			parentId: t.Nullable(Uuid),
			contentUnitId: Uuid,
			contentKind: t.Union([t.Literal("chapter"), t.Literal("chapter_group")]),
			language: ContentLanguage,
			title: t.String(),
			position: FractionalPosition,
		}),
	),
});
const GenericContentStructureTargetResponse = t.Union([
	t.Object({ kind: t.Literal("content") }, { additionalProperties: false }),
	t.Object({ kind: t.Literal("none") }, { additionalProperties: false }),
	t.Object({ kind: t.Literal("unit"), unitId: Uuid }, { additionalProperties: false }),
	t.Object(
		{
			kind: t.Literal("zone_page"),
			zonePageId: Uuid,
			zoneId: Uuid,
			slug: t.String(),
		},
		{ additionalProperties: false },
	),
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
	searchConfiguration: t.Nullable(SearchConfiguration),
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
	contentKind: t.Union([t.Literal("chapter"), t.Literal("chapter_group")]),
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
	content: PortableTextDocument,
	status: t.String(),
	updatedAt: DateTime,
	previousChapterId: t.Nullable(Uuid),
	nextChapterId: t.Nullable(Uuid),
});
export const ReplyListResponse = t.Object({
	items: t.Array(
		t.Object({
			id: Uuid,
			postKind: t.Literal("reply"),
			publishers: t.Array(UnitPublisherSummaryResponse),
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
		}),
	),
	nextCursor: NullableText,
});

export const CreditAttributionResponse = t.Object({
	id: Uuid,
	unitId: Uuid,
	entityId: Uuid,
	role: t.String(),
	position: FractionalPosition,
	createdAt: DateTime,
	updatedAt: DateTime,
});
export const SubjectAssociationResponse = t.Object({
	id: Uuid,
	unitId: Uuid,
	entityId: Uuid,
	role: t.String(),
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
