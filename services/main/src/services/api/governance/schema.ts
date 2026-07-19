import { PortableTextDocument } from "@rezics/block";
import { type Static, t } from "elysia";

import {
	CapabilityAuthorityValues,
	EnforcementKindValues,
	GovernanceReasonCodeValues,
	ModerationCaseStateValues,
	PlatformCapabilityValues,
	UnitAccessRealmRelationValues,
	UnitAccessRoleValues,
	UnitAccessSubjectKindValues,
	UnitPermissionValues,
	UnitProtectionModeValues,
} from "../../database/schema/contract-values";
import { DateTime, LanguageTag, Uuid } from "../schema";

const NullableUuid = t.Nullable(Uuid);

const ModerationCaseState = t.Union(ModerationCaseStateValues.map((value) => t.Literal(value)));

const GovernanceReasonCode = t.UnionEnum(GovernanceReasonCodeValues);
const GovernanceActionNote = t.Object(
	{
		role: t.Union([t.Literal("internal_note"), t.Literal("public_notice")]),
		language: LanguageTag,
		content: PortableTextDocument,
	},
	{ additionalProperties: false },
);
const GovernanceActionNotes = t.Array(GovernanceActionNote, { maxItems: 2 });
const ModerationActionCommon = {
	caseId: Uuid,
	reasonCode: GovernanceReasonCode,
	notes: t.Optional(GovernanceActionNotes),
	idempotencyKey: t.Optional(t.String({ minLength: 1, maxLength: 256 })),
};

export const ListModerationCasesQuery = t.Object({
	realmId: t.Optional(Uuid),
	state: t.Optional(ModerationCaseState),
	limit: t.Optional(t.Integer({ minimum: 1, maximum: 100, default: 50 })),
});
export const ModerationCaseParams = t.Object({ caseId: Uuid });
export const UpdateModerationCaseBody = t.Object(
	{
		state: t.Optional(ModerationCaseState),
		assignedProfileId: t.Optional(NullableUuid),
		duplicateOfCaseId: t.Optional(NullableUuid),
		safeSummary: t.Optional(t.Nullable(t.String({ maxLength: 2_000 }))),
		reason: t.Optional(t.Nullable(t.String({ maxLength: 10_000 }))),
	},
	{ minProperties: 1, additionalProperties: false },
);

const UnitScope = t.Array(
	t.String({ minLength: 1, maxLength: 64, pattern: "^[a-z0-9][a-z0-9-]*$" }),
	{ maxItems: 8 },
);

export const CreateModerationActionBody = t.Union([
	t.Object(
		{
			...ModerationActionCommon,
			kind: t.Union([
				t.Literal("approve"),
				t.Literal("hide"),
				t.Literal("remove"),
				t.Literal("restore"),
				t.Literal("lock"),
				t.Literal("unlock"),
				t.Literal("mute_member"),
				t.Literal("remove_member"),
				t.Literal("ban_member"),
				t.Literal("restore_member"),
				t.Literal("escalate"),
			]),
		},
		{ additionalProperties: false },
	),
	t.Object(
		{
			...ModerationActionCommon,
			kind: t.Literal("protect"),
			scope: UnitScope,
			protectionMode: t.UnionEnum(UnitProtectionModeValues),
		},
		{ additionalProperties: false },
	),
	t.Object(
		{
			...ModerationActionCommon,
			kind: t.Literal("unprotect"),
			scope: UnitScope,
		},
		{ additionalProperties: false },
	),
	t.Object(
		{
			...ModerationActionCommon,
			kind: t.Literal("reverse"),
			reversesActionId: Uuid,
		},
		{ additionalProperties: false },
	),
	t.Object(
		{
			...ModerationActionCommon,
			kind: t.Literal("note"),
			notes: t.Array(GovernanceActionNote, { minItems: 1, maxItems: 2 }),
		},
		{ additionalProperties: false },
	),
]);
export type CreateModerationActionBody = Static<typeof CreateModerationActionBody>;

export const FeedbackParams = t.Object({ feedbackId: Uuid });
export const ResolveFeedbackBody = t.Object(
	{ resolution: t.String({ minLength: 1, maxLength: 10_000 }) },
	{ additionalProperties: false },
);

