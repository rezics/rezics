import { eq } from "drizzle-orm";

import type { DatabaseTransaction } from "../../database";
import { collection, creditAttribution, unit } from "../../database/schema";
import {
	createCollectionStructureHistory,
	getCollectionStructureHeadRevision,
} from "../../collection-structure/history";
import { fractionalPositionAt } from "../../ordering/position";
import { insertUnitIfMissing } from "../../units/create";
import { recordUnitRevision } from "../../units/history";
import { CuratedCreationTagCollectionManifest, OfficialProfileIds } from "../data";
import { assertFields, bootstrapEpoch, ensureLocalization, ensureOwnership } from "./common";

export async function ensureCuratedCreationTagCollections(tx: DatabaseTransaction): Promise<void> {
	const createdAt = bootstrapEpoch();
	for (const value of CuratedCreationTagCollectionManifest) {
		const created = await insertUnitIfMissing(tx, {
			id: value.id,
			kind: "collection",
			status: "published",
			visibility: "public",
			publishedAt: createdAt,
			createdAt,
			updatedAt: createdAt,
			statusActor: { kind: "system" },
		});
		const [storedUnit] = await tx
			.select({
				id: unit.id,
				kind: unit.kind,
				status: unit.status,
				visibility: unit.visibility,
				moderationStatus: unit.moderationStatus,
				deletedAt: unit.deletedAt,
			})
			.from(unit)
			.where(eq(unit.id, value.id))
			.limit(1);
		assertFields(`curated Tag Collection ${value.key}`, storedUnit, {
			id: value.id,
			kind: "collection",
			status: "published",
			visibility: "public",
			moderationStatus: "approved",
			deletedAt: null,
		});

		let changed = created !== null;
		const insertedCollection = await tx
			.insert(collection)
			.values({ id: value.id })
			.onConflictDoNothing()
			.returning({ id: collection.id });
		changed ||= insertedCollection.length > 0;
		const [storedCollection] = await tx
			.select({ id: collection.id })
			.from(collection)
			.where(eq(collection.id, value.id))
			.limit(1);
		assertFields(`curated Tag Collection marker ${value.key}`, storedCollection, {
			id: value.id,
		});
		for (const [index, localization] of value.localizations.entries()) {
			changed =
				(await ensureLocalization(tx, {
					unitId: value.id,
					position: fractionalPositionAt(index),
					...localization,
				})) || changed;
		}
		changed = (await ensureOwnership(tx, value.id, OfficialProfileIds.editorial)) || changed;
		const publisher = await tx
			.insert(creditAttribution)
			.values({
				sourceUnitId: value.id,
				creditedUnitId: OfficialProfileIds.editorial,
				role: "publisher",
				position: "a0",
				createdAt,
				updatedAt: createdAt,
			})
			.onConflictDoNothing()
			.returning({ id: creditAttribution.id });
		changed ||= publisher.length > 0;
		if (changed)
			await recordUnitRevision(tx, {
				unitId: value.id,
				actorProfileId: OfficialProfileIds.editorial,
				event: "create",
				message: "Bootstrap curated creation Tag Collection",
			});
		if (!(await getCollectionStructureHeadRevision(tx, value.id)))
			await createCollectionStructureHistory(tx, {
				collectionId: value.id,
				actorProfileId: OfficialProfileIds.editorial,
			});
	}
}
