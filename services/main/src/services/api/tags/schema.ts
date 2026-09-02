import type { StaticDecode } from "typebox";
import { t } from "elysia";

import {
	TagExpressionArgumentRoleValues,
	TagExpressionInferenceKindValues,
	TagExpressionKindValues,
	TagExpressionLabelComponentKindValues,
	TagPathMaximumMembers,
	TagPathMinimumMembers,
	TagPathSenseScopeValues,
	TagRelationKindValues,
} from "../../database/schema";
import {
	ContentLanguage,
	DateTime,
	DateTimeString,
	FractionalPosition,
	FractionalPositionInput,
	LocalizationLanguageQuery,
	Uuid,
} from "../schema";
import { AvatarResponse } from "../schema/response";
import { TaggableUnitType } from "../unit-resources/schema";

const BinaryVote = t.Union([t.Literal(-1), t.Literal(1)]);
const OptionalBinaryVote = t.Nullable(BinaryVote);
const SpoilerLevel = t.Union([t.Literal(0), t.Literal(1), t.Literal(2)]);
const OptionalSpoilerLevel = t.Nullable(SpoilerLevel);
const TagExpressionArgumentRole = t.UnionEnum(TagExpressionArgumentRoleValues);
const TagExpressionKind = t.UnionEnum(TagExpressionKindValues);
const TagExpressionLabelComponentKind = t.UnionEnum(TagExpressionLabelComponentKindValues);
const TagExpressionInferenceKind = t.UnionEnum(TagExpressionInferenceKindValues);
const TagPathSenseScope = t.UnionEnum(TagPathSenseScopeValues);
const TagRelationKind = t.UnionEnum(TagRelationKindValues);
const JsonObject = t.Record(t.String(), t.Unknown());

const LocalizedTagSummary = {
	tagId: Uuid,
	language: t.Nullable(ContentLanguage),
	title: t.Nullable(t.String()),
	summary: t.Nullable(t.String()),
	avatar: AvatarResponse,
	createdAt: DateTimeString,
	updatedAt: DateTimeString,
} as const;

export const TagPathMemberResponse = t.Object({
	ordinal: t.Integer({ minimum: 0 }),
	nodeId: Uuid,
	nodeKind: t.Union([t.Literal("concept"), t.Literal("guide")]),
	incomingRelation: t.Nullable(t.Object({ relationId: Uuid, relationKind: TagRelationKind })),
	language: t.Nullable(ContentLanguage),
	title: t.Nullable(t.String()),
	summary: t.Nullable(t.String()),
	avatar: AvatarResponse,
});

export const TagExpressionComponentResponse = t.Object({
	tagId: Uuid,
	semanticRole: TagExpressionArgumentRole,
	componentKind: TagExpressionLabelComponentKind,
	language: t.Nullable(ContentLanguage),
	title: t.Nullable(t.String()),
});

export const TagExpressionDefinitionResponse = t.Object({
	expressionId: Uuid,
	expressionKind: TagExpressionKind,
	focusTagId: Uuid,
	presentationRevision: t.Integer({ minimum: 1 }),
	components: t.Array(TagExpressionComponentResponse, { minItems: 1 }),
	groupKey: t.Nullable(
		t.Object({
			tagId: Uuid,
			semanticRole: TagExpressionArgumentRole,
			language: t.Nullable(ContentLanguage),
			title: t.Nullable(t.String()),
		}),
	),
});

export const UnitTagLandscapeParams = t.Object({
	type: TaggableUnitType,
	unitId: Uuid,
});
export type UnitTagLandscapeParams = StaticDecode<typeof UnitTagLandscapeParams>;

export const UnitTagLandscapeQuery = t.Object(
	{
		...LocalizationLanguageQuery,
		includeExpressions: t.Optional(t.Boolean({ default: true })),
		expressionLimit: t.Optional(t.Integer({ minimum: 1, maximum: 100, default: 50 })),
		sourceLimit: t.Optional(t.Integer({ minimum: 1, maximum: 30, default: 10 })),
		perRealmLimit: t.Optional(t.Integer({ minimum: 1, maximum: 50, default: 12 })),
	},
	{ additionalProperties: false },
);
export type UnitTagLandscapeQuery = StaticDecode<typeof UnitTagLandscapeQuery>;