const AccountEnforcementKind = t.Union(EnforcementKindValues.map((value) => t.Literal(value)));
export const CreateAccountEnforcementBody = t.Object(
	{
		profileId: Uuid,
		kind: AccountEnforcementKind,
		reason: t.String({ minLength: 1, maxLength: 10_000 }),
		publicMessage: t.Optional(t.String({ maxLength: 2_000 })),
		decisionCode: t.String({ minLength: 1, maxLength: 64 }),
		expiresAt: t.Optional(t.String({ format: "date-time" })),
	},
	{ additionalProperties: false },
);
export const AccountEnforcementParams = t.Object({ enforcementId: Uuid });
export const RevokeAccountEnforcementBody = t.Object(
	{ reason: t.String({ minLength: 1, maxLength: 10_000 }) },
	{ additionalProperties: false },
);

const Capability = t.Union(PlatformCapabilityValues.map((value) => t.Literal(value)));
const GrantAuthority = t.Union(CapabilityAuthorityValues.map((value) => t.Literal(value)));
export const ListGrantsQuery = t.Object({
	authority: GrantAuthority,
	realmId: t.Optional(Uuid),
});
export const CreateGrantBody = t.Object(
	{
		authority: GrantAuthority,
		realmId: t.Optional(Uuid),
		profileId: Uuid,
		capability: Capability,
		expiresAt: t.Optional(t.String({ format: "date-time" })),
	},
	{ additionalProperties: false },
);
export const GrantParams = t.Object({ grantId: Uuid });

export const UnitGovernanceParams = t.Object({ unitId: Uuid });
export const UnitAccessBindingParams = t.Object({ unitId: Uuid, bindingId: Uuid });
export const UnitEffectiveAccessQuery = t.Object(
	{ scope: t.Optional(UnitScope) },
	{ additionalProperties: false },
);
const UnitAccessSubject = t.Union([
	t.Object({ kind: t.Literal("profile"), profileId: Uuid }, { additionalProperties: false }),
	t.Object(
		{
			kind: t.Literal("realm"),
			realmId: Uuid,
			relation: t.UnionEnum(UnitAccessRealmRelationValues),
		},
		{ additionalProperties: false },
	),
	t.Object({ kind: t.Literal("authenticated") }, { additionalProperties: false }),
]);
export const CreateUnitAccessBindingBody = t.Object(
	{
		subject: UnitAccessSubject,
		role: t.UnionEnum(UnitAccessRoleValues),
		scope: UnitScope,
		expiresAt: t.Optional(t.String({ format: "date-time" })),
	},
	{ additionalProperties: false },
);
export const UnitAccessRestrictionParams = t.Object({ unitId: Uuid, restrictionId: Uuid });
export const UnitAccessRestrictionSubject = t.Union([
	t.Object({ kind: t.Literal("profile"), profileId: Uuid }, { additionalProperties: false }),
	t.Object({ kind: t.Literal("realm"), realmId: Uuid }, { additionalProperties: false }),
]);
export const CreateUnitAccessRestrictionBody = t.Object(
	{
		subject: UnitAccessRestrictionSubject,
		permission: t.UnionEnum(UnitPermissionValues),
		scope: UnitScope,
		reason: t.String({ minLength: 1, maxLength: 2_000 }),
		expiresAt: t.Optional(t.String({ format: "date-time" })),
	},
	{ additionalProperties: false },
);
export const UnitProtectionParams = t.Object({ unitId: Uuid, protectionId: Uuid });
export const CreateUnitProtectionBody = t.Object(
	{
		scope: UnitScope,
		mode: t.UnionEnum(UnitProtectionModeValues),
		reason: t.String({ minLength: 1, maxLength: 2_000 }),
		expiresAt: t.Optional(t.String({ format: "date-time" })),
	},
	{ additionalProperties: false },
);

export const ModerationCaseResponse = t.Object({
	id: Uuid,
	state: t.String(),
	authority: t.String(),
	realmId: t.Nullable(Uuid),
	targetKind: t.String(),
	targetId: Uuid,
	targetPath: t.Nullable(t.String()),
	reporterProfileId: t.Nullable(Uuid),
	assignedProfileId: t.Nullable(Uuid),
	duplicateOfCaseId: t.Nullable(Uuid),
	reason: t.Nullable(t.String()),
	safeSummary: t.Nullable(t.String()),
	createdAt: DateTime,
	updatedAt: DateTime,
});
export const ModerationCaseListResponse = t.Object({ items: t.Array(ModerationCaseResponse) });

