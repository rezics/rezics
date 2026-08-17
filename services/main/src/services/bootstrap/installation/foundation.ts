import { and, eq } from "drizzle-orm";

import type { DatabaseTransaction } from "../../database";
import { unit, unitSlugAddress } from "../../database/schema";
import { insertUnitIfMissing } from "../../units/create";
import { recordUnitRevision } from "../../units/history";
import { SlugNamespaceManifest } from "../data";
import { assertFields, bootstrapEpoch } from "./common";

export async function ensureSlugNamespaces(tx: DatabaseTransaction): Promise<void> {
	const createdAt = bootstrapEpoch();
	for (const namespace of SlugNamespaceManifest) {
		const created = await insertUnitIfMissing(tx, {
			id: namespace.id,
			kind: "slug_namespace",
			status: "published",
			visibility: "public",
			publishedAt: createdAt,
			createdAt,
			updatedAt: createdAt,
			statusActor: { kind: "system" },
		});
		const [stored] = await tx
			.select({
				id: unit.id,
				kind: unit.kind,
			})
			.from(unit)
			.where(eq(unit.id, namespace.id))
			.limit(1);
		assertFields(`slug namespace ${namespace.id}`, stored, {
			id: namespace.id,
			kind: "slug_namespace",
		});
		const [canonicalAddress] = await tx
			.select({ id: unitSlugAddress.id })
			.from(unitSlugAddress)
			.where(
				and(eq(unitSlugAddress.kind, "canonical"), eq(unitSlugAddress.targetUnitId, namespace.id)),
			)
			.limit(1);
		if (!canonicalAddress)
			await tx.insert(unitSlugAddress).values({
				kind: "canonical",
				scopeUnitId: null,
				slug: namespace.slug,
				targetUnitId: namespace.id,
				createdAt,
				updatedAt: createdAt,
			});
		if (created)
			await recordUnitRevision(tx, {
				unitId: namespace.id,
				actorProfileId: null,
				event: "create",
			});
	}
}
