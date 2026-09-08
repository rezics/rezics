import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { UnitReferenceSchema, CatalogReferenceSchema } from "@rezics/reference";
import type { DatabaseTransaction } from "../database";
import { catalogUnitLocator } from "../database/schema/catalog-identity";
import { unitOwnerTable } from "../database/schema/unit-reference-columns";
import { CatalogNameTables } from "../database/schema/catalog-names";
import { unit, unitLocalization } from "../database/schema/unit";
import { getUnitReadCondition } from "../authorization/unit/query";
import { loadCatalogIdentity } from "../catalog/storage";
import { catalogReadRatingPredicate } from "../catalog/read-policy";

export class UnitReferenceUnavailable extends Error {}

/** Resolve one routing record and prove its concrete owner key; a missing locator never causes an owner scan. @internal */
export async function resolveRegisteredUnitReference(tx: DatabaseTransaction, id: string) {
	z.uuid().parse(id);
	const [route] = await tx
		.select()
		.from(catalogUnitLocator)
		.where(eq(catalogUnitLocator.id, id))
		.limit(1)
		.for("key share");
	if (!route) throw new UnitReferenceUnavailable("Unit routing is unavailable");
	const reference = UnitReferenceSchema.parse({ owner: route.owner, id });
	const table = unitOwnerTable(reference.owner);
	const [target] = await tx
		.select({ id: table.id })
		.from(table)
		.where(eq(table.id, id))
		.limit(1)
		.for("key share");
	if (!target) throw new UnitReferenceUnavailable("Unit routing has no concrete owner");
	return { reference, generation: route.generation };
}

/** Native catalog and retained platform presentation remain separate owner reads. @internal */
export async function readRegisteredUnitPreview(
	tx: DatabaseTransaction,
	id: string,
	actor: { authUserId: string; selfEntityId: string },
) {
	const routed = await resolveRegisteredUnitReference(tx, id);
	const catalog = CatalogReferenceSchema.safeParse(routed.reference);
	if (catalog.success) {
		const identity = await loadCatalogIdentity(tx, catalog.data, actor.authUserId, false);
		if (identity.routingGeneration !== routed.generation)
			throw new UnitReferenceUnavailable("Unit routing generation is stale");
		const names = CatalogNameTables[catalog.data.owner].name;
		const [name] = await tx
			.select({ title: names.value, language: names.languageTag })
			.from(names)
			.where(
				and(
					eq(names.ownerId, id),
					eq(names.state, "active"),
					eq(names.spoiler, 0),
					isNull(names.scopeOwnerId),
				),
			)
			.orderBy(names.id)
			.limit(1);
		return {
			reference: routed.reference,
			title: name?.title ?? null,
			summary: null,
			language: name?.language ?? null,
		};
	}
	// The retained owner's lifecycle moves together with that owner's root writer during the parent cutover.
	const [target] = await tx
		.select({ id: unit.id })
		.from(unit)
		.where(
			and(
				eq(unit.id, id),
				getUnitReadCondition(actor.selfEntityId),
				catalogReadRatingPredicate(unit.contentRating),
			),
		)
		.limit(1)
		.for("share");
	if (!target || routed.generation !== 1)
		throw new UnitReferenceUnavailable("Unit target is unavailable");
	const [text] = await tx
		.select({
			title: unitLocalization.title,
			summary: unitLocalization.summary,
			language: unitLocalization.language,
		})
		.from(unitLocalization)
		.where(eq(unitLocalization.unitId, id))
		.orderBy(unitLocalization.position, unitLocalization.language)
		.limit(1);
	return {
		reference: routed.reference,
		title: text?.title ?? null,
		summary: text?.summary ?? null,
		language: text?.language ?? null,
	};
}
