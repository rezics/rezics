import { DockDocument } from "@rezics/block";
import { type Static, Type } from "@sinclair/typebox";
import { t } from "elysia";

import { DateTime, Uuid } from "../schema";

const DockInputDocument = Type.Unsafe<Static<typeof DockDocument>>(Type.Ref("DockDocument"));
const DockResponseDocument = Type.Unsafe<unknown>(Type.Ref("DockDocument"));

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
	{ document: DockInputDocument, baseRevisionId: t.Optional(Uuid) },
	{ additionalProperties: false },
);
export const DockRevisionBody = t.Object({ baseRevisionId: Uuid }, { additionalProperties: false });
export const DockRevisionListQuery = t.Object({
	limit: t.Optional(t.Integer({ minimum: 1, maximum: 100, default: 50 })),
});
export const DockResponse = t.Object({
	id: Uuid,
	unitId: Uuid,
	kind: t.Union([t.Literal("main"), t.Literal("wiki")]),
	latestRevisionId: Uuid,
	document: DockResponseDocument,
	createdAt: DateTime,
	updatedAt: DateTime,
});
export const DockListResponse = t.Object({ items: t.Array(DockResponse) });
export const DockMutationResponse = t.Object({
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
