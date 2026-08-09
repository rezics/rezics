import { type Static, t } from "elysia";
import { PortableTextDocument } from "@rezics/block";

import {
	GovernanceReasonCodeValues,
	ModerationActionKindValues,
	RealmModerationCommandValues,
	RealmJoinPolicyValues,
	RealmMemberStateValues,
	RealmPageKindValues,
	RealmPinKindValues,
	RealmRuleAcknowledgementModeValues,
	RealmTagQueryStrategyValues,
	RealmUnitPublicationStateValues,
	RealmUnitStatusValues,
	RealmUnitMutationCommandValues,
	UnitStatusValues,
	ResourceVisibilityValues,
} from "../../database/schema/contract-values";
import {
	DateTime,
	FractionalPosition,
	FractionalPositionInput,
	ContentLanguage,
	LocalizationLanguagePriority,
	LocalizationLanguageQuery,
	LocalizationInput,
	Uuid,
} from "../schema";
import { ModerationActionResponse } from "../governance/schema";

const RealmVisibility = t.Union(ResourceVisibilityValues.map((value) => t.Literal(value)));

const RealmJoinPolicy = t.Union(RealmJoinPolicyValues.map((value) => t.Literal(value)));

const RealmStatus = t.Union(UnitStatusValues.map((value) => t.Literal(value)));

const RealmMemberState = t.Union(RealmMemberStateValues.map((value) => t.Literal(value)));
const RealmPageKind = t.UnionEnum(RealmPageKindValues);

const RealmUnitStatus = t.UnionEnum(RealmUnitStatusValues, { default: undefined });
const RealmUnitPublicationState = t.UnionEnum(RealmUnitPublicationStateValues);
const GovernanceReasonCode = t.UnionEnum(GovernanceReasonCodeValues);

export const ListRealmsQuery = t.Object(
	{
		...LocalizationLanguageQuery,
		limit: t.Optional(t.Integer({ minimum: 1, maximum: 50, default: 20 })),
	},
	{ additionalProperties: false },
);
export type ListRealmsQuery = Static<typeof ListRealmsQuery>;

export const CreateRealmBody = t.Object({
	localization: LocalizationInput,
	visibility: RealmVisibility,
	joinPolicy: RealmJoinPolicy,
});
export type CreateRealmBody = Static<typeof CreateRealmBody>;

export const RealmParams = t.Object({ realmId: Uuid });
export type RealmParams = Static<typeof RealmParams>;
export const RealmPinsQuery = t.Object(
	{ localizationLanguages: LocalizationLanguagePriority },
	{ additionalProperties: false },
);
export type RealmPinsQuery = Static<typeof RealmPinsQuery>;

export const SetRealmScoreContextBody = t.Object(
	{ contextPostId: Uuid },
	{ additionalProperties: false },
);
export type SetRealmScoreContextBody = Static<typeof SetRealmScoreContextBody>;

export const RealmDetailQuery = t.Object(LocalizationLanguageQuery, {
	additionalProperties: false,
});
export type RealmDetailQuery = Static<typeof RealmDetailQuery>;

export const RealmTaxonomyQuery = t.Object(LocalizationLanguageQuery, {
	additionalProperties: false,
});
export type RealmTaxonomyQuery = Static<typeof RealmTaxonomyQuery>;

const RealmTaxonomyDraftNodeBase = {
	id: Uuid,
	parentId: t.Nullable(Uuid),
	order: t.Integer({ minimum: 0 }),
	queryStrategy: t.Nullable(t.UnionEnum(RealmTagQueryStrategyValues)),
};

const ExistingRealmTaxonomyDraftNode = t.Object(
	{
		state: t.Literal("existing"),
		...RealmTaxonomyDraftNodeBase,
	},
	{ additionalProperties: false },
);

const NewRealmTaxonomyLabelDraftNode = t.Object(
	{
		state: t.Literal("new"),
		...RealmTaxonomyDraftNodeBase,
		queryStrategy: t.Null(),
		content: t.Object(
			{
				kind: t.Literal("label"),
				language: ContentLanguage,
				title: t.String({ minLength: 1, maxLength: 500 }),
			},
			{ additionalProperties: false },
		),
	},
	{ additionalProperties: false },
);

const NewRealmTaxonomyUnitDraftNode = t.Object(
	{
		state: t.Literal("new"),
		...RealmTaxonomyDraftNodeBase,
		content: t.Object(
			{ kind: t.Literal("unit"), unitId: Uuid },
			{ additionalProperties: false },
		),
	},
	{ additionalProperties: false },
);

