import { UnitOwnerValues } from "@rezics/reference";
import {
	AuthenticatedGrantableUnitPermissionValues,
	DelegableUnitPermissionValues,
	PlatformCapabilityValues,
	RealmAccessSubjectRelationValues,
	UnitPermissionValues,
} from "@rezics/access";
import { PortableTextDocument } from "@rezics/block";
import { t } from "elysia";
import type { StaticDecode } from "typebox";

import {
	ContentGovernanceActionKindValues,
	ContentReviewCaseStateValues,
	EnforcementKindValues,
	GovernanceMaxRuleReferences,
	UnitStatusValues,
} from "../../database/schema/contract-values";
import {
	ContentLanguage,
	DateTime,
	LocalizationLanguageQuery,
	RevisionContext,
	Uuid,
} from "../schema";

const NullableUuid = t.Nullable(Uuid);

const ContentReviewCaseState = t.UnionEnum(ContentReviewCaseStateValues, {
	default: undefined,
});

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
		revisionContext: t.Optional(RevisionContext),
	},
	{ additionalProperties: false },
);
const GovernanceNoteBindingResponse = t.Pick(GovernanceNoteResponse, ["postId", "role"]);
export const GovernanceRuleReference = t.Object(
	{
		sourceRealmId: Uuid,
		revisionId: Uuid,
		ruleId: Uuid,
	},
	{ additionalProperties: false },
);
export type GovernanceRuleReference = StaticDecode<typeof GovernanceRuleReference>;
const ContentGovernanceActionCommon = {
	caseId: Uuid,
	notes: t.Optional(GovernanceActionNotes),
	idempotencyKey: t.Optional(t.String({ minLength: 1, maxLength: 256 })),
	revisionContext: t.Optional(RevisionContext),
};

export const ListContentReviewCasesQuery = t.Object({
	realmId: t.Optional(Uuid),
	state: t.Optional(ContentReviewCaseState),
	limit: t.Optional(t.Integer({ minimum: 1, maximum: 100, default: 50 })),
});
export const ContentReviewCaseParams = t.Object({ caseId: Uuid });
export const UpdateContentReviewCaseBody = t.Object(
	{
		state: t.Optional(ContentReviewCaseState),
		assignedProfileId: t.Optional(NullableUuid),
		duplicateOfCaseId: t.Optional(NullableUuid),
		internalNote: t.Optional(GovernanceInternalNote),
		revisionContext: t.Optional(RevisionContext),
	},
	{ minProperties: 1, additionalProperties: false },
);

const UnitScope = t.Array(
	t.String({ minLength: 1, maxLength: 64, pattern: "^[a-z0-9][a-z0-9-]*$" }),
	{ maxItems: 8 },
);

export const GovernanceRuleReferences = t.Array(GovernanceRuleReference, {
	minItems: 1,
	maxItems: GovernanceMaxRuleReferences,
	uniqueItems: true,
});

export const GovernanceRuleSourcesQuery = t.Object(
	{
		...LocalizationLanguageQuery,
		authorityKind: t.Union([
			t.Literal("platform"),
			t.Literal("realm"),
			t.Literal("zone"),
			t.Literal("unit"),
		]),
		authorityId: t.Optional(Uuid),
	},
	{ additionalProperties: false },
);
export const GovernanceRuleSourcesResponse = t.Object({
	items: t.Array(
		t.Object(
			{
				id: Uuid,
				scope: t.Union([t.Literal("platform"), t.Literal("realm"), t.Literal("local")]),
				language: ContentLanguage,
				title: t.Nullable(t.String()),
				revisionId: Uuid,
				rules: t.Array(
					t.Object(
						{
							id: Uuid,
							language: ContentLanguage,
							title: t.String(),
						},
						{ additionalProperties: false },
					),
					{ minItems: 1, maxItems: 100 },
				),
			},
			{ additionalProperties: false },
		),
		{ minItems: 1, maxItems: 2 },
	),
});
const RuleBackedContentGovernanceActionKind = t.Union([
	t.Literal("approve"),
	t.Literal("hide"),
	t.Literal("remove"),
	t.Literal("restore"),
	t.Literal("lock_post_targeting"),
	t.Literal("unlock_post_targeting"),
]);

export const CreateContentGovernanceActionBody = t.Union([
	t.Object(
		{
			...ContentGovernanceActionCommon,
			kind: RuleBackedContentGovernanceActionKind,
			rules: GovernanceRuleReferences,
		},
		{ additionalProperties: false },
	),
	t.Object(
		{
			...ContentGovernanceActionCommon,
			kind: t.Literal("invalidate_license"),
			licenseGrantId: Uuid,
			rules: GovernanceRuleReferences,
		},
		{ additionalProperties: false },
	),
	t.Object(
		{
			...ContentGovernanceActionCommon,
			kind: t.Literal("restore_license"),
			reversesActionId: Uuid,
		},
		{ additionalProperties: false },
	),
	t.Object(
		{
			...ContentGovernanceActionCommon,
			kind: t.Literal("reverse"),
			reversesActionId: Uuid,
		},
		{ additionalProperties: false },
	),
]);
export type CreateContentGovernanceActionBody = StaticDecode<
	typeof CreateContentGovernanceActionBody
