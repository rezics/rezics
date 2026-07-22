import { eq } from "drizzle-orm";

import { database } from "../../database";
import { entity, entityAssociationPolicy, unit, unitLocalization } from "../../database/schema";
import { UnitNotFound } from "../../units/errors";
import { recordUnitRevision } from "../../units/history";
import {
	createCommunityCatalogAccess,
	createProfileOwnedUnitAccess,
} from "../../authorization/unit/ownership";
import { insertUnit } from "../../units/create";
import { toUnitLocalizationStorage, unitLocalizationImageAssetIds } from "../../units/localization";
import { ensureImageAssetsAttachable } from "../image-assets/service";
import type { CreateCatalogUnitBody } from "./schema";

export async function createCatalogUnit(
	type: "entity" | "tag",
	ownerId: string,
	body: CreateCatalogUnitBody,
) {
	return database.transaction(async (tx) => {
		await ensureImageAssetsAttachable(
			tx,
			ownerId,
			unitLocalizationImageAssetIds(body.localization),
		);
		const created = await insertUnit(tx, {
			kind: type,
			status: "published",
			visibility: "public",
			publishedAt: new Date(),
			statusActor: { kind: "profile", profileId: ownerId },
		});
		if (type === "entity") {
			await tx.insert(entity).values({ id: created.id, kind: body.kind ?? "person" });
			await tx.insert(entityAssociationPolicy).values([
				{
					entityId: created.id,
					kind: "credit",
					mode: "approval",
					updatedByProfileId: ownerId,
				},
				{
					entityId: created.id,
					kind: "subject",
					mode: "open",
					updatedByProfileId: ownerId,
				},
			]);
		}
		await tx
			.insert(unitLocalization)
			.values({ unitId: created.id, ...toUnitLocalizationStorage(body.localization) });
		if (type === "entity") await createProfileOwnedUnitAccess(tx, created.id, ownerId);
		else await createCommunityCatalogAccess(tx, created.id, ownerId);
		await recordUnitRevision(tx, {
			unitId: created.id,
			actorProfileId: ownerId,
			event: "create",
		});
		return created.id;
	});
}

export async function checkUnitType(unitId: string, type: (typeof unit.$inferSelect)["kind"]) {
	const [unitRecord] = await database
		.select({ type: unit.kind })
		.from(unit)
		.where(eq(unit.id, unitId))
		.limit(1);
	if (!unitRecord || unitRecord.type !== type) throw new UnitNotFound();
}
