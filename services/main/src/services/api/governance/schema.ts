import { t } from "elysia";

import {
	CapabilityAuthorityValues,
	CollaboratorRoleValues,
	EnforcementKindValues,
	ModerationCaseStateValues,
	ModerationStatusValues,
	PlatformCapabilityValues,
} from "../../database/schema/contract-values";
import { DateTime, Uuid } from "../schema";

const NullableUuid = t.Nullable(Uuid);

const ModerationCaseState = t.Union(ModerationCaseStateValues.map((value) => t.Literal(value)));

const ModerationActionKind = t.Union([
	t.Literal("approve"),
	t.Literal("remove"),
	t.Literal("restore"),
	t.Literal("lock"),
	t.Literal("unlock"),
	t.Literal("field_lock"),
	t.Literal("field_unlock"),
	t.Literal("mute_member"),
	t.Literal("remove_member"),
	t.Literal("ban_member"),
	t.Literal("restore_member"),
	t.Literal("escalate"),
	t.Literal("reverse"),
	t.Literal("note"),
]);

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

export const CreateModerationActionBody = t.Object(
	{
		caseId: Uuid,
		kind: ModerationActionKind,
		resultingStatus: t.Optional(
			t.Union(ModerationStatusValues.map((value) => t.Literal(value))),
		),
		resultingLocked: t.Optional(t.Boolean()),
		reasonCode: t.String({ minLength: 1, maxLength: 64 }),
		reason: t.Optional(t.String({ maxLength: 10_000 })),
		publicMessage: t.Optional(t.String({ maxLength: 2_000 })),
		reversesActionId: t.Optional(Uuid),
		idempotencyKey: t.Optional(t.String({ minLength: 1, maxLength: 256 })),
	},
	{ additionalProperties: false },
);

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
export const UnitCollaboratorParams = t.Object({ unitId: Uuid, profileId: Uuid });
export const AddUnitCollaboratorBody = t.Object(
	{
		profileId: Uuid,
		role: t.Union(CollaboratorRoleValues.map((value) => t.Literal(value))),
	},
	{ additionalProperties: false },
);
export const AddUnitFieldLockBody = t.Object(
	{
		path: t.String({ minLength: 1, maxLength: 256, pattern: "^/" }),
		reason: t.Optional(t.String({ maxLength: 2_000 })),
	},
	{ additionalProperties: false },
);
export const UnitFieldLockParams = t.Object({ unitId: Uuid, lockId: Uuid });

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

export const CollaboratorResponse = t.Object({
	unitId: Uuid,
	profileId: Uuid,
	role: t.String(),
	addedByProfileId: Uuid,
	createdAt: DateTime,
	updatedAt: DateTime,
});
export const CollaboratorListResponse = t.Object({ items: t.Array(CollaboratorResponse) });
export const FieldLockResponse = t.Object({
	id: Uuid,
	unitId: Uuid,
	path: t.String(),
	lockedByProfileId: Uuid,
	reason: t.Nullable(t.String()),
	createdAt: DateTime,
	updatedAt: DateTime,
});
export const FieldLockListResponse = t.Object({ items: t.Array(FieldLockResponse) });
