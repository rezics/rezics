import { t } from "elysia";

import {
	AssociationKindValues,
	CreditAttributionRoleValues,
	SubjectAssociationRoleValues,
} from "../../database/schema/contract-values";
import { DateTime, Uuid } from "../schema";

const AssociationKind = t.UnionEnum(AssociationKindValues);

export const UnitAssociationProposalParams = t.Object({ unitId: Uuid });
export const UnitAssociationProposalActionParams = t.Object({ unitId: Uuid, proposalId: Uuid });
export const ListAssociationProposalsQuery = t.Object(
	{
		side: t.Union([t.Literal("source"), t.Literal("target")]),
		kind: AssociationKind,
		includeResolved: t.Optional(t.Boolean()),
	},
	{ additionalProperties: false },
);
const AssociationRole = t.UnionEnum([
	...CreditAttributionRoleValues,
	...SubjectAssociationRoleValues,
]);

export const CreateAssociationRequestBody = t.Object(
	{
		targetUnitId: Uuid,
		kind: AssociationKind,
		role: AssociationRole,
		expiresAt: t.String({ format: "date-time" }),
	},
	{ additionalProperties: false },
);
export const CreateAssociationInvitationBody = t.Object(
	{
		sourceUnitId: Uuid,
		kind: AssociationKind,
		role: AssociationRole,
		expiresAt: t.String({ format: "date-time" }),
	},
	{ additionalProperties: false },
);

const AssociationProposalResponseFields = {
	id: Uuid,
	sourceUnitId: Uuid,
	targetUnitId: Uuid,
	direction: t.Union([t.Literal("request"), t.Literal("invitation")]),
	createdByProfileId: Uuid,
	expiresAt: DateTime,
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
	createdAt: DateTime,
	updatedAt: DateTime,
} as const;
export const AssociationProposalResponse = t.Object({
	...AssociationProposalResponseFields,
	kind: AssociationKind,
	role: AssociationRole,
});
export const AssociationProposalListResponse = t.Object({
	items: t.Array(AssociationProposalResponse),
});