>;

const AccountEnforcementKind = t.Union(EnforcementKindValues.map((value) => t.Literal(value)));
export const CreateAccountEnforcementBody = t.Object(
	{
		authUserId: Uuid,
		kind: AccountEnforcementKind,
		rules: GovernanceRuleReferences,
		notes: t.Optional(GovernanceActionNotes),
		expiresAt: t.Optional(t.String({ format: "date-time" })),
		revisionContext: t.Optional(RevisionContext),
	},
	{ additionalProperties: false },
);
export const AccountEnforcementParams = t.Object({ enforcementId: Uuid });
export const RevokeAccountEnforcementBody = t.Object(
	{
		notes: t.Optional(GovernanceActionNotes),
		revisionContext: t.Optional(RevisionContext),
	},
	{ additionalProperties: false },
);

const Capability = t.Union(PlatformCapabilityValues.map((value) => t.Literal(value)));
export const ListGrantsQuery = t.Object({}, { additionalProperties: false });
export const CreateGrantBody = t.Object(
	{
		profileId: Uuid,
		capability: Capability,
		expiresAt: t.Optional(t.String({ format: "date-time" })),
	},
	{ additionalProperties: false },
);
export const GrantParams = t.Object({ grantId: Uuid });

export const UnitGovernanceParams = t.Object({ unitId: Uuid });
export const UnitAccessInvitationParams = t.Object({
	unitId: Uuid,
	invitationId: Uuid,
});
export const ListUnitAccessInvitationsQuery = t.Object(
	{ includeResolved: t.Optional(t.Boolean()) },
	{ additionalProperties: false },
);
export const UnitEffectiveAccessQuery = t.Object(
	{ scope: t.Optional(UnitScope) },
	{ additionalProperties: false },
);
const UnitAccessSubject = t.Union([
	t.Object({ kind: t.Literal("auth"), authUserId: Uuid }, { additionalProperties: false }),
	t.Object(
		{
			kind: t.Literal("realm"),
			realmId: Uuid,
			relation: t.UnionEnum(RealmAccessSubjectRelationValues),
		},
		{ additionalProperties: false },
	),
	t.Object({ kind: t.Literal("authenticated") }, { additionalProperties: false }),
]);
const DelegableUnitPermission = t.UnionEnum(DelegableUnitPermissionValues);
const UnitSubjectAccessCommon = {
	subject: UnitAccessSubject,
	grants: t.Array(DelegableUnitPermission, {
		maxItems: DelegableUnitPermissionValues.length,
		uniqueItems: true,
	}),
	scope: UnitScope,
	expiresAt: t.Optional(t.String({ format: "date-time" })),
};
export const ReplaceUnitSubjectAccessBody = t.Union([
	t.Object(
		{
			...UnitSubjectAccessCommon,
			restrictions: t.Array(DelegableUnitPermission, {
				minItems: 1,
				maxItems: DelegableUnitPermissionValues.length,
				uniqueItems: true,
			}),
			rules: GovernanceRuleReferences,
		},
		{ additionalProperties: false },
	),
	t.Object(
		{
			...UnitSubjectAccessCommon,
			restrictions: t.Array(DelegableUnitPermission, { maxItems: 0 }),
			rules: t.Optional(GovernanceRuleReferences),
		},
		{ additionalProperties: false },
	),
]);
export const CreateUnitAccessInvitationBody = t.Object(
	{
		invitedAuthUserId: Uuid,
		permissions: t.Array(DelegableUnitPermission, {
			minItems: 1,
			maxItems: DelegableUnitPermissionValues.length,
			uniqueItems: true,
		}),
		scope: UnitScope,
		invitationExpiresAt: t.String({ format: "date-time" }),
		accessExpiresAt: t.Optional(t.String({ format: "date-time" })),
	},
	{ additionalProperties: false },
);
export const TransferUnitOwnershipBody = t.Object(
	{
		expectedOwnerEntityId: Uuid,
		targetEntityId: Uuid,
	},
	{ additionalProperties: false },
);
export const RelinquishUnitOwnershipBody = t.Object(
	{ expectedOwnerEntityId: Uuid },
	{ additionalProperties: false },
);
export const OverrideUnitOwnershipBody = t.Object(
	{
		expectedOwnerEntityId: NullableUuid,
		targetEntityId: Uuid,
		confirmationUnitId: Uuid,
		rules: GovernanceRuleReferences,
		note: t.Optional(t.String({ minLength: 1, maxLength: 2_000 })),
	},
	{ additionalProperties: false },
);
export const UnitOwnershipResponse = t.Object({
	owner: t.Object({
		entityId: Uuid,
		label: t.Nullable(t.String()),
	}),
});
export const ListOwnershipTransferCandidatesQuery = t.Object(
	{
		query: t.Optional(t.String({ maxLength: 200 })),
		cursor: t.Optional(t.String({ maxLength: 8192 })),
		limit: t.Optional(t.Integer({ minimum: 1, maximum: 50, default: 50 })),
	},
	{ additionalProperties: false },
);
export const ListUnitOwnershipCandidatesQuery = t.Object(
	{
		query: t.Optional(
			t.String({
				minLength: 1,
				maxLength: 63,
				description: "Exact UUID, or exact slug with one explicit scope",
			}),
		),
		scopeNamespaceId: t.Optional(Uuid),
		scopeUnitId: t.Optional(Uuid),
		cursor: t.Optional(Uuid),
		limit: t.Optional(t.Integer({ minimum: 1, maximum: 50, default: 50 })),
	},
	{ additionalProperties: false },
);