export const SaveRealmTaxonomyDraftBody = t.Object(
	{
		baseRevisionId: Uuid,
		nodes: t.Array(
			t.Union([
				ExistingRealmTaxonomyDraftNode,
				NewRealmTaxonomyLabelDraftNode,
				NewRealmTaxonomyUnitDraftNode,
			]),
		),
	},
	{ additionalProperties: false },
);
export type SaveRealmTaxonomyDraftBody = Static<typeof SaveRealmTaxonomyDraftBody>;

export const UpdateRealmBody = t.Object(
	{
		joinPolicy: t.Optional(RealmJoinPolicy),
		visibility: t.Optional(RealmVisibility),
		status: t.Optional(RealmStatus),
		localization: t.Optional(LocalizationInput),
	},
	{ additionalProperties: false },
);
export type UpdateRealmBody = Static<typeof UpdateRealmBody>;

export const UpdateRealmTagVotingBody = t.Object(
	{ enabled: t.Boolean() },
	{ additionalProperties: false },
);
export type UpdateRealmTagVotingBody = Static<typeof UpdateRealmTagVotingBody>;

export const RealmTagVotingResponse = t.Object({ enabled: t.Boolean() });

const RealmPages = t.Array(RealmPageKind, {
	minItems: 1,
	maxItems: 3,
	uniqueItems: true,
	contains: t.Literal("main"),
	minContains: 1,
	maxContains: 1,
});

export const UpdateRealmPagesBody = t.Object(
	{
		pages: RealmPages,
		baseRevisionId: Uuid,
	},
	{ additionalProperties: false },
);
export type UpdateRealmPagesBody = Static<typeof UpdateRealmPagesBody>;

export const RealmPagesResponse = t.Object({
	pages: t.Array(RealmPageKind, { minItems: 1, maxItems: 3, uniqueItems: true }),
	latestRevisionId: Uuid,
});

export const ListRealmMembersQuery = t.Object(
	{
		profileId: t.Optional(Uuid),
		state: t.Optional(RealmMemberState),
		...LocalizationLanguageQuery,
		limit: t.Optional(t.Integer({ minimum: 1, maximum: 100, default: 50 })),
	},
	{ additionalProperties: false },
);
export type ListRealmMembersQuery = Static<typeof ListRealmMembersQuery>;

export const RealmMemberParams = t.Object({ realmId: Uuid, profileId: Uuid });
export type RealmMemberParams = Static<typeof RealmMemberParams>;

export const UpdateRealmMemberBody = t.Object(
	{
		state: RealmMemberState,
	},
	{ additionalProperties: false },
);
export type UpdateRealmMemberBody = Static<typeof UpdateRealmMemberBody>;

export const UpdateRealmRulesBody = t.Object(
	{
		acknowledgementMode: t.UnionEnum(RealmRuleAcknowledgementModeValues),
		requireOnJoin: t.Boolean(),
		requireOnPost: t.Boolean(),
		rules: t.Array(
			t.Object({
				language: ContentLanguage,
				title: t.String({ minLength: 1, maxLength: 500 }),
				content: PortableTextDocument,
			}),
			{ minItems: 1, maxItems: 100 },
		),
	},
	{ additionalProperties: false },
);
export type UpdateRealmRulesBody = Static<typeof UpdateRealmRulesBody>;

export const RealmRuleRevisionParams = t.Object({ realmId: Uuid, revisionId: Uuid });
export type RealmRuleRevisionParams = Static<typeof RealmRuleRevisionParams>;

export const AcknowledgeRealmRulesBody = t.Object(
	{ language: ContentLanguage },
	{ additionalProperties: false },
);
export type AcknowledgeRealmRulesBody = Static<typeof AcknowledgeRealmRulesBody>;

export const RealmRulesQuery = t.Object(LocalizationLanguageQuery, {
	additionalProperties: false,
});
export type RealmRulesQuery = Static<typeof RealmRulesQuery>;

export const RealmPinParams = t.Object({ realmId: Uuid, unitId: Uuid });
export type RealmPinParams = Static<typeof RealmPinParams>;

export const RealmPinKind = t.UnionEnum(RealmPinKindValues);
export type RealmPinKind = Static<typeof RealmPinKind>;

export const CreateRealmPinBody = t.Object(
	{
		kind: t.Optional(RealmPinKind),
	},
	{ additionalProperties: false },
);
export type CreateRealmPinBody = Static<typeof CreateRealmPinBody>;

export const RemoveRealmPinQuery = t.Object({
	kind: t.Optional(RealmPinKind),
});
export type RemoveRealmPinQuery = Static<typeof RemoveRealmPinQuery>;

export const RealmPinPlacement = t.Union([
	t.Object({ kind: t.UnionEnum(["start", "end"]) }, { additionalProperties: false }),
	t.Object(
		{
			kind: t.Literal("after"),
			unitId: Uuid,
		},
		{ additionalProperties: false },
	),
]);
export type RealmPinPlacement = Static<typeof RealmPinPlacement>;

