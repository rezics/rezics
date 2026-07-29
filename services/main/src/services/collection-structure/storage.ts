import { asc, eq } from "drizzle-orm";

import type { DatabaseTransaction } from "../database";
import { collection, collectionItem } from "../database/schema";
import { parseCollectionStructureSnapshot, type CollectionStructureSnapshot } from "./contracts";

export async function loadCollectionStructureSnapshot(
	tx: DatabaseTransaction,
	collectionId: string,
): Promise<CollectionStructureSnapshot> {
	const [owner] = await tx
		.select({ id: collection.id })
		.from(collection)
		.where(eq(collection.id, collectionId))
		.limit(1);
	if (!owner) throw new Error(`Collection ${collectionId} does not exist`);
	const items = await tx
		.select({
			targetUnitId: collectionItem.unitId,
			position: collectionItem.position,
			addedByProfileId: collectionItem.addedByProfileId,
			addedAt: collectionItem.createdAt,
		})
		.from(collectionItem)
		.where(eq(collectionItem.collectionId, collectionId))
		.orderBy(asc(collectionItem.unitId));
	return parseCollectionStructureSnapshot({ version: 1, collectionId, items });
}

export async function restoreCollectionStructureSnapshot(
	tx: DatabaseTransaction,
	collectionId: string,
	value: unknown,
): Promise<void> {
	const snapshot = parseCollectionStructureSnapshot(value);
	if (snapshot.collectionId !== collectionId)
		throw new TypeError("Collection Structure checkpoint contains another Collection");
	await tx.delete(collectionItem).where(eq(collectionItem.collectionId, collectionId));
	if (snapshot.items.length)
		await tx.insert(collectionItem).values(
			snapshot.items.map((item) => ({
				collectionId,
				unitId: item.targetUnitId,
				position: item.position,
				addedByProfileId: item.addedByProfileId,
				createdAt: item.addedAt,
				updatedAt: item.addedAt,
			})),
		);
}