export const ModerationActionResponse = t.Object({
	id: Uuid,
	caseId: Uuid,
	actorProfileId: Uuid,
	kind: t.String(),
	previousState: t.Nullable(t.String()),
	resultingState: t.Nullable(t.String()),
	previousLocked: t.Nullable(t.Boolean()),
	resultingStatus: t.Nullable(t.String()),
	resultingLocked: t.Nullable(t.Boolean()),
	reasonCode: t.String(),
	reversesActionId: t.Nullable(Uuid),
	createdAt: DateTime,
});

export const EnforcementResponse = t.Object({
	id: Uuid,
	profileId: Uuid,
	kind: t.String(),
	active: t.Boolean(),
	startsAt: DateTime,
	expiresAt: t.Nullable(DateTime),
	decisionActionId: Uuid,
	revocationActionId: t.Nullable(Uuid),
	createdAt: DateTime,
	updatedAt: DateTime,
});

export const GrantResponse = t.Object({
	id: Uuid,
	authority: t.String(),
	realmId: t.Nullable(Uuid),
	profileId: Uuid,
	capability: t.String(),
	grantedByProfileId: Uuid,
	expiresAt: t.Nullable(DateTime),
	revokedAt: t.Nullable(DateTime),
	createdAt: DateTime,
	updatedAt: DateTime,
});
export const GrantListResponse = t.Object({ items: t.Array(GrantResponse) });

export const UnitAccessBindingResponse = t.Object({
	id: Uuid,
	unitId: Uuid,
	subjectKind: t.UnionEnum(UnitAccessSubjectKindValues),
	profileId: t.Nullable(Uuid),
	realmId: t.Nullable(Uuid),
	realmRelation: t.Nullable(t.String()),
	role: t.String(),
	scope: UnitScope,
	grantedByProfileId: Uuid,
	expiresAt: t.Nullable(DateTime),
	revokedAt: t.Nullable(DateTime),
	createdAt: DateTime,
	updatedAt: DateTime,
});
export const UnitAccessBindingListResponse = t.Object({
	items: t.Array(UnitAccessBindingResponse),
});
export const UnitAccessRestrictionResponse = t.Object({
	id: Uuid,
	unitId: Uuid,
	subject: UnitAccessRestrictionSubject,
	permission: t.String(),
	scope: UnitScope,
	reason: t.String(),
	createdByProfileId: Uuid,
	expiresAt: t.Nullable(DateTime),
	revokedAt: t.Nullable(DateTime),
	createdAt: DateTime,
	updatedAt: DateTime,
});
export const UnitAccessRestrictionListResponse = t.Object({
	items: t.Array(UnitAccessRestrictionResponse),
});
export const UnitProtectionResponse = t.Object({
	id: Uuid,
	unitId: Uuid,
	scope: UnitScope,
	mode: t.String(),
	reason: t.String(),
	createdByProfileId: Uuid,
	expiresAt: t.Nullable(DateTime),
	revokedAt: t.Nullable(DateTime),
	createdAt: DateTime,
	updatedAt: DateTime,
});
export const UnitProtectionListResponse = t.Object({ items: t.Array(UnitProtectionResponse) });

const UnitAllowedDecisionResponse = t.Union([
	t.Object(
		{ allowed: t.Literal(true), source: t.Union([t.Literal("public"), t.Literal("platform")]) },
		{ additionalProperties: false },
	),
	t.Object(
		{
			allowed: t.Literal(true),
			source: t.Literal("binding"),
			bindingId: Uuid,
			role: t.UnionEnum(UnitAccessRoleValues),
		},
		{ additionalProperties: false },
	),
]);
const UnitDeniedDecisionResponse = t.Union([
	t.Object(
		{
			allowed: t.Literal(false),
			reason: t.Union([t.Literal("missing"), t.Literal("anonymous"), t.Literal("ungranted")]),
		},
		{ additionalProperties: false },
	),
	t.Object(
		{
			allowed: t.Literal(false),
			reason: t.Literal("restricted"),
			restrictionId: Uuid,
			subjectKind: t.Union([t.Literal("profile"), t.Literal("realm")]),
		},
		{ additionalProperties: false },
	),
	t.Object(
		{
			allowed: t.Literal(false),
			reason: t.Literal("protected"),
			mode: t.UnionEnum(UnitProtectionModeValues),
		},
		{ additionalProperties: false },
	),
]);
export const UnitEffectiveAccessResponse = t.Object({
	unitId: Uuid,
	scope: UnitScope,
	decisions: t.Array(
		t.Object({
			permission: t.UnionEnum(UnitPermissionValues),
			decision: t.Union([UnitAllowedDecisionResponse, UnitDeniedDecisionResponse]),
		}),
	),
});