const ExpressionAuthority = t.Union([
	t.Object({ kind: t.Literal("global") }),
	t.Object({ kind: t.Literal("realm"), realmId: Uuid }),
]);

const VisibleExpressionApplicationResponse = t.Object({
	applicationId: t.Nullable(Uuid),
	sourceKind: t.Union([t.Literal("direct"), t.Literal("path")]),
	authority: ExpressionAuthority,
	senseId: t.Nullable(Uuid),
	pathId: t.Nullable(Uuid),
	tagId: t.Nullable(Uuid),
	expressionId: Uuid,
	createdByProfileId: t.Nullable(Uuid),
	members: t.Array(TagPathMemberResponse, { maxItems: TagPathMaximumMembers }),
	score: t.Integer(),
	voteCount: t.Integer({ minimum: 0 }),
	spoilerVoteCount: t.Integer({ minimum: 0 }),
	spoilerDistribution: t.Object({
		none: t.Integer({ minimum: 0 }),
		minor: t.Integer({ minimum: 0 }),
		major: t.Integer({ minimum: 0 }),
	}),
	viewerVote: OptionalBinaryVote,
	viewerSpoilerLevel: OptionalSpoilerLevel,
	createdAt: DateTime,
});

export const RealmVotedTagResponse = t.Object({
	...LocalizedTagSummary,
	realmId: Uuid,
	contextPostId: Uuid,
	score: t.Integer(),
	voteCount: t.Integer({ minimum: 0 }),
	viewerVote: OptionalBinaryVote,
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
	expressions: t.Array(
		t.Object({
			authority: ExpressionAuthority,
			expression: TagExpressionDefinitionResponse,
			applications: t.Array(VisibleExpressionApplicationResponse, { minItems: 1 }),
		}),
	),
	totals: t.Object({ expressions: t.Integer({ minimum: 0 }) }),
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
export type RealmUnitTagVoteListQuery = StaticDecode<typeof RealmUnitTagVoteListQuery>;

export const RealmTagSubscriptionListQuery = t.Object(LocalizationLanguageQuery, {
	additionalProperties: false,
});
export type RealmTagSubscriptionListQuery = StaticDecode<typeof RealmTagSubscriptionListQuery>;

export const RealmTagSubscriptionListResponse = t.Object({
	items: t.Array(RealmTagSubscriptionResponse),
});

export const RealmTagSubscriptionParams = t.Object({ realmId: Uuid });
export type RealmTagSubscriptionParams = StaticDecode<typeof RealmTagSubscriptionParams>;

export const UpsertRealmTagSubscriptionBody = t.Object(
	{ position: t.Optional(FractionalPositionInput) },
	{ additionalProperties: false },
);
export type UpsertRealmTagSubscriptionBody = StaticDecode<typeof UpsertRealmTagSubscriptionBody>;

export const RealmTagSubscriptionStateResponse = t.Object({
	realmId: Uuid,
	subscribed: t.Boolean(),
});

export const TagIdParams = t.Object({ tagId: Uuid });
export const TagSuggestionQuery = t.Object(
	{
		q: t.String({ minLength: 1, maxLength: 80 }),
		...LocalizationLanguageQuery,
		realmId: t.Optional(Uuid),
		limit: t.Optional(t.Integer({ minimum: 1, maximum: 20, default: 10 })),
	},
	{ additionalProperties: false },
);

const TagSuggestionMatch = t.Object({
	kind: t.Union([t.Literal("exact"), t.Literal("prefix"), t.Literal("token"), t.Literal("fuzzy")]),
	source: t.Union([
		t.Literal("direct_tag"),
		t.Literal("expression_component"),
		t.Literal("path_member"),
	]),
	tagId: Uuid,
});
const TagExpressionSuggestion = t.Union([
	t.Object({
		selection: t.Literal("direct_expression"),
		selectionKey: t.String({ pattern: "^expression:[0-9a-f-]{36}$" }),
		expression: TagExpressionDefinitionResponse,
		senseId: t.Null(),
		pathId: t.Null(),
		members: t.Array(TagPathMemberResponse, { maxItems: 0 }),
		usageCount: t.Integer({ minimum: 0 }),
		match: TagSuggestionMatch,
	}),
	t.Object({
		selection: t.Literal("path_sense"),
		selectionKey: t.String({ pattern: "^sense:[0-9a-f-]{36}$" }),
		expression: TagExpressionDefinitionResponse,
		senseId: Uuid,
		pathId: Uuid,
		members: t.Array(TagPathMemberResponse, {
			minItems: TagPathMinimumMembers,
			maxItems: TagPathMaximumMembers,
		}),
		usageCount: t.Integer({ minimum: 0 }),
		match: TagSuggestionMatch,
	}),
]);
export const TagSuggestionResponse = t.Object({ items: t.Array(TagExpressionSuggestion) });

export const TagConceptExpressionsQuery = t.Object(
	{
		...LocalizationLanguageQuery,
		limit: t.Optional(t.Integer({ minimum: 1, maximum: 100, default: 30 })),
	},
	{ additionalProperties: false },
);
export const TagConceptExpressionsResponse = t.Object({
	directExpression: t.Nullable(TagExpressionDefinitionResponse),
	qualifiedExpressions: t.Array(
		t.Object({
			expression: TagExpressionDefinitionResponse,
			roles: t.Array(TagExpressionArgumentRole, { uniqueItems: true }),
		}),
	),
	inferredReach: t.Array(
		t.Object({
			expression: TagExpressionDefinitionResponse,
			evidenceKind: t.Union([t.Literal("entailed"), t.Literal("retrieval_only")]),
		}),
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
const TagHierarchyNodeResponse = t.Object({
	nodeId: Uuid,
	nodeKind: t.Union([t.Literal("concept"), t.Literal("guide")]),
	language: t.Nullable(ContentLanguage),
	title: t.Nullable(t.String()),
	summary: t.Nullable(t.String()),
	avatar: AvatarResponse,
});
const TagHierarchyEdgeResponse = t.Object({
	relationId: Uuid,
	relationKind: TagRelationKind,
	node: TagHierarchyNodeResponse,
});
export const TagHierarchyResponse = t.Object({
	tagId: Uuid,
	children: t.Array(
		t.Object({
			...TagHierarchyEdgeResponse.properties,
			children: t.Array(TagHierarchyEdgeResponse),
		}),
	),
});

export const TagPathsContainingQuery = t.Object(
	{
		...LocalizationLanguageQuery,
		cursor: t.Optional(Uuid),
		limit: t.Optional(t.Integer({ minimum: 1, maximum: 50, default: 20 })),
	},
	{ additionalProperties: false },
);
const RankedTagPathResponse = t.Object({
	pathId: Uuid,
	usageCount: t.Integer({ minimum: 0 }),
	score: t.Integer(),
	voteCount: t.Integer({ minimum: 0 }),
	members: t.Array(TagPathMemberResponse, {
		minItems: TagPathMinimumMembers,
		maxItems: TagPathMaximumMembers,
	}),
});
export const TagPathsContainingResponse = t.Object({
	items: t.Array(RankedTagPathResponse),
	nextCursor: t.Nullable(Uuid),
});

export const CreateTagExpressionBody = t.Object(
	{
		expressionId: t.Optional(Uuid),
		expressionKind: TagExpressionKind,
		canonicalClaimKey: t.String({ minLength: 1, maxLength: 2048 }),
		focusTagId: Uuid,
		arguments: t.Array(
			t.Object({
				role: TagExpressionArgumentRole,
				ordinal: t.Integer({ minimum: 0 }),
				tagId: Uuid,
			}),
			{ minItems: 1, maxItems: 32 },
		),
		labelComponents: t.Array(
			t.Object({
				tagId: Uuid,
				semanticRole: TagExpressionArgumentRole,
				componentKind: TagExpressionLabelComponentKind,
			}),
			{ minItems: 1, maxItems: 32 },
		),
		groupKey: t.Nullable(t.Object({ tagId: Uuid, semanticRole: TagExpressionArgumentRole })),
	},
	{ additionalProperties: false },
);
export const CreateTagExpressionResponse = t.Object({
	expressionId: Uuid,
	created: t.Boolean(),
	presentationRevision: t.Integer({ minimum: 1 }),
});
export const TagExpressionParams = t.Object({ expressionId: Uuid });

export const CreateTagExpressionInferenceRuleBody = t.Object(
	{
		targetTagId: t.Optional(Uuid),
		targetExpressionId: t.Optional(Uuid),
		inferenceKind: TagExpressionInferenceKind,
		provenance: t.Optional(JsonObject),
	},
	{ additionalProperties: false },
);
export const CreateTagExpressionInferenceRuleResponse = t.Object({
	ruleId: Uuid,
	created: t.Boolean(),
});
export const TagExpressionInferenceRuleParams = t.Object({
	expressionId: Uuid,
	ruleId: Uuid,
});
export const RetireTagExpressionInferenceRuleResponse = t.Object({
	ruleId: Uuid,
	retired: t.Boolean(),
});

export const CreateTagRelationBody = t.Object(
	{
		parentNodeId: Uuid,
		childNodeId: Uuid,
		relationKind: TagRelationKind,
		provenance: t.Optional(JsonObject),
	},
	{ additionalProperties: false },
);
export const CreateTagRelationResponse = t.Object({
	relationId: Uuid,
	created: t.Boolean(),
	revision: t.Integer({ minimum: 1 }),
});

export const CreateTagPathBody = t.Object(
	{
		memberNodeIds: t.Array(Uuid, {
			minItems: TagPathMinimumMembers,
			maxItems: TagPathMaximumMembers,
			uniqueItems: true,
		}),
		relationIds: t.Array(Uuid, {
			minItems: TagPathMinimumMembers - 1,
			maxItems: TagPathMaximumMembers - 1,
			uniqueItems: true,
		}),
	},
	{ additionalProperties: false },
);
export const CreateTagPathResponse = t.Object({ pathId: Uuid, created: t.Boolean() });

export const TagPathDefinitionWarningsBody = t.Object(
	{
		...CreateTagPathBody.properties,
		...LocalizationLanguageQuery,
		limit: t.Optional(t.Integer({ minimum: 1, maximum: 20, default: 10 })),
	},
	{ additionalProperties: false },
);
export const TagPathDefinitionWarningsResponse = t.Object({
	items: t.Array(
		t.Object({
			pathId: Uuid,
			kind: t.Union([t.Literal("exact"), t.Literal("same_terminal")]),
			usageCount: t.Integer({ minimum: 0 }),
			members: t.Array(TagPathMemberResponse, {
				minItems: TagPathMinimumMembers,
				maxItems: TagPathMaximumMembers,
			}),
		}),
	),
});

export const TagPathCurationSearchQuery = TagSuggestionQuery;
export const TagPathCurationSearchResponse = t.Object({ items: t.Array(TagExpressionSuggestion) });
export const TagPathParams = t.Object({ pathId: Uuid });
export const TagPathQuery = t.Object(LocalizationLanguageQuery, { additionalProperties: false });

const TagPathSenseBindingResponse = t.Object({
	memberOrdinal: t.Integer({ minimum: 0 }),
	argumentRole: TagExpressionArgumentRole,
	argumentOrdinal: t.Integer({ minimum: 0 }),
});
const TagExpressionInferenceRuleResponse = t.Object({
	ruleId: Uuid,
	inferenceKind: TagExpressionInferenceKind,
	revision: t.Integer({ minimum: 1 }),
	status: t.Union([t.Literal("active"), t.Literal("retired")]),
	provenance: t.Nullable(JsonObject),
	createdAt: DateTime,
	target: t.Union([
		t.Object({
			kind: t.Literal("tag"),
			tagId: Uuid,
			language: t.Nullable(ContentLanguage),
			title: t.Nullable(t.String()),
		}),
		t.Object({
			kind: t.Literal("expression"),
			expressionId: Uuid,
			expression: t.Nullable(TagExpressionDefinitionResponse),
		}),
	]),
});
const TagPathSenseResponse = t.Object({
	senseId: Uuid,
	expressionId: Uuid,
	scope: TagPathSenseScope,
	realmId: t.Nullable(Uuid),
	realmLanguage: t.Nullable(ContentLanguage),
	realmTitle: t.Nullable(t.String()),
	bindingSignature: t.String(),
	status: t.Union([t.Literal("active"), t.Literal("retired")]),
	bindings: t.Array(TagPathSenseBindingResponse, { minItems: 1 }),
	expression: t.Nullable(TagExpressionDefinitionResponse),
	inferenceRules: t.Array(TagExpressionInferenceRuleResponse, { maxItems: 100 }),
});
export const TagPathResponse = t.Object({
	pathId: Uuid,
	structuralIdentityHash: t.String({ pattern: "^[0-9a-f]{64}$" }),
	terminalNodeId: Uuid,
	createdByProfileId: Uuid,
	score: t.Integer(),
	voteCount: t.Integer({ minimum: 0 }),
	usageCount: t.Integer({ minimum: 0 }),
	viewerVote: OptionalBinaryVote,
	mergedIntoPathId: t.Nullable(Uuid),
	members: t.Array(TagPathMemberResponse, {
		minItems: TagPathMinimumMembers,
		maxItems: TagPathMaximumMembers,
	}),
	senses: t.Array(TagPathSenseResponse),
	createdAt: DateTime,
	updatedAt: DateTime,
});

export const CreateTagPathSenseBody = t.Object(
	{
		senseId: t.Optional(Uuid),
		expressionId: Uuid,
		scope: TagPathSenseScope,
		realmId: t.Optional(Uuid),
		bindings: t.Array(TagPathSenseBindingResponse, {
			minItems: 1,
			maxItems: TagPathMaximumMembers,
		}),
		provenance: t.Optional(JsonObject),
	},
	{ additionalProperties: false },
);
export const CreateTagPathSenseResponse = t.Object({ senseId: Uuid, created: t.Boolean() });
export const TagPathSenseParams = t.Object({ pathId: Uuid, senseId: Uuid });
export const RetireTagPathSenseResponse = t.Object({ senseId: Uuid, retired: t.Boolean() });

export const VoteBody = t.Object({ value: BinaryVote }, { additionalProperties: false });
export const VoteSummaryResponse = t.Object({
	score: t.Integer(),
	voteCount: t.Integer({ minimum: 0 }),
	viewerVote: OptionalBinaryVote,
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
const TagPathAssistanceProvenance = t.Nullable(
	t.Object({
		kind: t.Literal("assisted"),
		system: t.String(),
		runId: t.String(),
		model: t.Optional(t.String()),
		confidence: t.Optional(t.Number({ minimum: 0, maximum: 1 })),
	}),
);
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
	reason: t.String(),
	proposalSourceKind: t.Union([t.Literal("human"), t.Literal("assisted")]),
	proposalProvenance: TagPathAssistanceProvenance,
	proposedByProfileId: Uuid,
	resolvedByProfileId: t.Nullable(Uuid),
	resolvedAt: t.Nullable(DateTime),
	createdAt: DateTime,
	updatedAt: DateTime,
});
export const TagPathMergeParams = t.Object({ mergeId: Uuid });
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
			...TagPathMergeResponse.properties,
			sourceMembers: t.Array(TagPathMemberResponse),
			targetMembers: t.Array(TagPathMemberResponse),
		}),
	),
});
export const ResolveTagPathMergeBody = t.Object(
	{ status: t.Union([t.Literal("accepted"), t.Literal("rejected"), t.Literal("reversed")]) },
	{ additionalProperties: false },
);

