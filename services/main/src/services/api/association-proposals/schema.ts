import { t } from "elysia";

import { EntityAssociationKindValues } from "../../database/schema/contract-values";
import { DateTime, Uuid } from "../schema";

const EntityAssociationKind = t.UnionEnum(EntityAssociationKindValues);

export const UnitAssociationProposalParams = t.Object({ unitId: Uuid });
export const UnitAssociationProposalActionParams = t.Object({ unitId: Uuid, proposalId: Uuid });
export const ListEntityAssociationProposalsQuery = t.Object(
	{
		side: t.Union([t.Literal("source"), t.Literal("target")]),
		kind: EntityAssociationKind,
		includeResolved: t.Optional(t.Boolean()),
	},
	{ additionalProperties: false },
);
export const CreateEntityAssociationRequestBody = t.Object(
	{
		targetEntityId: Uuid,
		kind: EntityAssociationKind,
		role: t.String({ minLength: 1, maxLength: 64 }),
		expiresAt: t.String({ format: "date-time" }),
	},
	{ additionalProperties: false },
);
export const CreateEntityAssociationInvitationBody = t.Object(
	{
		sourceUnitId: Uuid,
		kind: EntityAssociationKind,
		role: t.String({ minLength: 1, maxLength: 64 }),
		expiresAt: t.String({ format: "date-time" }),
	},
	{ additionalProperties: false },
);

export const EntityAssociationProposalResponse = t.Object({
	id: Uuid,
	sourceUnitId: Uuid,
	targetEntityId: Uuid,
	kind: EntityAssociationKind,
	role: t.String(),
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
});
export const EntityAssociationProposalListResponse = t.Object({
	items: t.Array(EntityAssociationProposalResponse),
});
