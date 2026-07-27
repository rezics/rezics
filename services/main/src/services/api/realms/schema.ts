import { type Static, t } from "elysia";
import { PortableTextDocument } from "@rezics/block";

import {
	GovernanceReasonCodeValues,
	ModerationActionKindValues,
	RealmModerationCommandValues,
	RealmJoinPolicyValues,
	RealmMemberStateValues,
	RealmPinKindValues,
	RealmUnitStatusValues,
	RealmUnitMutationCommandValues,
	UnitStatusValues,
	UnitVisibilityValues,
} from "../../database/schema/contract-values";
import {
	DateTime,
	FractionalPosition,
	ContentLanguage,
	LocalizationLanguageQuery,
	LocalizationInput,
	Uuid,
} from "../schema";
import { ModerationActionResponse } from "../governance/schema";

const RealmVisibility = t.Union(UnitVisibilityValues.map((value) => t.Literal(value)));

const RealmJoinPolicy = t.Union(RealmJoinPolicyValues.map((value) => t.Literal(value)));

const RealmStatus = t.Union(UnitStatusValues.map((value) => t.Literal(value)));

const RealmMemberState = t.Union(RealmMemberStateValues.map((value) => t.Literal(value)));

const RealmUnitStatus = t.UnionEnum(RealmUnitStatusValues, { default: undefined });
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

export const SetRealmScoreContextBody = t.Object(
	{ contextPostId: Uuid },
	{ additionalProperties: false },
);
export type SetRealmScoreContextBody = Static<typeof SetRealmScoreContextBody>;

export const RealmDetailQuery = t.Object(LocalizationLanguageQuery, {
	additionalProperties: false,
});
export type RealmDetailQuery = Static<typeof RealmDetailQuery>;

export const UpdateRealmBody = t.Object({
	joinPolicy: t.Optional(RealmJoinPolicy),
	visibility: t.Optional(RealmVisibility),
	status: t.Optional(RealmStatus),
	localization: t.Optional(LocalizationInput),
});
export type UpdateRealmBody = Static<typeof UpdateRealmBody>;

export const JoinRealmBody = t.Object({
	ruleRevisionId: t.Optional(Uuid),
	language: t.Optional(ContentLanguage),
});
export type JoinRealmBody = Static<typeof JoinRealmBody>;

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

export const PublishRealmRulesBody = t.Object({
	requireOnJoin: t.Boolean(),
	requireOnPost: t.Boolean(),
	requireOnUpdate: t.Boolean(),
	rules: t.Array(
		t.Object({
			language: ContentLanguage,
			title: t.String({ minLength: 1, maxLength: 500 }),
			content: PortableTextDocument,
		}),
		{ minItems: 1, maxItems: 100 },
	),
});
export type PublishRealmRulesBody = Static<typeof PublishRealmRulesBody>;

export const RealmRulesQuery = t.Object(LocalizationLanguageQuery, {
	additionalProperties: false,
});
export type RealmRulesQuery = Static<typeof RealmRulesQuery>;

export const RealmPinParams = t.Object({ realmId: Uuid, unitId: Uuid });
export type RealmPinParams = Static<typeof RealmPinParams>;

const RealmPinKind = t.Union(RealmPinKindValues.map((value) => t.Literal(value)));

export const CreateRealmPinBody = t.Object({
	kind: t.Optional(RealmPinKind),
	position: t.Optional(FractionalPosition),
});
export type CreateRealmPinBody = Static<typeof CreateRealmPinBody>;

export const RemoveRealmPinQuery = t.Object({
	kind: t.Optional(RealmPinKind),
});
export type RemoveRealmPinQuery = Static<typeof RemoveRealmPinQuery>;

export const RealmUnitParams = t.Object({ realmId: Uuid, unitId: Uuid });
export type RealmUnitParams = Static<typeof RealmUnitParams>;

export const RealmTagParams = t.Object({
	realmId: Uuid,
	unitId: Uuid,
	tagId: Uuid,
});
export type RealmTagParams = Static<typeof RealmTagParams>;

export const PutRealmTagContextBody = t.Object(
	{ contextPostId: Uuid },
	{ additionalProperties: false },
);
export type PutRealmTagContextBody = Static<typeof PutRealmTagContextBody>;

export const RealmTagVoteBody = t.Object(
	{ value: t.Union([t.Literal(-1), t.Literal(1)]) },
	{ additionalProperties: false },
);
export type RealmTagVoteBody = Static<typeof RealmTagVoteBody>;

export const RealmTagContextResponse = t.Object({
	realmId: Uuid,
	unitId: Uuid,
	tagId: Uuid,
	contextPostId: Uuid,
	createdByProfileId: t.Nullable(Uuid),
	value: t.Nullable(t.Union([t.Literal(-1), t.Literal(1)])),
	score: t.Integer(),
	voteCount: t.Integer(),
	createdAt: DateTime,
	updatedAt: DateTime,
});

export const ListRealmUnitsQuery = t.Object(
	{
		status: t.Optional(RealmUnitStatus),
		...LocalizationLanguageQuery,
		cursor: t.Optional(t.String({ minLength: 1, maxLength: 1024 })),
		limit: t.Optional(t.Integer({ minimum: 1, maximum: 100, default: 50 })),
	},
	{ additionalProperties: false },
);
export type ListRealmUnitsQuery = Static<typeof ListRealmUnitsQuery>;

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
			command: t.UnionEnum(RealmUnitMutationCommandValues),
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
	postTargetingLocked: t.Boolean(),
	allowedCommands: t.Array(RealmModerationCommand, { minItems: 1 }),
	updatedAt: DateTime,
});

export const RealmUnitListResponse = t.Object({
	items: t.Array(
		t.Object({
			realmId: Uuid,
			unitId: Uuid,
			unitKind: t.String(),
			language: ContentLanguage,
			title: t.Nullable(t.String()),
			status: RealmUnitStatus,
			postTargetingLocked: t.Boolean(),
			allowedCommands: t.Array(RealmModerationCommand, { minItems: 1 }),
			moderationStatus: t.String(),
			createdAt: DateTime,
			updatedAt: DateTime,
		}),
	),
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
