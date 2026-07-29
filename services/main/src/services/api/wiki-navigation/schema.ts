import { NavigationDocument } from "@rezics/block";
import { type Static, Type } from "@sinclair/typebox";
import { t } from "elysia";

import { DateTime, Uuid } from "../schema";

const NavigationInputDocument = Type.Unsafe<Static<typeof NavigationDocument>>(
	Type.Ref("NavigationDocument"),
);
const NavigationResponseDocument = Type.Unsafe<unknown>(Type.Ref("NavigationDocument"));

export const WikiNavigationOwnerParams = t.Object({ realmId: Uuid });
export const WikiNavigationParams = t.Object({ realmId: Uuid, navigationId: Uuid });
export const WikiNavigationBody = t.Object(
	{ document: NavigationInputDocument },
	{ additionalProperties: false },
);
export const WikiNavigationReplaceBody = t.Object(
	{ document: NavigationInputDocument, baseRevisionId: Uuid },
	{ additionalProperties: false },
);
export const WikiNavigationRevisionBody = t.Object(
	{ baseRevisionId: Uuid },
	{ additionalProperties: false },
);
export const WikiNavigationResponse = t.Object({
	id: Uuid,
	realmId: Uuid,
	document: NavigationResponseDocument,
	latestRevisionId: Uuid,
	createdAt: DateTime,
	updatedAt: DateTime,
});
export const WikiNavigationListResponse = t.Object({
	items: t.Array(WikiNavigationResponse),
});
