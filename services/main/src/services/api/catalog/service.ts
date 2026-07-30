import { eq } from "drizzle-orm";

import { database } from "../../database";
import { entity, tag, unit, unitAccessGrant, unitLocalization } from "../../database/schema";
import { UnitNotFound } from "../../units/errors";
import { recordUnitRevision } from "../../units/history";
import {
	createCommunityCatalogAccess,
	createProfileOwnedUnitAccess,
	createPublicEditableUnitAccess,
} from "../../authorization/unit/ownership";
import { insertUnit } from "../../units/create";
import {
	toUnitLocalizationStorage,
	unitLocalizationImageAssetReferences,
} from "../../units/localization";
import { ensureImageAssetsAttachable } from "../image-assets/service";
import { createProfilePublisherAttribution } from "../../units/attribution";
import { OfficialProfileIds } from "../../bootstrap/manifest";
import type { CreateCatalogUnitBody, CreateEntityBody } from "./schema";

export function createCatalogUnit(
	type: "entity",
	ownerId: string,
	body: CreateEntityBody,
): Promise<string>;
export function createCatalogUnit(
	type: "tag",
	ownerId: string,
	body: CreateCatalogUnitBody,
): Promise<string>;
export async function createCatalogUnit(
	type: "entity" | "tag",
	ownerId: string,
	body: CreateCatalogUnitBody | CreateEntityBody,
) {
	return database.transaction(async (tx) => {
		await ensureImageAssetsAttachable(
			tx,
			ownerId,
			unitLocalizationImageAssetReferences(body.localization),
		);
		const created = await insertUnit(tx, {
			kind: type,
			catalogMode:
				type === "entity" && "catalogMode" in body ? body.catalogMode : "public_entry",
			status: "published",
			visibility: "public",
			publishedAt: new Date(),
			statusActor: { kind: "profile", profileId: ownerId },
		});
		if (type === "entity") {
			if (!("catalogMode" in body))
				throw new TypeError("Entity creation requires a catalog mode");
			await tx.insert(entity).values({ id: created.id, kind: body.kind ?? "person" });
			const grantedByProfileId =
				body.catalogMode === "public_entry" ? OfficialProfileIds.community : ownerId;
			await tx.insert(unitAccessGrant).values(
				(
					[
						"unit.read",
						"entity.association.credit.request",
						"entity.association.subject.request",
						"entity.association.subject.direct",
					] as const
				).map((permission) => ({
					unitId: created.id,
					subjectKind: "authenticated" as const,
					permission,
					scope: [],
					grantedByProfileId,
				})),
			);
		} else await tx.insert(tag).values({ id: created.id });
		await tx
			.insert(unitLocalization)
			.values({ unitId: created.id, ...toUnitLocalizationStorage(body.localization) });
		if (type === "entity") {
			if (!("catalogMode" in body))
				throw new TypeError("Entity creation requires a catalog mode");
			if (body.catalogMode === "owned_work") {
				await createProfileOwnedUnitAccess(tx, created.id, ownerId);
				await createProfilePublisherAttribution(tx, {
					sourceUnitId: created.id,
					profileId: ownerId,
				});
			} else await createPublicEditableUnitAccess(tx, created.id);
		} else await createCommunityCatalogAccess(tx, created.id, ownerId);
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