export const MoveRealmPinsBody = t.Object(
	{
		unitIds: t.Array(Uuid, { minItems: 1, maxItems: 100, uniqueItems: true }),
		destinationKind: RealmPinKind,
		placement: RealmPinPlacement,
	},
	{ additionalProperties: false },
);
export type MoveRealmPinsBody = Static<typeof MoveRealmPinsBody>;

export const RealmUnitParams = t.Object({ realmId: Uuid, unitId: Uuid });
export type RealmUnitParams = Static<typeof RealmUnitParams>;

export const RealmTagVoteParams = t.Object({
	realmId: Uuid,
	unitId: Uuid,
	tagId: Uuid,
});
export type RealmTagVoteParams = Static<typeof RealmTagVoteParams>;

export const RealmTagContextParams = t.Object({
	realmId: Uuid,
	tagId: Uuid,
});
export type RealmTagContextParams = Static<typeof RealmTagContextParams>;

export const PutRealmTagContextBody = t.Object(
	{ contextPostId: Uuid },
	{ additionalProperties: false },
);
export type PutRealmTagContextBody = Static<typeof PutRealmTagContextBody>;

export const CreateRealmTagContextBody = t.Object(
	{
		tagId: Uuid,
		accessMode: t.Optional(
			t.Union([t.Literal("community_owned"), t.Literal("restricted")], {
				default: "community_owned",
			}),
		),
		title: t.String({ minLength: 1, maxLength: 500 }),
		summary: t.String({ minLength: 1, maxLength: 2_000 }),
		body: PortableTextDocument,
		language: ContentLanguage,
	},
	{ additionalProperties: false },
);
export type CreateRealmTagContextBody = Static<typeof CreateRealmTagContextBody>;

export const CreateRealmWikiBody = t.Object(
	{
		accessMode: t.Optional(
			t.Union([t.Literal("community_owned"), t.Literal("restricted")], {
				default: "community_owned",
			}),
		),
		title: t.String({ minLength: 1, maxLength: 500 }),
		body: PortableTextDocument,
		language: ContentLanguage,
		subjectId: t.Optional(Uuid),
	},
	{ additionalProperties: false },
);
export type CreateRealmWikiBody = Static<typeof CreateRealmWikiBody>;

export const RealmTagVoteBody = t.Object(
	{ value: t.Union([t.Literal(-1), t.Literal(1)]) },
	{ additionalProperties: false },
);
export type RealmTagVoteBody = Static<typeof RealmTagVoteBody>;

export const ApplyRealmPolicyTagBody = t.Object(
	{ position: t.Optional(FractionalPositionInput) },
	{ additionalProperties: false },
);
export type ApplyRealmPolicyTagBody = Static<typeof ApplyRealmPolicyTagBody>;

export const RealmPolicyTagResponse = t.Object({
	realmId: Uuid,
	unitId: Uuid,
	tagId: Uuid,
	position: FractionalPosition,
	createdByProfileId: Uuid,
	createdAt: DateTime,
	updatedAt: DateTime,
});

export const RealmTagContextResponse = t.Object({
	realmId: Uuid,
	tagId: Uuid,
	contextPostId: Uuid,
	createdByProfileId: t.Nullable(Uuid),
	createdAt: DateTime,
	updatedAt: DateTime,
});

export const ListRealmTagContextsQuery = t.Object(
	{
		...LocalizationLanguageQuery,
		cursor: t.Optional(t.String({ minLength: 1, maxLength: 1024 })),
		limit: t.Optional(t.Integer({ minimum: 1, maximum: 100, default: 50 })),
	},
	{ additionalProperties: false },
);
export type ListRealmTagContextsQuery = Static<typeof ListRealmTagContextsQuery>;

export const RealmTagContextListResponse = t.Object({
	items: t.Array(
		t.Object({
			...RealmTagContextResponse.properties,
			tagReadable: t.Boolean(),
			tagLanguage: t.Nullable(ContentLanguage),
			tagTitle: t.Nullable(t.String()),
			contextReadable: t.Boolean(),
			contextLanguage: t.Nullable(ContentLanguage),
			contextTitle: t.Nullable(t.String()),
		}),
	),
	nextCursor: t.Nullable(t.String()),
});

export const RealmTagVoteResponse = t.Object({
	realmId: Uuid,
	unitId: Uuid,
	tagId: Uuid,
	value: t.Nullable(t.Union([t.Literal(-1), t.Literal(1)])),
	score: t.Integer(),
	voteCount: t.Integer(),
});

