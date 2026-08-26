import { type Static, t } from "elysia";

import { TagPathMaximumMembers, TagPathMinimumMembers } from "../../database/schema";
import {
	ContentLanguage,
	LocalizationLanguageQuery,
	DateTime,
	DateTimeString,
	FractionalPosition,
	FractionalPositionInput,
	Uuid,
} from "../schema";
import { AvatarResponse } from "../schema/response";
import { TaggableUnitType } from "../unit-resources/schema";
import { WorkUnitType } from "../units/schema";

const TagVoteValue = t.Nullable(t.Union([t.Literal(-1), t.Literal(1)]));
const BinaryVote = t.Union([t.Literal(-1), t.Literal(1)]);
const LocalizedTagSummary = {
	tagId: Uuid,
	language: t.Nullable(ContentLanguage),
	title: t.Nullable(t.String()),
	summary: t.Nullable(t.String()),
	avatar: AvatarResponse,
	createdAt: DateTimeString,
	updatedAt: DateTimeString,
} as const;

export const UnitTagLandscapeParams = t.Object({
	type: TaggableUnitType,
	unitId: Uuid,
});
export type UnitTagLandscapeParams = Static<typeof UnitTagLandscapeParams>;

export const UnitTagLandscapeQuery = t.Object(
	{
		...LocalizationLanguageQuery,
		globalLimit: t.Optional(t.Integer({ minimum: 1, maximum: 100, default: 50 })),
		pathLimit: t.Optional(t.Integer({ minimum: 1, maximum: 50, default: 20 })),
		sourceLimit: t.Optional(t.Integer({ minimum: 1, maximum: 30, default: 10 })),
		perRealmLimit: t.Optional(t.Integer({ minimum: 1, maximum: 50, default: 12 })),
	},
	{ additionalProperties: false },
);
export type UnitTagLandscapeQuery = Static<typeof UnitTagLandscapeQuery>;

const GlobalUnitTagResponse = t.Object({
	...LocalizedTagSummary,
	pinned: t.Boolean(),
	position: t.Nullable(FractionalPosition),
	score: t.Integer(),
	voteCount: t.Integer({ minimum: 0 }),
	viewerVote: TagVoteValue,
});

export const TagPathMemberResponse = t.Object({
	ordinal: t.Integer({ minimum: 0 }),
	tagId: Uuid,
	language: t.Nullable(ContentLanguage),
	title: t.Nullable(t.String()),
	summary: t.Nullable(t.String()),
	avatar: AvatarResponse,
});

const UnitTagPathResponse = t.Object({
	pathId: Uuid,
	pinned: t.Boolean(),
	position: t.Nullable(FractionalPosition),
	score: t.Integer(),
	voteCount: t.Integer({ minimum: 0 }),
	viewerVote: TagVoteValue,
	spoilerVoteCount: t.Integer({ minimum: 0 }),
	spoilerDistribution: t.Object({
		none: t.Integer({ minimum: 0 }),
		minor: t.Integer({ minimum: 0 }),
		major: t.Integer({ minimum: 0 }),
	}),
	viewerSpoilerLevel: t.Nullable(t.Union([t.Literal(0), t.Literal(1), t.Literal(2)])),
	definitionScore: t.Integer(),
	definitionVoteCount: t.Integer({ minimum: 0 }),
	usageCount: t.Integer({ minimum: 0 }),
	members: t.Array(TagPathMemberResponse, {
		minItems: TagPathMinimumMembers,
		maxItems: TagPathMaximumMembers,
	}),
	createdAt: DateTime,
	updatedAt: DateTime,
});

export const RealmVotedTagResponse = t.Object({
	...LocalizedTagSummary,
	realmId: Uuid,
	contextPostId: Uuid,
	score: t.Integer(),
	voteCount: t.Integer({ minimum: 0 }),
	viewerVote: TagVoteValue,
});

export const RealmTagVoteContextResponse = t.Object({
	realmId: Uuid,
	language: t.Nullable(ContentLanguage),
	title: t.Nullable(t.String()),
	summary: t.Nullable(t.String()),
	avatar: AvatarResponse,
});

export const RealmTagSubscriptionResponse = t.Object({
	realmId: Uuid,
	language: t.Nullable(ContentLanguage),
	title: t.Nullable(t.String()),
	summary: t.Nullable(t.String()),
	avatar: AvatarResponse,
	position: FractionalPosition,
	createdAt: DateTime,
	updatedAt: DateTime,
});

