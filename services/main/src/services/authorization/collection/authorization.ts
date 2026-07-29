import { and, eq, isNull } from "drizzle-orm";

import { database } from "../../database";
import { collection, unitOwnership } from "../../database/schema";
import { CollectionOwnershipRequired } from "../errors";

async function ensureCollectionOwner(collectionId: string, profileId: string) {
	const [record] = await database
		.select({ id: collection.id })
		.from(collection)
		.innerJoin(
			unitOwnership,
			and(eq(unitOwnership.unitId, collection.id), eq(unitOwnership.profileId, profileId)),
		)
		.where(and(eq(collection.id, collectionId), isNull(unitOwnership.revokedAt)))
		.limit(1);
	if (!record) throw new CollectionOwnershipRequired();
	return record;
}

export class CollectionAuthorization<ProfileId extends string | undefined> {
	constructor(readonly profileId: ProfileId) {}

	ensureOwner(this: CollectionAuthorization<string>, collectionId: string) {
		return ensureCollectionOwner(collectionId, this.profileId);
	}
}