export const ListRealmUnitsQuery = t.Object(
	{
		status: t.Optional(
			t.UnionEnum(["current", ...RealmUnitStatusValues, "all"], {
				default: "current",
			}),
		),
		publicationState: t.Optional(
			t.UnionEnum([...RealmUnitPublicationStateValues, "all"], {
				default: "active",
			}),
		),
		reported: t.Optional(t.Boolean()),
		...LocalizationLanguageQuery,
		cursor: t.Optional(t.String({ minLength: 1, maxLength: 1024 })),
		limit: t.Optional(t.Integer({ minimum: 1, maximum: 100, default: 50 })),
	},
	{ additionalProperties: false },
);
export type ListRealmUnitsQuery = Static<typeof ListRealmUnitsQuery>;

export const RealmUnitModerationQuery = t.Object(LocalizationLanguageQuery, {
	additionalProperties: false,
});
export type RealmUnitModerationQuery = Static<typeof RealmUnitModerationQuery>;

export const RealmUnitHistoryQuery = t.Object(
	{ limit: t.Optional(t.Integer({ minimum: 1, maximum: 100, default: 50 })) },
	{ additionalProperties: false },
);
export type RealmUnitHistoryQuery = Static<typeof RealmUnitHistoryQuery>;

const RealmModerationAnnotation = t.Object(
	{
		role: t.Union([t.Literal("internal_note"), t.Literal("public_notice")]),
		language: ContentLanguage,
		content: PortableTextDocument,
	},
	{ additionalProperties: false },
);
const RealmModerationCommon = {
	reasonCode: GovernanceReasonCode,
	idempotencyKey: t.Optional(t.String({ minLength: 1, maxLength: 256 })),
};
export const ModerateRealmUnitBody = t.Union([
	t.Object(
		{
			...RealmModerationCommon,
			command: t.Union([t.UnionEnum(RealmUnitMutationCommandValues), t.Literal("dismiss")]),
			annotation: t.Optional(RealmModerationAnnotation),
		},
		{ additionalProperties: false },
	),
	t.Object(
		{
			...RealmModerationCommon,
			command: t.Literal("note"),
			annotation: RealmModerationAnnotation,
		},
		{ additionalProperties: false },
	),
]);
export type ModerateRealmUnitBody = Static<typeof ModerateRealmUnitBody>;

const RealmModerationCommand = t.UnionEnum(RealmModerationCommandValues);
const RealmUnitModerationTargetResponse = t.Object({
	status: RealmUnitStatus,
	publicationState: RealmUnitPublicationState,
	postTargetingLocked: t.Boolean(),
	openReportCount: t.Integer({ minimum: 0 }),
	allowedCommands: t.Array(RealmModerationCommand, { minItems: 1 }),
	updatedAt: DateTime,
});

export const RealmUnitModerationResponse = t.Object({
	realmId: Uuid,
	unitId: Uuid,
	unitKind: t.String(),
	language: ContentLanguage,
	title: t.Nullable(t.String()),
	status: RealmUnitStatus,
	publicationState: RealmUnitPublicationState,
	postTargetingLocked: t.Boolean(),
	openReportCount: t.Integer({ minimum: 0 }),
	allowedCommands: t.Array(RealmModerationCommand, { minItems: 1 }),
	moderationStatus: t.String(),
	createdAt: DateTime,
	updatedAt: DateTime,
});

export const RealmUnitListResponse = t.Object({
	items: t.Array(RealmUnitModerationResponse),
	nextCursor: t.Nullable(t.String()),
});

export const RealmUnitModerationActionResponse = t.Object({
	...ModerationActionResponse.properties,
	target: RealmUnitModerationTargetResponse,
});

const RealmModerationNoteResponse = t.Object({
	postId: Uuid,
	latestRevisionId: t.Nullable(Uuid),
	role: t.Union([t.Literal("internal_note"), t.Literal("public_notice")]),
	language: ContentLanguage,
	content: PortableTextDocument,
	createdAt: DateTime,
	updatedAt: DateTime,
});

export const RealmUnitModerationHistoryResponse = t.Object({
	items: t.Array(
		t.Object({
			id: Uuid,
			caseId: Uuid,
			kind: t.UnionEnum(ModerationActionKindValues),
			actorProfileId: Uuid,
			actorName: t.Nullable(t.String()),
			previousState: t.Nullable(RealmUnitStatus),
			resultingState: t.Nullable(RealmUnitStatus),
			previousPostTargetingLocked: t.Nullable(t.Boolean()),
			resultingPostTargetingLocked: t.Nullable(t.Boolean()),
			reasonCode: GovernanceReasonCode,
			reversesActionId: t.Nullable(Uuid),
			notes: t.Array(RealmModerationNoteResponse),
			createdAt: DateTime,
		}),
	),
});
