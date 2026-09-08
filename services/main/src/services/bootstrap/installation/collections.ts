import { eq } from "drizzle-orm";

import {
	createCollectionStructureHistory,
	getCollectionStructureHeadRevision,
} from "../../collection-structure/history";
import type { DatabaseTransaction } from "../../database";
import { collection, creditAttribution } from "../../database/schema";
import { fractionalPositionAt } from "../../ordering/position";
import { insertPlatformUnitIfMissing } from "../../units/create";
import { recordUnitRevision } from "../../units/history";
import {
	CuratedCreationTagCollectionManifest,
	OfficialProfileIds,
	BootstrapPlatformAdministratorProfile,
} from "../data";
import { assertFields, bootstrapEpoch, ensureOwnership, insertStarterLocalization } from "./common";

export async function ensureCuratedCreationTagCollections(tx: DatabaseTransaction): Promise<void> {
	const createdAt = bootstrapEpoch();
	for (const value of CuratedCreationTagCollectionManifest) {
		const created = await insertPlatformUnitIfMissing(tx, {
			owner: "collection",
			values: {
				createdByAuthUserId: BootstrapPlatformAdministratorProfile.authUserId,
				id: value.id,
				status: "published",
				visibility: "public",
				publishedAt: createdAt,
				createdAt,
				updatedAt: createdAt,
			},
			statusActor: { kind: "system" },
		});

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
				creditedEntityId: OfficialProfileIds.editorial,
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
