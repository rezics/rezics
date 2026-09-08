import { DockDocument } from "@rezics/block";
import { type StaticDecode, Type } from "typebox";
import { t } from "elysia";

import { DateTime, Uuid } from "../schema";

const OwnerRevision = t.Integer({
	minimum: 0,
	maximum: Number.MAX_SAFE_INTEGER,
});

const DockInputDocument = Type.Unsafe<StaticDecode<typeof DockDocument>>(DockDocument);
const DockResponseDocument = Type.Unsafe<unknown>(DockDocument);

export const DockUnitParams = t.Object({ unitId: Uuid });
export const DockParams = t.Object({
	unitId: Uuid,
	kind: t.Union([t.Literal("main"), t.Literal("wiki")]),
});
export const DockRevisionParams = t.Object({
	unitId: Uuid,
	kind: t.Union([t.Literal("main"), t.Literal("wiki")]),
	revisionId: Uuid,
});
export const PutDockBody = t.Object(
	{
		document: DockInputDocument,
		baseRevisionId: t.Optional(Uuid),
		expectedOwnerRevision: t.Optional(OwnerRevision),
	},
	{ additionalProperties: false },
);
export const DockRevisionBody = t.Object(
	{ baseRevisionId: Uuid, expectedOwnerRevision: t.Optional(OwnerRevision) },
	{ additionalProperties: false },
);
export const DockRevisionListQuery = t.Object({
	limit: t.Optional(t.Integer({ minimum: 1, maximum: 100, default: 50 })),
});
export const DockResponse = t.Object({
	ownerRevision: OwnerRevision,
	id: Uuid,
	unitId: Uuid,
	kind: t.Union([t.Literal("main"), t.Literal("wiki")]),
	latestRevisionId: Uuid,
	document: DockResponseDocument,
	createdAt: DateTime,
	updatedAt: DateTime,
});
export const DockListResponse = t.Object({
	ownerRevision: OwnerRevision,
	items: t.Array(DockResponse),
});
export const DockMutationResponse = t.Object({
	ownerRevision: OwnerRevision,
	updated: t.Literal(true),
	latestRevisionId: Uuid,
});
export const DockRevisionListResponse = t.Object({
	items: t.Array(
		t.Object({
			id: Uuid,
			parentRevisionId: t.Nullable(Uuid),
			sourceRevisionId: t.Nullable(Uuid),
			actorProfileId: t.Nullable(Uuid),
			kind: t.UnionEnum(["create", "update", "delete", "restore"]),
			editSummary: t.Nullable(t.String()),
			createdAt: DateTime,
		}),
	),
});
