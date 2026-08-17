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
import { assertFields, bootstrapEpoch, ensureOwnership, insertStarterLocalization } from "./common";

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
			})
			.from(unit)
			.where(eq(unit.id, value.id))
			.limit(1);
		assertFields(`curated Tag Collection ${value.key}`, storedUnit, {
			id: value.id,
			kind: "collection",
		});

		await tx.insert(collection).values({ id: value.id }).onConflictDoNothing();
		const [storedCollection] = await tx
			.select({ id: collection.id })
			.from(collection)
			.where(eq(collection.id, value.id))
			.limit(1);
		assertFields(`curated Tag Collection marker ${value.key}`, storedCollection, {
			id: value.id,
		});
		if (created)
			for (const [index, localization] of value.localizations.entries())
				await insertStarterLocalization(tx, {
					unitId: value.id,
					position: fractionalPositionAt(index),
					...localization,
				});
		await ensureOwnership(tx, value.id, OfficialProfileIds.editorial);
		await tx
			.insert(creditAttribution)
			.values({
				sourceUnitId: value.id,
				creditedUnitId: OfficialProfileIds.editorial,
				role: "publisher",
				position: "a0",
				createdAt,
				updatedAt: createdAt,
			})
			.onConflictDoNothing();
		if (created)
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
