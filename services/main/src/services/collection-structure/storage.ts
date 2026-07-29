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
			parentTargetUnitId: collectionItem.parentUnitId,
			position: collectionItem.position,
			addedByProfileId: collectionItem.addedByProfileId,
			addedAt: collectionItem.createdAt,
		})
		.from(collectionItem)
		.where(eq(collectionItem.collectionId, collectionId))
		.orderBy(asc(collectionItem.unitId));
	return parseCollectionStructureSnapshot({ version: 1, collectionId, items });
}

function orderItemsParentsFirst(snapshot: CollectionStructureSnapshot) {
	const remaining = new Map(snapshot.items.map((item) => [item.targetUnitId, item]));
	const inserted = new Set<string>();
	const ordered: CollectionStructureSnapshot["items"] = [];
	while (remaining.size) {
		let progressed = false;
		for (const [targetUnitId, item] of remaining) {
			if (item.parentTargetUnitId !== null && !inserted.has(item.parentTargetUnitId))
				continue;
			ordered.push(item);
			inserted.add(targetUnitId);
			remaining.delete(targetUnitId);
			progressed = true;
		}
		if (!progressed) throw new TypeError("Collection Structure contains a cycle");
	}
	return ordered;
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
	const ordered = orderItemsParentsFirst(snapshot);
	if (ordered.length)
		await tx.insert(collectionItem).values(
			ordered.map((item) => ({
				collectionId,
				unitId: item.targetUnitId,
				parentUnitId: item.parentTargetUnitId,
				position: item.position,
				addedByProfileId: item.addedByProfileId,
				createdAt: item.addedAt,
				updatedAt: item.addedAt,
			})),
		);
}
