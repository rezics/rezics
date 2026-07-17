import { and, eq, sql } from "drizzle-orm";

import { getUnitReadCondition } from "../../authorization/unit/query";
import { database } from "../../database";
import {
	collection as collectionTable,
	collectionItem,
	unit,
	unitCollaborator,
	unitLocalization,
} from "../../database/schema";
import { recordUnitRevision } from "../../units/history";
import { DefaultLanguage } from "../../database/schema/contract-values";
import { CollectionNotFound } from "./errors";

export async function ensureFavorites(ownerId: string) {
	const find = () =>
		database
			.select({ id: collectionTable.id })
			.from(collectionTable)
			.where(
				and(
					eq(collectionTable.ownerProfileId, ownerId),
					eq(collectionTable.kind, "favorites"),
				),
			)
			.limit(1);
	const [existing] = await find();
	if (existing) return existing.id;

	try {
		return await database.transaction(async (tx) => {
			const [created] = await tx
				.insert(unit)
				.values({
					kind: "collection",
					slug: `favorites-${ownerId}`,
					status: "published",
					visibility: "private",
					publishedAt: new Date(),
				})
				.returning({ id: unit.id });
			if (!created) throw new Error("Favorites insertion did not return an id");
			await tx
				.insert(collectionTable)
				.values({ id: created.id, ownerProfileId: ownerId, kind: "favorites" });
			await tx.insert(unitLocalization).values({
				unitId: created.id,
				language: DefaultLanguage,
				isDefault: true,
				title: "Favorites",
			});
			await tx.insert(unitCollaborator).values({
				unitId: created.id,
				profileId: ownerId,
				role: "owner",
				addedByProfileId: ownerId,
			});
			await recordUnitRevision(tx, {
				unitId: created.id,
				actorProfileId: ownerId,
				event: "create",
			});
			return created.id;
		});
	} catch (error) {
		const [raced] = await find();
		if (raced) return raced.id;
		throw error;
	}
}

export async function getCollection(collectionId: string, viewerId?: string) {
	const [record] = await database
		.select({
			id: unit.id,
			slug: unit.slug,
			status: unit.status,
			visibility: unit.visibility,
			language: unitLocalization.language,
			ownerId: collectionTable.ownerProfileId,
			kind: collectionTable.kind,
			itemCount: sql<number>`(select count(*) from ${collectionItem} where ${collectionItem.collectionId} = ${collectionTable.id})::int`,
			createdAt: unit.createdAt,
			updatedAt: unit.updatedAt,
		})
		.from(collectionTable)
		.innerJoin(unit, eq(unit.id, collectionTable.id))
		.leftJoin(
			unitLocalization,
			and(eq(unitLocalization.unitId, unit.id), eq(unitLocalization.isDefault, true)),
		)
		.where(eq(collectionTable.id, collectionId))
		.limit(1);
	if (
		!record ||
		(record.ownerId !== viewerId &&
			!(record.status === "published" && ["public", "unlisted"].includes(record.visibility)))
	)
		throw new CollectionNotFound();

	const localizations = await database
		.select({
			language: unitLocalization.language,
			title: unitLocalization.title,
			summary: unitLocalization.summary,
		})
		.from(unitLocalization)
		.where(eq(unitLocalization.unitId, collectionId));
	const items = await database
		.select({
			targetId: collectionItem.unitId,
			kind: collectionItem.role,
			position: collectionItem.position,
			type: unit.kind,
			slug: unit.slug,
			title: unitLocalization.title,
		})
		.from(collectionItem)
		.innerJoin(unit, eq(unit.id, collectionItem.unitId))
		.leftJoin(
			unitLocalization,
			and(eq(unitLocalization.unitId, unit.id), eq(unitLocalization.isDefault, true)),
		)
		.where(and(eq(collectionItem.collectionId, collectionId), getUnitReadCondition(viewerId)))
		.orderBy(collectionItem.position, collectionItem.unitId);
	return {
		...record,
		localizations,
		items: items.map((item) => ({ ...item, parentTargetId: null })),
	};
}
