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
	UnitDelegableAccessRoleValues,
	UnitAccessSubjectKindValues,
	UnitPermissionValues,
	UnitProtectionModeValues,
} from "../../database/schema/contract-values";
import { DateTime, ContentLanguage, Uuid } from "../schema";

const NullableUuid = t.Nullable(Uuid);

const ModerationCaseState = t.Union(ModerationCaseStateValues.map((value) => t.Literal(value)));

const GovernanceReasonCode = t.UnionEnum(GovernanceReasonCodeValues, { default: undefined });
export const GovernanceInternalNote = t.Object(
	{
		language: ContentLanguage,
		content: PortableTextDocument,
	},
	{ additionalProperties: false },
);
export const GovernanceActionNote = t.Object(
	{
		role: t.Union([t.Literal("internal_note"), t.Literal("public_notice")]),
		language: ContentLanguage,
		content: PortableTextDocument,
	},
	{ additionalProperties: false },
);
const GovernanceActionNotes = t.Array(GovernanceActionNote, { maxItems: 2 });
export const GovernanceNoteResponse = t.Object({
	postId: Uuid,
	latestRevisionId: t.Nullable(Uuid),
	role: t.Union([t.Literal("evidence"), t.Literal("internal_note"), t.Literal("public_notice")]),
	language: ContentLanguage,
	content: PortableTextDocument,
	createdAt: DateTime,
	updatedAt: DateTime,
});
export const GovernanceNoteParams = t.Object({ postId: Uuid });
export const UpdateGovernanceNoteBody = t.Object(
	{
		language: ContentLanguage,
		content: PortableTextDocument,
		baseRevisionId: Uuid,
		editSummary: t.Optional(t.String({ maxLength: 500 })),
		minor: t.Optional(t.Boolean()),
	},
	{ additionalProperties: false },
);
const GovernanceNoteBindingResponse = t.Pick(GovernanceNoteResponse, ["postId", "role"]);
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
		internalNote: t.Optional(GovernanceInternalNote),
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
	{
		resolutionCode: GovernanceReasonCode,
		publicNotice: t.Optional(
			t.Object(
				{
					language: ContentLanguage,
					content: PortableTextDocument,
				},
				{ additionalProperties: false },
			),
		),
	},
	{ additionalProperties: false },
);

const AccountEnforcementKind = t.Union(EnforcementKindValues.map((value) => t.Literal(value)));
export const CreateAccountEnforcementBody = t.Object(
	{
		profileId: Uuid,
		kind: AccountEnforcementKind,
		reasonCode: GovernanceReasonCode,
		notes: t.Optional(GovernanceActionNotes),
		expiresAt: t.Optional(t.String({ format: "date-time" })),
	},
	{ additionalProperties: false },
);
export const AccountEnforcementParams = t.Object({ enforcementId: Uuid });
export const RevokeAccountEnforcementBody = t.Object(
	{
		reasonCode: GovernanceReasonCode,
		notes: t.Optional(GovernanceActionNotes),
	},
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
export const ClaimUnitOwnershipBody = t.Object({}, { additionalProperties: false });
export const UnitAccessBindingParams = t.Object({ unitId: Uuid, bindingId: Uuid });
export const UnitAccessInvitationParams = t.Object({ unitId: Uuid, invitationId: Uuid });
export const ListUnitAccessInvitationsQuery = t.Object(
	{ includeResolved: t.Optional(t.Boolean()) },
	{ additionalProperties: false },
);
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
		role: t.UnionEnum(UnitDelegableAccessRoleValues),
		scope: UnitScope,
		expiresAt: t.Optional(t.String({ format: "date-time" })),
	},
	{ additionalProperties: false },
);
export const CreateUnitAccessInvitationBody = t.Object(
	{
		invitedProfileId: Uuid,
		role: t.UnionEnum(UnitDelegableAccessRoleValues),
		scope: UnitScope,
		invitationExpiresAt: t.String({ format: "date-time" }),
		accessExpiresAt: t.Optional(t.String({ format: "date-time" })),
	},
	{ additionalProperties: false },
);
export const UnitAccessRestrictionParams = t.Object({ unitId: Uuid, restrictionId: Uuid });
export const TransferUnitOwnershipBody = t.Object(
	{
		owner: t.Object(
			{ kind: t.Literal("profile"), profileId: Uuid },
			{ additionalProperties: false },
		),
	},
	{ additionalProperties: false },
);
export const UnitAccessRestrictionSubject = t.Union([
	t.Object({ kind: t.Literal("profile"), profileId: Uuid }, { additionalProperties: false }),
	t.Object({ kind: t.Literal("realm"), realmId: Uuid }, { additionalProperties: false }),
]);
export const CreateUnitAccessRestrictionBody = t.Object(
	{
		subject: UnitAccessRestrictionSubject,
		permission: t.UnionEnum(UnitPermissionValues),
		scope: UnitScope,
		reasonCode: GovernanceReasonCode,
		internalNote: t.Optional(GovernanceInternalNote),
		expiresAt: t.Optional(t.String({ format: "date-time" })),
	},
	{ additionalProperties: false },
);
export const UnitProtectionParams = t.Object({ unitId: Uuid, protectionId: Uuid });
export const CreateUnitProtectionBody = t.Object(
	{
		scope: UnitScope,
		mode: t.UnionEnum(UnitProtectionModeValues),
		reasonCode: GovernanceReasonCode,
		internalNote: t.Optional(GovernanceInternalNote),
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
	notes: t.Array(GovernanceNoteResponse),
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
	notes: t.Array(GovernanceNoteBindingResponse),
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
export const UnitAccessInvitationResponse = t.Object({
	id: Uuid,
	unitId: Uuid,
	invitedProfileId: Uuid,
	role: t.UnionEnum(UnitDelegableAccessRoleValues),
	scope: UnitScope,
	invitedByProfileId: Uuid,
	expiresAt: DateTime,
	accessExpiresAt: t.Nullable(DateTime),
	state: t.Union([
		t.Literal("pending"),
		t.Literal("expired"),
		t.Literal("accepted"),
		t.Literal("declined"),
		t.Literal("cancelled"),
	]),
	resolution: t.Nullable(
		t.Union([t.Literal("accepted"), t.Literal("declined"), t.Literal("cancelled")]),
	),
	resolvedAt: t.Nullable(DateTime),
	resolvedByProfileId: t.Nullable(Uuid),
	acceptedBindingId: t.Nullable(Uuid),
	createdAt: DateTime,
	updatedAt: DateTime,
});
export const UnitAccessInvitationListResponse = t.Object({
	items: t.Array(UnitAccessInvitationResponse),
});
export const UnitAccessRestrictionResponse = t.Object({
	id: Uuid,
	unitId: Uuid,
	subject: UnitAccessRestrictionSubject,
	permission: t.String(),
	scope: UnitScope,
	reasonCode: GovernanceReasonCode,
	internalNotePostId: t.Nullable(Uuid),
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
	reasonCode: GovernanceReasonCode,
	internalNotePostId: t.Nullable(Uuid),
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
