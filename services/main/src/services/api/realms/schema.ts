import { type Static, t } from "elysia";
import { PortableText } from "@rezics/portable-text";

import {
	ModerationStatusValues,
	RealmJoinPolicyValues,
	RealmMemberRoleValues,
	RealmMemberStateValues,
	RealmPinKindValues,
	UnitStatusValues,
	UnitVisibilityValues,
} from "../../database/schema/contract-values";
import { LanguageTag, LocalizationInput, Uuid } from "../schema";

const RealmVisibility = t.Union(UnitVisibilityValues.map((value) => t.Literal(value)));

const RealmJoinPolicy = t.Union(RealmJoinPolicyValues.map((value) => t.Literal(value)));

const RealmStatus = t.Union(UnitStatusValues.map((value) => t.Literal(value)));

const RealmMemberRole = t.Union(RealmMemberRoleValues.map((value) => t.Literal(value)));

const RealmMemberState = t.Union(RealmMemberStateValues.map((value) => t.Literal(value)));

const RealmModerationStatus = t.Union(
	[ModerationStatusValues[1], ModerationStatusValues[0], ModerationStatusValues[2]].map((value) =>
		t.Literal(value),
	),
);

export const ListRealmsQuery = t.Object({
	limit: t.Optional(t.Integer({ minimum: 1, maximum: 50, default: 20 })),
});
export type ListRealmsQuery = Static<typeof ListRealmsQuery>;

export const CreateRealmBody = t.Object({
	slug: t.String({ minLength: 3, maxLength: 72 }),
	localization: LocalizationInput,
	visibility: RealmVisibility,
	joinPolicy: RealmJoinPolicy,
});
export type CreateRealmBody = Static<typeof CreateRealmBody>;

export const RealmParams = t.Object({ realmId: Uuid });
export type RealmParams = Static<typeof RealmParams>;

export const UpdateRealmBody = t.Object({
	joinPolicy: t.Optional(RealmJoinPolicy),
	visibility: t.Optional(RealmVisibility),
	status: t.Optional(RealmStatus),
	localization: t.Optional(LocalizationInput),
});
export type UpdateRealmBody = Static<typeof UpdateRealmBody>;

export const JoinRealmBody = t.Object({
	ruleRevisionId: t.Optional(Uuid),
	language: t.Optional(LanguageTag),
});
export type JoinRealmBody = Static<typeof JoinRealmBody>;

export const ListRealmMembersQuery = t.Object({
	state: t.Optional(RealmMemberState),
	limit: t.Optional(t.Integer({ minimum: 1, maximum: 100, default: 50 })),
});
export type ListRealmMembersQuery = Static<typeof ListRealmMembersQuery>;

export const RealmMemberParams = t.Object({ realmId: Uuid, profileId: Uuid });
export type RealmMemberParams = Static<typeof RealmMemberParams>;

export const UpdateRealmMemberBody = t.Object({
	role: t.Optional(RealmMemberRole),
	state: t.Optional(RealmMemberState),
});
export type UpdateRealmMemberBody = Static<typeof UpdateRealmMemberBody>;

export const PublishRealmRulesBody = t.Object({
	requireOnJoin: t.Boolean(),
	requireOnPost: t.Boolean(),
	requireOnUpdate: t.Boolean(),
	rules: t.Array(
		t.Object({
			language: LanguageTag,
			title: t.String({ minLength: 1, maxLength: 500 }),
			content: PortableText,
		}),
		{ minItems: 1, maxItems: 100 },
	),
});
export type PublishRealmRulesBody = Static<typeof PublishRealmRulesBody>;

export const RealmPinParams = t.Object({ realmId: Uuid, unitId: Uuid });
export type RealmPinParams = Static<typeof RealmPinParams>;

const RealmPinKind = t.Union(RealmPinKindValues.map((value) => t.Literal(value)));

export const CreateRealmPinBody = t.Object({
	kind: t.Optional(RealmPinKind),
	position: t.Optional(t.String({ maxLength: 128, default: "V" })),
});
export type CreateRealmPinBody = Static<typeof CreateRealmPinBody>;

export const RemoveRealmPinQuery = t.Object({
	kind: t.Optional(RealmPinKind),
});
export type RemoveRealmPinQuery = Static<typeof RemoveRealmPinQuery>;

export const RealmContentParams = t.Object({ realmId: Uuid, unitId: Uuid });
export type RealmContentParams = Static<typeof RealmContentParams>;

export const ModerateRealmContentBody = t.Object(
	{
		status: t.Optional(RealmModerationStatus),
		locked: t.Optional(t.Boolean()),
	},
	{ minProperties: 1, additionalProperties: false },
);
export type ModerateRealmContentBody = Static<typeof ModerateRealmContentBody>;