export const ApplyTagPathBody = t.Object(
	{
		senseId: Uuid,
		fitVote: t.Optional(BinaryVote),
		spoilerLevel: t.Optional(OptionalSpoilerLevel),
	},
	{ additionalProperties: false },
);
export const TagPathApplicationParams = t.Object({
	type: TaggableUnitType,
	unitId: Uuid,
	applicationId: Uuid,
});
export const TagPathApplicationResponse = t.Object({
	applicationId: Uuid,
	senseId: Uuid,
	created: t.Boolean(),
});
export const TagPathApplicationRemovalResponse = t.Object({
	applicationId: Uuid,
	applied: t.Literal(false),
});
export const TagPathApplicationJudgmentBody = t.Object(
	{ fitVote: t.Optional(OptionalBinaryVote), spoilerLevel: t.Optional(OptionalSpoilerLevel) },
	{ additionalProperties: false, minProperties: 1 },
);
export const TagPathApplicationJudgmentResponse = t.Object({
	score: t.Integer(),
	voteCount: t.Integer({ minimum: 0 }),
	spoilerVoteCount: t.Integer({ minimum: 0 }),
	spoilerDistribution: t.Object({
		none: t.Integer({ minimum: 0 }),
		minor: t.Integer({ minimum: 0 }),
		major: t.Integer({ minimum: 0 }),
	}),
	viewerVote: OptionalBinaryVote,
	viewerSpoilerLevel: OptionalSpoilerLevel,
});

