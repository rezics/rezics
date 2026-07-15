import { t } from "elysia";
import { isPortableText, PortableText } from "@rezics/portable-text";
import { DateTime, Uuid } from ".";
import {
	RecommendationReasonSchema,
	RecommendationTrackingSchema,
} from "../recommendations/schema";
export { toApiErrorResponse } from "./error-response";

const NullableText = t.Nullable(t.String());
const OrdinaryPostKindResponse = t.Union([t.Literal("post"), t.Literal("reply")]);

export function toPortableTextResponse(value: unknown): PortableText {
	if (!isPortableText(value)) throw new Error("Persisted Portable Text is invalid");
	return value;
}

export const CompletionStateResponse = t.Object({ completed: t.Boolean() });
export const UpdateStateResponse = t.Object({ updated: t.Boolean() });

export const HealthResponse = t.Object({ status: t.Literal("ok") });
export const ReadinessResponse = t.Object({
	status: t.Union([t.Literal("ready"), t.Literal("unavailable")]),
	services: t.Object({
		database: t.Boolean(),
		storage: t.Boolean(),
		recommendations: t.Boolean(),
	}),
});

const LocalizationResponse = t.Object({
	unitId: Uuid,
	language: t.String(),
	title: NullableText,
	summary: NullableText,
	description: t.Nullable(PortableText),
	createdAt: DateTime,
	updatedAt: DateTime,
});
const CoverAssetResponse = t.Nullable(
	t.Object({
		url: t.String(),
		focalPoint: t.Object({ x: t.Number(), y: t.Number() }),
		key: t.Optional(t.String()),
	}),
);