export const UnitTagLandscapeResponse = t.Object({
	paths: t.Array(UnitTagPathResponse),
	global: t.Array(GlobalUnitTagResponse),
	totals: t.Object({
		paths: t.Integer({ minimum: 0 }),
		global: t.Integer({ minimum: 0 }),
	}),
	realms: t.Array(
		t.Object({
			...RealmTagSubscriptionResponse.properties,
			canVote: t.Boolean(),
			votedTags: t.Array(RealmVotedTagResponse, { minItems: 1 }),
		}),
	),
	voteRealms: t.Array(RealmTagVoteContextResponse),
});

export const RealmUnitTagVoteListResponse = t.Object({
	realmId: Uuid,
	tags: t.Array(RealmVotedTagResponse),
});

export const RealmUnitTagVoteListQuery = t.Object(
	{
		...LocalizationLanguageQuery,
		limit: t.Optional(t.Integer({ minimum: 1, maximum: 50, default: 50 })),
	},
	{ additionalProperties: false },
);
export type RealmUnitTagVoteListQuery = Static<typeof RealmUnitTagVoteListQuery>;

export const RealmTagSubscriptionListQuery = t.Object(LocalizationLanguageQuery, {
	additionalProperties: false,
});
export type RealmTagSubscriptionListQuery = Static<typeof RealmTagSubscriptionListQuery>;

export const RealmTagSubscriptionListResponse = t.Object({
	items: t.Array(RealmTagSubscriptionResponse),
});

export const RealmTagSubscriptionParams = t.Object({ realmId: Uuid });
export type RealmTagSubscriptionParams = Static<typeof RealmTagSubscriptionParams>;

export const UpsertRealmTagSubscriptionBody = t.Object(
	{ position: t.Optional(FractionalPositionInput) },
	{ additionalProperties: false },
);
export type UpsertRealmTagSubscriptionBody = Static<typeof UpsertRealmTagSubscriptionBody>;

export const RealmTagSubscriptionStateResponse = t.Object({
	realmId: Uuid,
	subscribed: t.Boolean(),
});

export const TagIdParams = t.Object({ tagId: Uuid });
export type TagIdParams = Static<typeof TagIdParams>;

export const TagSuggestionQuery = t.Object(
	{
		q: t.String({ minLength: 1, maxLength: 16 }),
		...LocalizationLanguageQuery,
		limit: t.Optional(t.Integer({ minimum: 1, maximum: 20, default: 10 })),
	},
	{ additionalProperties: false },
);
export type TagSuggestionQuery = Static<typeof TagSuggestionQuery>;

export const TagSuggestionResponse = t.Object({
	items: t.Array(
		t.Union([
			t.Object({
				selection: t.Literal("path"),
				tagId: Uuid,
				language: t.Nullable(ContentLanguage),
				title: t.Nullable(t.String()),
				summary: t.Nullable(t.String()),
				avatar: AvatarResponse,
				pathId: Uuid,
				members: t.Array(TagPathMemberResponse, {
					minItems: TagPathMinimumMembers,
					maxItems: TagPathMaximumMembers,
				}),
				matchDirection: t.Union([t.Literal("forward"), t.Literal("reverse")]),
				usageCount: t.Integer({ minimum: 0 }),
				score: t.Integer(),
				voteCount: t.Integer({ minimum: 0 }),
			}),
			t.Object({
				selection: t.Literal("direct"),
				tagId: Uuid,
				language: t.Nullable(ContentLanguage),
				title: t.Nullable(t.String()),
				summary: t.Nullable(t.String()),
				avatar: AvatarResponse,
				pathId: t.Null(),
				members: t.Tuple([]),
				matchDirection: t.Null(),
				usageCount: t.Literal(0),
				score: t.Literal(0),
				voteCount: t.Literal(0),
			}),
		]),
	),
});

export const TagHierarchyQuery = t.Object(
	{
		...LocalizationLanguageQuery,
		childLimit: t.Optional(t.Integer({ minimum: 1, maximum: 100, default: 30 })),
		grandchildLimit: t.Optional(t.Integer({ minimum: 1, maximum: 50, default: 12 })),
	},
	{ additionalProperties: false },
);
export type TagHierarchyQuery = Static<typeof TagHierarchyQuery>;

const TagHierarchyNode = t.Object({
	tagId: Uuid,
	language: t.Nullable(ContentLanguage),
	title: t.Nullable(t.String()),
	summary: t.Nullable(t.String()),
	score: t.Integer(),
	voteCount: t.Integer({ minimum: 0 }),
});

