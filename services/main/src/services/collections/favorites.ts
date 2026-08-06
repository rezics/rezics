import { eq } from "drizzle-orm";

import { database, type DatabaseExecutor, type DatabaseTransaction } from "../database";
import {
	collection,
	creditAttribution,
	profileFavoritesCollection,
	unitLocalization,
	unitOwnership,
} from "../database/schema";
import { DefaultContentLanguage } from "../database/schema/contract-values";
import { insertUnit } from "../units/create";
import { recordUnitRevision } from "../units/history";
import { createCollectionStructureHistory } from "../collection-structure/history";

async function findFavorites(executor: DatabaseExecutor, profileId: string) {
	const [existing] = await executor
		.select({ id: profileFavoritesCollection.collectionId })
		.from(profileFavoritesCollection)
		.where(eq(profileFavoritesCollection.profileId, profileId))
		.limit(1);
	return existing?.id;
}

interface FavoritesIdentity {
	readonly profileId: string;
	readonly createdAt: Date;
	readonly collection:
		| { readonly kind: "generated" }
		| { readonly kind: "fixed"; readonly id: string };
}

async function ensureFavoritesForIdentityInTransaction(
	tx: DatabaseTransaction,
	identity: FavoritesIdentity,
): Promise<string> {
	const existingId = await findFavorites(tx, identity.profileId);
	if (existingId) {
		if (identity.collection.kind === "fixed" && existingId !== identity.collection.id) {
			throw new Error(
				`Fixed Favorites Collection for Profile ${identity.profileId} has unexpected Unit ID ${existingId}`,
			);
		}
		return existingId;
	}

	const created = await insertUnit(tx, {
		...(identity.collection.kind === "fixed" ? { id: identity.collection.id } : {}),
		kind: "collection",
		status: "published",
		visibility: "private",
		publishedAt: identity.createdAt,
		createdAt: identity.createdAt,
		updatedAt: identity.createdAt,
		statusActor: { kind: "profile", profileId: identity.profileId },
	});
	await tx.insert(collection).values({ id: created.id });
	await tx.insert(profileFavoritesCollection).values({
		profileId: identity.profileId,
		collectionId: created.id,
		createdAt: identity.createdAt,
	});
	await tx.insert(unitLocalization).values({
		unitId: created.id,
		language: DefaultContentLanguage,
		title: "Favorites",
		createdAt: identity.createdAt,
		updatedAt: identity.createdAt,
	});
	await tx.insert(unitOwnership).values({
		unitId: created.id,
		profileId: identity.profileId,
		assignedByProfileId: identity.profileId,
		createdAt: identity.createdAt,
		updatedAt: identity.createdAt,
	});
	await tx.insert(creditAttribution).values({
		sourceUnitId: created.id,
		creditedUnitId: identity.profileId,
		role: "publisher",
		position: "a0",
		createdAt: identity.createdAt,
		updatedAt: identity.createdAt,
	});
	await recordUnitRevision(tx, {
		unitId: created.id,
		actorProfileId: identity.profileId,
		event: "create",
	});
	await createCollectionStructureHistory(tx, {
		collectionId: created.id,
		actorProfileId: identity.profileId,
	});
	return created.id;
}

/**
 * Ensures one Profile's required system Favorites Collection in an existing transaction.
 */
export async function ensureFavoritesInTransaction(
	tx: DatabaseTransaction,
	profileId: string,
): Promise<string> {
	return ensureFavoritesForIdentityInTransaction(tx, {
		profileId,
		createdAt: new Date(),
		collection: { kind: "generated" },
	});
}

/**
 * Ensures one Profile's required system Favorites Collection at a fixed Unit identity.
 */
export async function ensureFixedFavoritesInTransaction(
	tx: DatabaseTransaction,
	input: {
		readonly profileId: string;
		readonly collectionId: string;
		readonly createdAt: Date;
	},
): Promise<string> {
	return ensureFavoritesForIdentityInTransaction(tx, {
		profileId: input.profileId,
		createdAt: input.createdAt,
		collection: { kind: "fixed", id: input.collectionId },
	});
}

/**
 * Ensures one Profile's required system Favorites Collection.
 *
 * @remarks
 * The retry read proves the winner of a concurrent insert after the unique
 * Profile-to-Favorites relation rolls the losing transaction back.
 */
export async function ensureFavorites(profileId: string): Promise<string> {
	const existingId = await findFavorites(database, profileId);
	if (existingId) return existingId;

	try {
		return await database.transaction((tx) => ensureFavoritesInTransaction(tx, profileId));
	} catch (error) {
		const racedId = await findFavorites(database, profileId);
		if (racedId) return racedId;
		throw error;
	}
}
