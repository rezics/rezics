import {
	AuditAuthorityKindValues,
	AuditCredentialKindValues,
	AuditEventCategoryValues,
	AuditEventOutcomeValues,
} from "../../audit";
import { t } from "elysia";

import { DateTime, Uuid } from "../schema";
import { AuditEventSchemaVersion } from "../../database/schema";

export const AuditEventsQuery = t.Object(
	{
		cursor: t.Optional(t.String({ minLength: 1, maxLength: 500 })),
		limit: t.Optional(t.Integer({ minimum: 1, maximum: 100, default: 50 })),
		category: t.Optional(t.UnionEnum(AuditEventCategoryValues)),
		outcome: t.Optional(t.UnionEnum(AuditEventOutcomeValues)),
		action: t.Optional(t.String({ minLength: 1, maxLength: 200 })),
		actorProfileId: t.Optional(Uuid),
		authorityKind: t.Optional(t.UnionEnum(AuditAuthorityKindValues)),
		authorityId: t.Optional(Uuid),
		targetId: t.Optional(Uuid),
	},
	{ additionalProperties: false },
);

export const AuditEventResponse = t.Object({
	id: Uuid,
	schemaVersion: t.Literal(AuditEventSchemaVersion),
	category: t.UnionEnum(AuditEventCategoryValues),
	outcome: t.UnionEnum(AuditEventOutcomeValues),
	actor: t.Object({
		kind: t.UnionEnum(["profile", "system"] as const),
		profileId: t.Nullable(Uuid),
		profileName: t.Nullable(t.String()),
		credentialKind: t.UnionEnum(AuditCredentialKindValues),
		credentialId: t.Nullable(t.String()),
	}),
	authority: t.Object({
		kind: t.UnionEnum(AuditAuthorityKindValues),
		id: t.Nullable(Uuid),
	}),
	action: t.String(),
	reasonCode: t.Nullable(t.String()),
	requestId: t.Nullable(t.String()),
	traceId: t.Nullable(t.String()),
	target: t.Nullable(
		t.Object({
			kind: t.String(),
			id: t.Nullable(Uuid),
			path: t.Nullable(t.String()),
			name: t.Nullable(t.String()),
		}),
	),
	details: t.Nullable(t.Record(t.String(), t.Unknown())),
	createdAt: DateTime,
});

export const AuditEventListResponse = t.Object({
	items: t.Array(AuditEventResponse),
	nextCursor: t.Nullable(t.String()),
});