export const TagHierarchyResponse = t.Object({
	tagId: Uuid,
	language: t.Nullable(ContentLanguage),
	title: t.Nullable(t.String()),
	summary: t.Nullable(t.String()),
	children: t.Array(
		t.Object({
			...TagHierarchyNode.properties,
			children: t.Array(TagHierarchyNode),
		}),
	),
});

export const CreateTagPathBody = t.Object(
	{
		memberTagIds: t.Array(Uuid, {
			minItems: TagPathMinimumMembers,
			maxItems: TagPathMaximumMembers,
			uniqueItems: true,
		}),
	},
	{ additionalProperties: false },
);
export type CreateTagPathBody = Static<typeof CreateTagPathBody>;

export const TagPathDefinitionWarningsBody = t.Object(
	{
		...CreateTagPathBody.properties,
		...LocalizationLanguageQuery,
		limit: t.Optional(t.Integer({ minimum: 1, maximum: 20, default: 10 })),
	},
	{ additionalProperties: false },
);
export type TagPathDefinitionWarningsBody = Static<typeof TagPathDefinitionWarningsBody>;

export const TagPathDefinitionWarningsResponse = t.Object({
	items: t.Array(
		t.Object({
			pathId: Uuid,
			relation: t.Union([
				t.Literal("existing_shorter_suffix"),
				t.Literal("existing_longer_extension"),
				t.Literal("same_terminal"),
			]),
			usageCount: t.Integer({ minimum: 0 }),
			members: t.Array(TagPathMemberResponse, {
				minItems: TagPathMinimumMembers,
				maxItems: TagPathMaximumMembers,
			}),
		}),
	),
});

export const TagPathParams = t.Object({ pathId: Uuid });
export type TagPathParams = Static<typeof TagPathParams>;

export const TagPathQuery = t.Object(LocalizationLanguageQuery, {
	additionalProperties: false,
});
export type TagPathQuery = Static<typeof TagPathQuery>;

export const TagPathCurationSearchQuery = t.Object(
	{
		q: t.String({ minLength: 1, maxLength: 16 }),
		...LocalizationLanguageQuery,
		limit: t.Optional(t.Integer({ minimum: 1, maximum: 20, default: 10 })),
	},
	{ additionalProperties: false },
);
export type TagPathCurationSearchQuery = Static<typeof TagPathCurationSearchQuery>;

export const TagPathCurationSearchResponse = TagSuggestionResponse;

export const TagPathResponse = t.Object({
	id: Uuid,
	terminalTagId: Uuid,
	createdByProfileId: Uuid,
	score: t.Integer(),
	voteCount: t.Integer({ minimum: 0 }),
	usageCount: t.Integer({ minimum: 0 }),
	viewerVote: TagVoteValue,
	mergedIntoPathId: t.Nullable(Uuid),
	members: t.Array(TagPathMemberResponse, {
		minItems: TagPathMinimumMembers,
		maxItems: TagPathMaximumMembers,
	}),
	createdAt: DateTime,
	updatedAt: DateTime,
});

export const CreateTagPathResponse = t.Object({
	pathId: Uuid,
	created: t.Boolean(),
});

export const TagEndingPathsQuery = t.Object(
	{
		...LocalizationLanguageQuery,
		limit: t.Optional(t.Integer({ minimum: 1, maximum: 20, default: 5 })),
	},
	{ additionalProperties: false },
);
export type TagEndingPathsQuery = Static<typeof TagEndingPathsQuery>;

export const TagEndingPathsResponse = t.Object({
	items: t.Array(
		t.Object({
			pathId: Uuid,
			usageCount: t.Integer({ minimum: 0 }),
			score: t.Integer(),
			voteCount: t.Integer({ minimum: 0 }),
			members: t.Array(TagPathMemberResponse, {
				minItems: TagPathMinimumMembers,
				maxItems: TagPathMaximumMembers,
			}),
		}),
	),
});

export const CreateTagPathMergeBody = t.Object(
	{
		sourcePathId: Uuid,
		targetPathId: Uuid,
		reason: t.String({ minLength: 1, maxLength: 2_000 }),
		proposalSource: t.Union([
			t.Object({ kind: t.Literal("human") }, { additionalProperties: false }),
			t.Object(
				{
					kind: t.Literal("assisted"),
					system: t.String({ minLength: 1, maxLength: 128 }),
					runId: t.String({ minLength: 1, maxLength: 256 }),
					model: t.Optional(t.String({ minLength: 1, maxLength: 128 })),
					confidence: t.Optional(t.Number({ minimum: 0, maximum: 1 })),
				},
				{ additionalProperties: false },
			),
		]),
	},
	{ additionalProperties: false },
);
export type CreateTagPathMergeBody = Static<typeof CreateTagPathMergeBody>;

