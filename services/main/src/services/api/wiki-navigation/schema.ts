import { NavigationDocument } from "@rezics/block";
import { type StaticDecode, Type } from "typebox";
import { t } from "elysia";

import { DateTime, Uuid } from "../schema";

const NavigationInputDocument =
	Type.Unsafe<StaticDecode<typeof NavigationDocument>>(NavigationDocument);
const NavigationResponseDocument = Type.Unsafe<unknown>(NavigationDocument);

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
