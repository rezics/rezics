import { and, eq } from "drizzle-orm";

import { database } from "../../database";
import { collection } from "../../database/schema";
import { CollectionOwnershipRequired } from "../errors";

async function ensureCollectionOwner(collectionId: string, profileId: string) {
	const [record] = await database
		.select({ id: collection.id })
		.from(collection)
		.where(and(eq(collection.id, collectionId), eq(collection.ownerProfileId, profileId)))
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