export const TagPathMergeParams = t.Object({ mergeId: Uuid });
export type TagPathMergeParams = Static<typeof TagPathMergeParams>;

export const ListPendingTagPathMergesQuery = t.Object(
	{
		...LocalizationLanguageQuery,
		limit: t.Optional(t.Integer({ minimum: 1, maximum: 100, default: 50 })),
	},
	{ additionalProperties: false },
);

export const PendingTagPathMergeListResponse = t.Object({
	items: t.Array(
		t.Object({
			id: Uuid,
			sourcePathId: Uuid,
			targetPathId: Uuid,
			sourceMembers: t.Array(TagPathMemberResponse, {
				minItems: TagPathMinimumMembers,
				maxItems: TagPathMaximumMembers,
			}),
			targetMembers: t.Array(TagPathMemberResponse, {
				minItems: TagPathMinimumMembers,
				maxItems: TagPathMaximumMembers,
			}),
			reason: t.String(),
			proposalSource: t.Union([
				t.Object({ kind: t.Literal("human") }),
				t.Object({
					kind: t.Literal("assisted"),
					system: t.String(),
					runId: t.String(),
					model: t.Optional(t.String()),
					confidence: t.Optional(t.Number({ minimum: 0, maximum: 1 })),
				}),
			]),
			proposedByProfileId: Uuid,
			status: t.Literal("proposed"),
			ageSeconds: t.Integer({ minimum: 0 }),
			createdAt: DateTime,
		}),
	),
});

export const ResolveTagPathMergeBody = t.Object(
	{ resolution: t.Union([t.Literal("accepted"), t.Literal("rejected"), t.Literal("reversed")]) },
	{ additionalProperties: false },
);
export type ResolveTagPathMergeBody = Static<typeof ResolveTagPathMergeBody>;

export const TagPathMergeResponse = t.Object({
	id: Uuid,
	sourcePathId: Uuid,
	targetPathId: Uuid,
	status: t.Union([
		t.Literal("proposed"),
		t.Literal("accepted"),
		t.Literal("rejected"),
		t.Literal("reversed"),
	]),
	proposalSource: t.Union([
		t.Object({ kind: t.Literal("human") }),
		t.Object({
			kind: t.Literal("assisted"),
			system: t.String(),
			runId: t.String(),
			model: t.Optional(t.String()),
			confidence: t.Optional(t.Number({ minimum: 0, maximum: 1 })),
		}),
	]),
	createdAt: t.Optional(DateTime),
	resolvedAt: t.Optional(t.Nullable(DateTime)),
});

export const VoteBody = t.Object({ value: BinaryVote }, { additionalProperties: false });
export type VoteBody = Static<typeof VoteBody>;

export const VoteSummaryResponse = t.Object({
	score: t.Integer(),
	voteCount: t.Integer({ minimum: 0 }),
	viewerVote: TagVoteValue,
});

export const UnitTagPathParams = t.Object({
	type: WorkUnitType,
	unitId: Uuid,
	pathId: Uuid,
});
export type UnitTagPathParams = Static<typeof UnitTagPathParams>;

export const TagPathApplicationResponse = t.Object({
	unitId: Uuid,
	pathId: Uuid,
	...VoteSummaryResponse.properties,
	spoilerVoteCount: t.Integer({ minimum: 0 }),
	spoilerDistribution: t.Object({
		none: t.Integer({ minimum: 0 }),
		minor: t.Integer({ minimum: 0 }),
		major: t.Integer({ minimum: 0 }),
	}),
	viewerSpoilerLevel: t.Nullable(t.Union([t.Literal(0), t.Literal(1), t.Literal(2)])),
});

export const TagPathApplicationJudgmentBody = t.Object(
	{
		fitVote: t.Optional(BinaryVote),
		spoilerLevel: t.Optional(t.Union([t.Literal(0), t.Literal(1), t.Literal(2)])),
	},
	{ additionalProperties: false, minProperties: 1 },
);
export type TagPathApplicationJudgmentBody = Static<typeof TagPathApplicationJudgmentBody>;

const RealmTagFallbackPolicy = t.Union([t.Literal("inherit"), t.Literal("isolate")]);