export const RealmTagPathParams = t.Object({ realmId: Uuid, pathId: Uuid });
export const RealmTagPathSenseParams = t.Object({ realmId: Uuid, senseId: Uuid });
export const ListRealmTagPathsQuery = t.Object(
	{
		...LocalizationLanguageQuery,
		limit: t.Optional(t.Integer({ minimum: 1, maximum: 100, default: 50 })),
	},
	{ additionalProperties: false },
);
export const RealmTagPathListResponse = t.Object({
	items: t.Array(
		t.Object({
			...RankedTagPathResponse.properties,
			viewerVote: OptionalBinaryVote,
			senses: t.Array(
				t.Object({
					senseId: Uuid,
					expression: TagExpressionDefinitionResponse,
				}),
			),
		}),
	),
	policy: t.Object({
		fitFallbackPolicy: t.Union([t.Literal("inherit"), t.Literal("isolate")]),
		spoilerFallbackPolicy: t.Union([t.Literal("inherit"), t.Literal("isolate")]),
	}),
});
export const RealmTagPathAdoptionResponse = t.Object({
	realmId: Uuid,
	pathId: Uuid,
	adopted: t.Literal(true),
});
export const RealmTagPathSenseAdoptionResponse = t.Object({
	realmId: Uuid,
	senseId: Uuid,
	adopted: t.Literal(true),
});
export const RealmTagPathVoteResponse = VoteSummaryResponse;

export const RealmApplyTagPathParams = t.Object({ realmId: Uuid, unitId: Uuid });
export const RealmTagPathApplicationParams = t.Object({
	realmId: Uuid,
	unitId: Uuid,
	applicationId: Uuid,
});
export const RealmTagPathApplicationResponse = TagPathApplicationResponse;
export const RealmTagPathApplicationRemovalResponse = TagPathApplicationRemovalResponse;
export const RealmTagPathApplicationJudgmentResponse = t.Object({ applicationId: Uuid });

const RealmTagFallbackPolicy = t.Union([t.Literal("inherit"), t.Literal("isolate")]);
export const RealmTagPathFallbackBody = t.Object(
	{ fitFallbackPolicy: RealmTagFallbackPolicy, spoilerFallbackPolicy: RealmTagFallbackPolicy },
	{ additionalProperties: false },
);
export const RealmTagPathFallbackResponse = t.Object({
	realmId: Uuid,
	fitFallbackPolicy: RealmTagFallbackPolicy,
	spoilerFallbackPolicy: RealmTagFallbackPolicy,
});
