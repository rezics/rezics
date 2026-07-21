import { NavigationDocument } from "@rezics/block";
import { type Static, Type } from "@sinclair/typebox";
import { t } from "elysia";

import { DateTime, Uuid } from "../schema";

const NavigationInputDocument = Type.Unsafe<Static<typeof NavigationDocument>>(
	Type.Ref("NavigationDocument"),
);
const NavigationResponseDocument = Type.Unsafe<unknown>(Type.Ref("NavigationDocument"));

export const RealmNavigationOwnerParams = t.Object({ realmId: Uuid });
export const RealmNavigationParams = t.Object({ realmId: Uuid, navigationId: Uuid });
export const RealmNavigationBody = t.Object(
	{ document: NavigationInputDocument },
	{ additionalProperties: false },
);
export const RealmNavigationReplaceBody = t.Object(
	{ document: NavigationInputDocument, baseRevisionId: Uuid },
	{ additionalProperties: false },
);
export const RealmNavigationRevisionBody = t.Object(
	{ baseRevisionId: Uuid },
	{ additionalProperties: false },
);
export const RealmNavigationResponse = t.Object({
	id: Uuid,
	realmId: Uuid,
	document: NavigationResponseDocument,
	latestRevisionId: Uuid,
	createdAt: DateTime,
	updatedAt: DateTime,
});
export const RealmNavigationListResponse = t.Object({
	items: t.Array(RealmNavigationResponse),
});
