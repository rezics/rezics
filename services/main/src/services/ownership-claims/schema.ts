import { type Static, t } from "elysia";

import {
	UnitOwnershipModeValues,
	UnitOwnershipClaimResolutionValues,
} from "../database/schema/contract-values";
import { DateTime, RevisionContext, UnitKind, Uuid } from "../api/schema";
import { GovernanceRuleReferences } from "../api/governance/schema";

export const UnitOwnershipClaimStateValues = [
	"pending",
	...UnitOwnershipClaimResolutionValues,
] as const;

export const UnitOwnershipClaimParams = t.Object(
	{ claimId: Uuid },
	{ additionalProperties: false },
);
export type UnitOwnershipClaimParams = Static<typeof UnitOwnershipClaimParams>;

export const CreateUnitOwnershipClaimBody = t.Object(
	{
		unitId: Uuid,
		details: t.String({ minLength: 1, maxLength: 2_000, pattern: ".*\\S.*" }),
	},
	{ additionalProperties: false },
);
export type CreateUnitOwnershipClaimBody = Static<typeof CreateUnitOwnershipClaimBody>;

export const PendingUnitOwnershipClaimResponse = t.Object(
	{
		id: Uuid,
		state: t.Literal("pending"),
		details: t.String(),
		createdAt: DateTime,
	},
	{ additionalProperties: false },
);

export const ListPlatformUnitOwnershipClaimsQuery = t.Object(
	{
		state: t.Optional(t.UnionEnum(UnitOwnershipClaimStateValues, { default: undefined })),
		cursor: t.Optional(t.String({ minLength: 1, maxLength: 512 })),
		limit: t.Optional(t.Integer({ minimum: 1, maximum: 100, default: 50 })),
	},
	{ additionalProperties: false },
);
export type ListPlatformUnitOwnershipClaimsQuery = Static<
	typeof ListPlatformUnitOwnershipClaimsQuery
>;

export const PlatformUnitOwnershipClaimResponse = t.Object(
	{
		id: Uuid,
		unitId: Uuid,
		unitKind: UnitKind,
		unitTitle: t.Nullable(t.String()),
		ownershipMode: t.UnionEnum(UnitOwnershipModeValues),
		currentOwnerProfileId: t.Nullable(Uuid),
		claimantProfileId: Uuid,
		claimantLabel: t.Nullable(t.String()),
		sourceOwnershipId: Uuid,
		details: t.String(),
		state: t.UnionEnum(UnitOwnershipClaimStateValues, { default: undefined }),
		resolution: t.Nullable(t.UnionEnum(UnitOwnershipClaimResolutionValues)),
		resolvedAt: t.Nullable(DateTime),
		resolvedByProfileId: t.Nullable(Uuid),
		resultingOwnershipId: t.Nullable(Uuid),
		createdAt: DateTime,
	},
	{ additionalProperties: false },
);

export const PlatformUnitOwnershipClaimListResponse = t.Object(
	{
		items: t.Array(PlatformUnitOwnershipClaimResponse),
		nextCursor: t.Nullable(t.String()),
	},
	{ additionalProperties: false },
);

export const DecideUnitOwnershipClaimBody = t.Object(
	{
		decision: t.Union([t.Literal("approved"), t.Literal("rejected")]),
		confirmationClaimId: Uuid,
		rules: GovernanceRuleReferences,
		note: t.Optional(t.String({ minLength: 1, maxLength: 2_000 })),
		revisionContext: t.Optional(RevisionContext),
	},
	{ additionalProperties: false },
);
export type DecideUnitOwnershipClaimBody = Static<typeof DecideUnitOwnershipClaimBody>;

export const UnitOwnershipClaimDecisionResponse = t.Union([
	t.Object(
		{
			id: Uuid,
			state: t.Literal("approved"),
			ownershipId: Uuid,
		},
		{ additionalProperties: false },
	),
	t.Object(
		{
			id: Uuid,
			state: t.Literal("rejected"),
			ownershipId: t.Null(),
		},
		{ additionalProperties: false },
	),
]);
