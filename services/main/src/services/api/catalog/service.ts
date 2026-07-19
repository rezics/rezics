import { eq } from "drizzle-orm";

import { database } from "../../database";
import { entity, unit, unitAccessBinding, unitLocalization } from "../../database/schema";
import { UnitNotFound } from "../../units/errors";
import { recordUnitRevision } from "../../units/history";
import { insertAddressedUnit } from "../../units/slug-address";
import { TopLevelSlugNamespaceUnitIds } from "../../units/slug-system";
import { generateSlugLabel } from "../../units/slug";
import type { CreateCatalogUnitBody } from "./schema";

export async function createCatalogUnit(
	type: "entity" | "tag",
	ownerId: string,
	body: CreateCatalogUnitBody,
) {
	return database.transaction(async (tx) => {
		const created = await insertAddressedUnit(tx, {
			kind: type,
			slugScopeId:
				type === "entity"
					? TopLevelSlugNamespaceUnitIds.entities
					: TopLevelSlugNamespaceUnitIds.tags,
			slug: body.slug ?? generateSlugLabel(body.localization.title, "entry"),
			status: "published",
			visibility: "public",
			publishedAt: new Date(),
		});
		if (type === "entity")
			await tx.insert(entity).values({ id: created.id, kind: body.kind ?? "person" });
		await tx.insert(unitLocalization).values({ unitId: created.id, ...body.localization });
		await tx.insert(unitAccessBinding).values({
			unitId: created.id,
			subjectKind: "profile",
			profileId: ownerId,
			role: "owner",
			scope: [],
			grantedByProfileId: ownerId,
		});
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
