import { eq } from "drizzle-orm";

import { database } from "../../database";
import { entity, unit, unitCollaborator, unitLocalization } from "../../database/schema";
import { UnitNotFound } from "../../units/errors";
import { recordUnitRevision } from "../../units/history";
import type { CreateCatalogUnitBody } from "./schema";

export async function createCatalogUnit(
	type: "entity" | "tag",
	ownerId: string,
	body: CreateCatalogUnitBody,
) {
	return database.transaction(async (tx) => {
		const slug =
			body.slug ??
			`${
				body.localization.title
					.normalize("NFKD")
					.toLowerCase()
					.replace(/[^a-z0-9]+/g, "-")
					.replace(/^-|-$/g, "")
					.slice(0, 56) || "entry"
			}-${crypto.randomUUID().slice(0, 8)}`;
		const [created] = await tx
			.insert(unit)
			.values({
				kind: type,
				slug,
				status: "published",
				visibility: "public",
				publishedAt: new Date(),
			})
			.returning({ id: unit.id });
		if (!created) throw new Error("Catalog Unit insertion did not return an id");
		if (type === "entity")
			await tx.insert(entity).values({ id: created.id, kind: body.kind ?? "person" });
		await tx
			.insert(unitLocalization)
			.values({ unitId: created.id, ...body.localization, isDefault: true });
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
}

export async function checkUnitType(unitId: string, type: (typeof unit.$inferSelect)["kind"]) {
	const [unitRecord] = await database
		.select({ type: unit.kind })
		.from(unit)
		.where(eq(unit.id, unitId))
		.limit(1);
	if (!unitRecord || unitRecord.type !== type) throw new UnitNotFound();
}