export const UnitListResponse = t.Object({
	items: t.Array(
		t.Object({
			id: Uuid,
			slug: NullableText,
			language: NullableText,
			contentRating: t.String(),
			publishedAt: t.Nullable(DateTime),
			createdAt: DateTime,
			updatedAt: DateTime,
			title: NullableText,
			summary: NullableText,
			cover: CoverAssetResponse,
		}),
	),
	nextCursor: NullableText,
});
export const UnitDetailResponse = t.Object({
	id: Uuid,
	type: t.String(),
	slug: NullableText,
	status: t.String(),
	visibility: t.String(),
	language: NullableText,
	contentRating: t.String(),
	aiDisclosure: t.String(),
	license: NullableText,
	publishedAt: t.Nullable(DateTime),
	createdAt: DateTime,
	updatedAt: DateTime,
	originalLanguage: NullableText,
	releasedOn: t.Nullable(t.String()),
	cover: CoverAssetResponse,
	localizations: t.Array(LocalizationResponse),
	aliases: t.Array(
		t.Object({
			id: Uuid,
			unitId: Uuid,
			value: t.String(),
			normalizedValue: t.String(),
			language: NullableText,
			kind: t.String(),
			status: t.String(),
			score: t.Integer(),
			voteCount: t.Integer(),
			pinned: t.Boolean(),
			position: NullableText,
			createdById: t.Nullable(Uuid),
			createdAt: DateTime,
			updatedAt: DateTime,
		}),
	),
	credits: t.Array(
		t.Object({
			id: Uuid,
			entityEntryId: Uuid,
			role: t.String(),
			position: t.String(),
			evidenceUrl: NullableText,
			note: NullableText,
			title: NullableText,
		}),
	),
	links: t.Array(
		t.Object({
			id: Uuid,
			unitId: Uuid,
			kind: t.String(),
			url: t.String(),
			label: NullableText,
			sourceEntityEntryId: t.Nullable(Uuid),
			normalizedUrl: NullableText,
			normalizedUrlHash: NullableText,
			position: t.String(),
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
			position: NullableText,
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
	capabilities: t.Object({ canEdit: t.Boolean() }),
});

const SearchHit = t.Object({
	id: Uuid,
	kind: t.String(),
	type: t.String(),
	slug: t.Optional(NullableText),
	titles: t.Array(t.String()),
	summaries: t.Array(t.String()),
	name: t.Optional(NullableText),
	summary: t.Optional(NullableText),
});
export const SearchResponse = t.Object({
	query: t.String(),
	groups: t.Array(
		t.Object({
			index: t.String(),
			hits: t.Array(SearchHit),
			total: t.Integer(),
			offset: t.Integer(),
			limit: t.Integer(),
			processingTimeMs: t.Number(),
		}),
	),
});
export const DomainSearchResponse = t.Object({
	hits: t.Array(SearchHit),
	total: t.Integer(),
	offset: t.Integer(),
	limit: t.Integer(),
	processingTimeMs: t.Number(),
});

export const EntityListResponse = t.Object({
	items: t.Array(
		t.Object({
			id: Uuid,
			slug: NullableText,
			kind: t.String(),
			verified: t.Boolean(),
			avatar: NullableText,
			title: NullableText,
			summary: NullableText,
		}),
	),
});
export const TagListResponse = t.Object({
	items: t.Array(
		t.Object({ id: Uuid, slug: NullableText, title: NullableText, summary: NullableText }),
	),
});
export const CollectionListResponse = t.Object({
	items: t.Array(
		t.Object({
			id: Uuid,
			ownerId: Uuid,
			itemCount: t.Integer(),
			slug: NullableText,
			title: NullableText,
			summary: NullableText,
			updatedAt: DateTime,
		}),
	),
});
export const RealmListResponse = t.Object({
	items: t.Array(
		t.Object({
			id: Uuid,
			slug: NullableText,
			joinPolicy: t.String(),
			title: NullableText,
			summary: NullableText,
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
			authorId: Uuid,
			authorName: NullableText,
			realmId: t.Nullable(Uuid),
			subjectId: t.Nullable(Uuid),
			rootPostId: t.Nullable(Uuid),
			parentPostId: t.Nullable(Uuid),
			body: PortableText,
			replyCount: t.Integer(),
			title: NullableText,
			latestRevisionId: t.Nullable(Uuid),
			createdAt: DateTime,
			updatedAt: DateTime,
		}),
	),
});
export const FeedResponse = t.Object({
	items: t.Array(
		t.Object({
			id: Uuid,
			postKind: OrdinaryPostKindResponse,
			authorId: Uuid,
			authorName: NullableText,
			realmId: t.Nullable(Uuid),
			subjectId: t.Nullable(Uuid),
			rootPostId: t.Nullable(Uuid),
			parentPostId: t.Nullable(Uuid),
			body: PortableText,
			replyCount: t.Integer(),
			title: NullableText,
			latestRevisionId: t.Nullable(Uuid),
			replyContext: t.Nullable(
				t.Object({
					rootPostId: Uuid,
					title: NullableText,
					authorId: Uuid,
					authorName: NullableText,
					subjectId: t.Nullable(Uuid),
				}),
			),
			subject: t.Nullable(
				t.Object({
					id: Uuid,
					type: t.String(),
					slug: NullableText,
					title: NullableText,
					cover: CoverAssetResponse,
				}),
			),
			createdAt: DateTime,
			updatedAt: DateTime,
			reactions: t.Object({ upvote: t.Integer(), downvote: t.Integer() }),
			viewerReaction: NullableText,
			recommendationReason: t.Nullable(RecommendationReasonSchema),
			tracking: RecommendationTrackingSchema,
		}),
	),
	nextCursor: NullableText,
});
export const ReviewListResponse = t.Object({
	items: t.Array(
		t.Object({
			id: Uuid,
			authorId: Uuid,
			authorName: NullableText,
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
	slug: NullableText,
	status: t.String(),
	visibility: t.String(),
	language: NullableText,
	name: NullableText,
	avatar: NullableText,
	avatarKey: t.Optional(NullableText),
	summary: NullableText,
	description: t.Nullable(PortableText),
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
	defaultLicense: NullableText,
	defaultRealmManageMode: t.Boolean(),
	collectionConfig: t.Nullable(t.Record(t.String(), t.Unknown())),
	personalizedFeed: t.Boolean(),
	contentRatings: t.Array(t.String()),
	preferredLanguages: t.Array(t.String()),
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
			lastReadNodeId: t.Nullable(Uuid),
			lastReadAnchor: t.Nullable(t.Unknown()),
			type: t.String(),
			slug: NullableText,
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
	lastReadNodeId: t.Nullable(Uuid),
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
		t.Object({
			id: Uuid,
			label: t.String(),
			position: t.String(),
			voteCount: t.Nullable(t.Integer()),
		}),
	),
});
const LocalizationSummary = t.Object({
	language: t.String(),
	title: NullableText,
	summary: NullableText,
});
export const EntityDetailResponse = t.Object({
	id: Uuid,
	slug: NullableText,
	kind: t.String(),
	verified: t.Boolean(),
	avatar: NullableText,
	createdAt: DateTime,
	updatedAt: DateTime,
	localizations: t.Array(LocalizationResponse),
	credits: t.Array(t.Object({ unitId: Uuid, role: t.String() })),
});
export const CollectionDetailResponse = t.Object({
	id: Uuid,
	slug: NullableText,
	status: t.String(),
	visibility: t.String(),
	language: NullableText,
	kind: t.String(),
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
			position: t.Nullable(t.String()),
			type: t.String(),
			slug: NullableText,
			title: NullableText,
		}),
	),
});
export const RealmDetailResponse = t.Object({
	id: Uuid,
	slug: NullableText,
	status: t.String(),
	visibility: t.String(),
	language: NullableText,
	joinPolicy: t.String(),
	createdAt: DateTime,
	updatedAt: DateTime,
	localizations: t.Array(LocalizationSummary),
	viewerFollowing: t.Boolean(),
	viewerMembership: t.Optional(t.Object({ role: t.String(), state: t.String() })),
});
export const PostDetailResponse = t.Object({
	id: Uuid,
	postKind: OrdinaryPostKindResponse,
	authorId: Uuid,
	realmId: t.Nullable(Uuid),
	subjectId: t.Nullable(Uuid),
	rootPostId: t.Nullable(Uuid),
	parentPostId: t.Nullable(Uuid),
	replyCount: t.Integer(),
	title: NullableText,
	body: PortableText,
	latestRevisionId: t.Nullable(Uuid),
	createdAt: DateTime,
	updatedAt: DateTime,
	capabilities: t.Object({ canEdit: t.Boolean() }),
});
export const ReviewDetailResponse = t.Object({
	id: Uuid,
	authorId: Uuid,
	targetId: Uuid,
	realmId: t.Nullable(Uuid),
	title: NullableText,
	summary: NullableText,
	language: NullableText,
	body: t.Nullable(PortableText),
	createdAt: DateTime,
	updatedAt: DateTime,
	capabilities: t.Object({ canEdit: t.Boolean() }),
});
export const ContentNodeListResponse = t.Object({
	items: t.Array(
		t.Object({
			id: Uuid,
			parentId: t.Nullable(Uuid),
			contentUnitId: t.Nullable(Uuid),
			language: NullableText,
			title: t.String(),
			position: t.String(),
		}),
	),
});
export const ContentNodeResponse = t.Object({
	id: Uuid,
	unitId: Uuid,
	parentId: t.Nullable(Uuid),
	contentUnitId: t.Nullable(Uuid),
	language: NullableText,
	title: t.String(),
	position: t.String(),
	createdAt: DateTime,
	updatedAt: DateTime,
});
export const ChapterDetailResponse = t.Object({
	nodeId: Uuid,
	bookId: Uuid,
	chapterId: Uuid,
	title: t.String(),
	position: t.String(),
	language: t.String(),
	content: PortableText,
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
			authorId: Uuid,
			authorName: NullableText,
			rootPostId: Uuid,
			parentPostId: t.Nullable(Uuid),
			contextRealmId: t.Nullable(Uuid),
			depth: t.Integer(),
			body: PortableText,
			status: t.String(),
			latestRevisionId: t.Nullable(Uuid),
			createdAt: DateTime,
			updatedAt: DateTime,
		}),
	),
});
export const ReplyThreadResponse = t.Object({
	items: t.Array(
		t.Object({
			id: Uuid,
			postKind: t.Literal("reply"),
			authorId: Uuid,
			authorName: NullableText,
			rootPostId: Uuid,
			parentPostId: t.Nullable(Uuid),
			contextRealmId: t.Nullable(Uuid),
			depth: t.Integer(),
			body: PortableText,
			status: t.String(),
			latestRevisionId: t.Nullable(Uuid),
			childCount: t.Integer(),
			reactions: t.Object({ upvote: t.Integer(), downvote: t.Integer() }),
			viewerReaction: NullableText,
			createdAt: DateTime,
			updatedAt: DateTime,
		}),
	),
	nextCursor: NullableText,
});
export const UploadRequestResponse = t.Object({
	key: t.String(),
	url: t.String(),
	expiresIn: t.Integer(),
});
export const UploadCompleteResponse = t.Object({
	key: t.String(),
	contentType: t.String(),
	size: t.Integer(),
});
export const UploadUrlResponse = t.Object({ url: t.String() });

export const CreditAttributionResponse = t.Object({
	unitId: Uuid,
	entityId: Uuid,
	role: t.String(),
	position: t.String(),
});
export const ExternalLinkResponse = t.Object({
	id: Uuid,
	unitId: Uuid,
	sourceEntityId: Uuid,
	url: t.String(),
	normalizedUrl: t.String(),
	normalizedUrlHash: t.String(),
	role: t.String(),
	label: NullableText,
	position: t.String(),
	createdAt: DateTime,
	updatedAt: DateTime,
});
export const TagApplicationResponse = t.Object({
	unitId: Uuid,
	tagId: Uuid,
	score: t.Integer(),
	voteCount: t.Integer(),
	pinned: t.Boolean(),
	position: NullableText,
	createdAt: DateTime,
	updatedAt: DateTime,
});
export const AliasResponse = t.Object({
	id: Uuid,
	unitId: Uuid,
	value: t.String(),
	normalizedValue: t.String(),
	language: NullableText,
	kind: t.String(),
	pinned: t.Boolean(),
	position: NullableText,
	createdByProfileId: t.Nullable(Uuid),
	createdAt: DateTime,
	updatedAt: DateTime,
});
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