const UnitLifecycleState = t.Union([t.Literal("active"), t.Literal("deleted"), t.Literal("all")]);
export const ListPlatformUnitsQuery = t.Object(
	{
		state: t.Optional(UnitLifecycleState),
		query: t.Optional(
			t.String({
				minLength: 1,
				maxLength: 63,
				description: "Exact UUID, or exact slug with one explicit scope",
			}),
		),
		scopeNamespaceId: t.Optional(Uuid),
		scopeUnitId: t.Optional(Uuid),
		cursor: t.Optional(Uuid),
		limit: t.Optional(t.Integer({ minimum: 1, maximum: 100, default: 50 })),
	},
	{ additionalProperties: false },
);
export const DeleteUnitLifecycleCommandBody = t.Object(
	{
		expectedUpdatedAt: DateTime,
		confirmationUnitId: Uuid,
		rules: GovernanceRuleReferences,
		note: t.Optional(t.String({ minLength: 1, maxLength: 2_000 })),
		revisionContext: t.Optional(RevisionContext),
	},
	{ additionalProperties: false },
);
export const RestoreUnitLifecycleCommandBody = t.Object(
	{
		expectedUpdatedAt: DateTime,
		confirmationUnitId: Uuid,
		note: t.Optional(t.String({ minLength: 1, maxLength: 2_000 })),
		revisionContext: t.Optional(RevisionContext),
	},
	{ additionalProperties: false },
);
const PlatformUnitLifecycleItem = t.Object({
	id: Uuid,
	owner: t.UnionEnum(UnitOwnerValues),
	shape: t.String(),
	title: t.Nullable(t.String()),
	status: t.UnionEnum(UnitStatusValues),
	ownership: t.Nullable(
		t.Object({
			entityId: Uuid,
			label: t.Nullable(t.String()),
		}),
	),
	deletedAt: t.Nullable(DateTime),
	updatedAt: DateTime,
	protected: t.Boolean(),
});
export const PlatformUnitListResponse = t.Object({
	items: t.Array(PlatformUnitLifecycleItem),
	nextCursor: t.Nullable(Uuid),
});
export const PlatformUnitLifecycleResponse = PlatformUnitLifecycleItem;

export const UnitAccessRestrictionSubject = t.Union([
	t.Object({ kind: t.Literal("auth"), authUserId: Uuid }, { additionalProperties: false }),
	t.Object(
		{
			kind: t.Literal("realm"),
			realmId: Uuid,
			relation: t.UnionEnum(RealmAccessSubjectRelationValues),
		},
		{ additionalProperties: false },
	),
]);
export const ListUnitAccessCandidatesQuery = t.Object(
	{
		kind: t.Union([t.Literal("auth"), t.Literal("realm")]),
		query: t.Optional(t.String({ maxLength: 200 })),
		cursor: t.Optional(t.String({ maxLength: 8192 })),
		limit: t.Optional(t.Integer({ minimum: 1, maximum: 50, default: 20 })),
	},
	{ additionalProperties: false },
);

export const ContentReviewCaseResponse = t.Object({
	id: Uuid,
	state: ContentReviewCaseState,
	authority: t.Union([t.Literal("platform"), t.Literal("realm")]),
	realmId: t.Nullable(Uuid),
	targetUnitId: Uuid,
	assignedProfileId: t.Nullable(Uuid),
	duplicateOfCaseId: t.Nullable(Uuid),
	notes: t.Array(GovernanceNoteResponse),
	notesNextCursor: t.Nullable(Uuid),
	createdAt: DateTime,
	updatedAt: DateTime,
});
export const GovernanceCaseNotesQuery = t.Object({
	cursor: t.Optional(Uuid),
	limit: t.Optional(t.Integer({ minimum: 1, maximum: 50, default: 20 })),
}, { additionalProperties: false });
export const GovernanceCaseNotesResponse = t.Object({
	items: t.Array(GovernanceNoteResponse, { maxItems: 50 }),
	nextCursor: t.Nullable(Uuid),
});
export const ContentReviewCaseListResponse = t.Object({
	items: t.Array(ContentReviewCaseResponse),
});