export const RealmTagPathParams = t.Object({ realmId: Uuid, pathId: Uuid });
export type RealmTagPathParams = Static<typeof RealmTagPathParams>;

export const RealmUnitTagPathParams = t.Object({
	realmId: Uuid,
	unitId: Uuid,
	pathId: Uuid,
});
export type RealmUnitTagPathParams = Static<typeof RealmUnitTagPathParams>;

export const ListRealmTagPathsQuery = t.Object(
	{
		unitId: t.Optional(Uuid),
		...LocalizationLanguageQuery,
		limit: t.Optional(t.Integer({ minimum: 1, maximum: 100, default: 50 })),
	},
	{ additionalProperties: false },
);
export type ListRealmTagPathsQuery = Static<typeof ListRealmTagPathsQuery>;

const RealmTagPathProvenance = t.Object({
	authority: t.Union([t.Literal("realm"), t.Literal("global")]),
	relation: t.Union([
		t.Literal("realm_unit_tag_path_judgment_stat"),
		t.Literal("unit_tag_path_judgment_stat"),
	]),
	dimension: t.Union([t.Literal("fit"), t.Literal("spoiler")]),
});

const RealmTagPathResolutionBase = {
	authority: t.Union([t.Literal("realm"), t.Literal("global")]),
	resolutionState: t.Union([t.Literal("decided"), t.Literal("inherited"), t.Literal("unresolved")]),
	provenance: RealmTagPathProvenance,
} as const;

export const RealmTagPathListResponse = t.Object({
	realmId: Uuid,
	policy: t.Object({
		fitFallback: RealmTagFallbackPolicy,
		spoilerFallback: RealmTagFallbackPolicy,
	}),
	items: t.Array(
		t.Object({
			pathId: Uuid,
			members: t.Array(TagPathMemberResponse, {
				minItems: TagPathMinimumMembers,
				maxItems: TagPathMaximumMembers,
			}),
			definition: t.Object({
				authority: t.Literal("realm"),
				score: t.Integer(),
				voteCount: t.Integer({ minimum: 0 }),
				usageCount: t.Integer({ minimum: 0 }),
				viewerVote: TagVoteValue,
				provenance: t.Object({
					authority: t.Literal("realm"),
					relation: t.Literal("realm_tag_path_vote_stat"),
				}),
			}),
			application: t.Nullable(
				t.Object({
					fit: t.Object({
						...RealmTagPathResolutionBase,
						score: t.Integer(),
						voteCount: t.Integer({ minimum: 0 }),
						viewerVote: TagVoteValue,
					}),
					spoiler: t.Object({
						...RealmTagPathResolutionBase,
						voteCount: t.Integer({ minimum: 0 }),
						distribution: t.Object({
							none: t.Integer({ minimum: 0 }),
							minor: t.Integer({ minimum: 0 }),
							major: t.Integer({ minimum: 0 }),
						}),
						viewerLevel: t.Nullable(t.Union([t.Literal(0), t.Literal(1), t.Literal(2)])),
					}),
				}),
			),
			createdAt: DateTime,
		}),
	),
});

export const RealmTagPathMutationResponse = t.Object({
	realmId: Uuid,
	pathId: Uuid,
	viewerVote: t.Optional(BinaryVote),
});

export const RealmUnitTagPathMutationResponse = t.Object({
	realmId: Uuid,
	unitId: Uuid,
	pathId: Uuid,
	viewerFitVote: t.Optional(t.Nullable(BinaryVote)),
	viewerSpoilerLevel: t.Optional(t.Nullable(t.Union([t.Literal(0), t.Literal(1), t.Literal(2)]))),
});

export const RealmTagPathJudgmentBody = t.Object(
	{
		fitVote: t.Optional(BinaryVote),
		spoilerLevel: t.Optional(t.Union([t.Literal(0), t.Literal(1), t.Literal(2)])),
	},
	{ additionalProperties: false, minProperties: 1 },
);
export type RealmTagPathJudgmentBody = Static<typeof RealmTagPathJudgmentBody>;

export const RealmTagPathFallbackBody = t.Object(
	{
		fitFallback: RealmTagFallbackPolicy,
		spoilerFallback: RealmTagFallbackPolicy,
	},
	{ additionalProperties: false },
);
export type RealmTagPathFallbackBody = Static<typeof RealmTagPathFallbackBody>;

export const RealmTagPathFallbackResponse = t.Object({
	realmId: Uuid,
	fitFallback: RealmTagFallbackPolicy,
	spoilerFallback: RealmTagFallbackPolicy,
});
