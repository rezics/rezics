import {
	createCollectionPresentationDocument,
	createSystemCollectionDefinitionDocument,
} from "@rezics/block";
import { and, eq } from "drizzle-orm";

import { database, type DatabaseExecutor, type DatabaseTransaction } from "../database";
import { collection, unitLocalization, unitOwnership } from "../database/schema";
import { DefaultContentLanguage } from "../database/schema/contract-values";
import { insertUnit } from "../units/create";
import { recordUnitRevision } from "../units/history";

async function findFavorites(executor: DatabaseExecutor, ownerProfileId: string) {
	const [existing] = await executor
		.select({ id: collection.id })
		.from(collection)
		.where(
			and(
				eq(collection.ownerProfileId, ownerProfileId),
				eq(collection.systemKey, "favorites"),
			),
		)
		.limit(1);
	return existing?.id;
}

/**
 * Ensures one Profile's required system Favorites Collection in an existing transaction.
 */
export async function ensureFavoritesInTransaction(
	tx: DatabaseTransaction,
	ownerProfileId: string,
): Promise<string> {
	const existingId = await findFavorites(tx, ownerProfileId);
	if (existingId) return existingId;

	const created = await insertUnit(tx, {
		kind: "collection",
		status: "published",
		visibility: "private",
		publishedAt: new Date(),
		statusActor: { kind: "profile", profileId: ownerProfileId },
	});
	await tx.insert(collection).values({
		id: created.id,
		ownerProfileId,
		source: "system",
		systemKey: "favorites",
		definitionDocument: createSystemCollectionDefinitionDocument("favorites"),
		presentationDocument: createCollectionPresentationDocument("flat", "added-at"),
	});
	await tx.insert(unitLocalization).values({
		unitId: created.id,
		language: DefaultContentLanguage,
		title: "Favorites",
	});
	await tx.insert(unitOwnership).values({
		unitId: created.id,
		profileId: ownerProfileId,
		assignedByProfileId: ownerProfileId,
	});
	await recordUnitRevision(tx, {
		unitId: created.id,
		actorProfileId: ownerProfileId,
		event: "create",
	});
	return created.id;
}

/**
 * Ensures one Profile's required system Favorites Collection.
 *
 * @remarks
 * The retry read proves the winner of a concurrent insert after the unique
 * owner/system-key constraint rolls the losing transaction back.
 */
export async function ensureFavorites(ownerProfileId: string): Promise<string> {
	const existingId = await findFavorites(database, ownerProfileId);
	if (existingId) return existingId;

	try {
		return await database.transaction((tx) => ensureFavoritesInTransaction(tx, ownerProfileId));
	} catch (error) {
		const racedId = await findFavorites(database, ownerProfileId);
		if (racedId) return racedId;
		throw error;
	}
}