export const ContentGovernanceActionResponse = t.Object({
	id: Uuid,
	caseId: Uuid,
	actorProfileId: Uuid,
	kind: t.UnionEnum(ContentGovernanceActionKindValues),
	previousState: t.Nullable(t.String()),
	resultingState: t.Nullable(t.String()),
	previousPostTargetingLocked: t.Nullable(t.Boolean()),
	licenseGrantId: t.Nullable(Uuid),
	previousRecognitionStatus: t.Nullable(t.UnionEnum(["recognized", "invalidated"])),
	resultingRecognitionStatus: t.Nullable(t.UnionEnum(["recognized", "invalidated"])),
	resultingPostTargetingLocked: t.Nullable(t.Boolean()),
	reversesActionId: t.Nullable(Uuid),
	rules: t.Array(GovernanceRuleReference, {
		maxItems: GovernanceMaxRuleReferences,
	}),
	notes: t.Array(GovernanceNoteBindingResponse),
	createdAt: DateTime,
});
export type ContentGovernanceActionResponse = StaticDecode<typeof ContentGovernanceActionResponse>;

export const EnforcementResponse = t.Object({
	id: Uuid,
	authUserId: Uuid,
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
	profileId: Uuid,
	capability: t.String(),
	grantedByProfileId: Uuid,
	expiresAt: t.Nullable(DateTime),
	revokedAt: t.Nullable(DateTime),
	createdAt: DateTime,
	updatedAt: DateTime,
});
export const GrantListResponse = t.Object({ items: t.Array(GrantResponse) });

export const UnitAccessInvitationResponse = t.Object({
	id: Uuid,
	unitId: Uuid,
	invitedAuthUserId: Uuid,
	permissions: t.Array(DelegableUnitPermission),
	scope: UnitScope,
	invitedByAuthUserId: Uuid,
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
	resolvedByAuthUserId: t.Nullable(Uuid),
	createdAt: DateTime,
	updatedAt: DateTime,
});
export const UnitAccessInvitationListResponse = t.Object({
	items: t.Array(UnitAccessInvitationResponse),
});
const UnitAccessSubjectRow = t.Object({
	subject: UnitAccessSubject,
	label: t.Nullable(t.String()),
	grants: t.Array(DelegableUnitPermission),
	restrictions: t.Array(DelegableUnitPermission),
	inherited: t.Array(DelegableUnitPermission),
	expiresAt: t.Nullable(DateTime),
});
export const UnitAccessSnapshotResponse = t.Object({
	unitId: Uuid,
	unitTitle: t.Nullable(t.String()),
	unitOwner: t.UnionEnum(UnitOwnerValues),
	shape: t.String({ minLength: 1 }),
	permissions: t.Array(DelegableUnitPermission),
	authenticatedGrantablePermissions: t.Array(
		t.UnionEnum(AuthenticatedGrantableUnitPermissionValues),
	),
	owner: t.Nullable(t.Object({ entityId: Uuid, label: t.Nullable(t.String()) })),
	canTransferOwnership: t.Boolean(),
	canRelinquishOwnership: t.Boolean(),
	subjects: t.Array(UnitAccessSubjectRow),
});
export const UnitAccessCandidateListResponse = t.Object({
	items: t.Array(
		t.Object({
			subject: UnitAccessSubject,
			label: t.Nullable(t.String()),
		}),
	),
	nextCursor: t.Nullable(t.String()),
});
export const UnitOwnershipCandidateListResponse = t.Object({
	items: t.Array(
		t.Object({
			entityId: Uuid,
			label: t.Nullable(t.String()),
			slug: t.Nullable(t.String()),
		}),
	),
	nextCursor: t.Nullable(Uuid),
});

const UnitAllowedDecisionResponse = t.Union([
	t.Object(
		{
			allowed: t.Literal(true),
			source: t.Union([
				t.Literal("public"),
				t.Literal("platform"),
				t.Literal("owner"),
				t.Literal("native"),
			]),
		},
		{ additionalProperties: false },
	),
	t.Object(
		{
			allowed: t.Literal(true),
			source: t.Literal("grant"),
			grantId: Uuid,
			subjectKind: t.Union([t.Literal("auth"), t.Literal("realm"), t.Literal("authenticated")]),
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
			subjectKind: t.Union([t.Literal("auth"), t.Literal("realm")]),
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
