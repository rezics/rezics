import { DockDocument } from "@rezics/block";
import { type Static, Type } from "@sinclair/typebox";
import { t } from "elysia";

import { DateTime, Uuid } from "../schema";

const DockInputDocument = Type.Unsafe<Static<typeof DockDocument>>(Type.Ref("DockDocument"));
const DockResponseDocument = Type.Unsafe<unknown>(Type.Ref("DockDocument"));

export const DockUnitParams = t.Object({ unitId: Uuid });
export const DockParams = t.Object({
	unitId: Uuid,
	surface: t.Union([t.Literal("main"), t.Literal("wiki")]),
});
export const PutDockBody = t.Object(
	{ document: DockInputDocument },
	{ additionalProperties: false },
);
export const DockResponse = t.Object({
	unitId: Uuid,
	surface: t.Union([t.Literal("main"), t.Literal("wiki")]),
	document: DockResponseDocument,
	createdAt: DateTime,
	updatedAt: DateTime,
});
export const DockListResponse = t.Object({ items: t.Array(DockResponse) });
