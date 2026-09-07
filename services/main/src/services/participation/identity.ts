import { z } from "zod";
import type { DatabaseTransaction } from "../database";
import { createCatalogIdentity } from "../catalog/storage";
import { CatalogNameValuesSchema } from "../catalog/name-contracts";
import { CatalogNameTables } from "../database/schema/catalog-names";
import { entityCatalogProfile } from "../database/schema/catalog-entity";
import { entityParticipation } from "../database/schema/participation";
import {
	entityPresentation,
	entityPresentationRevision,
} from "../database/schema/entity-presentation";

/**
 * Creates a newly admitted participant and its first public presentation atomically.
 * Callers prove account/signup or managed-identity authority before invoking this constructor.
 * It never converts a cataloged Entity into a controlled identity.
 * @internal
 */
export async function createParticipantIdentity(
	tx: DatabaseTransaction,
	input: {
		id?: string;
		shape: "person" | "organization" | "service_actor";
		operatorAuthUserId: string;
		names: readonly { language: string | null; value: string }[];
	},
) {
	if (input.names.length > 32)
		throw new Error("Participant creation supports at most 32 named presentations");
	const values = input.names.map((name) =>
		CatalogNameValuesSchema.parse({
			kind: "display",
			languageTag: name.language,
			value: z.string().trim().min(1).max(120).parse(name.value),
			primaryForLanguage: true,
		}),
	);
	if (new Set(values.map((value) => value.languageTag)).size !== values.length)
		throw new Error("Duplicate presentation language");
	const identity = await createCatalogIdentity(
		tx,
		{
			owner: "entity",
			id: input.id,
			shape: input.shape,
			status: "published",
			visibility: "public",
		},
		input.operatorAuthUserId,
	);
	await tx.insert(entityCatalogProfile).values({ id: identity.id, identityShape: input.shape });
	await tx.insert(entityParticipation).values({ entityId: identity.id });
	for (const value of values) {
		const [name] = await tx
			.insert(CatalogNameTables.entity.name)
			.values({ ...value, ownerId: identity.id, recordedByAuthUserId: input.operatorAuthUserId })
			.returning({ id: CatalogNameTables.entity.name.id });
		if (!name) throw new Error("Initial participant name insertion failed");
		if (value.languageTag === null) continue;
		const [presentation] = await tx
			.insert(entityPresentation)
			.values({
				entityId: identity.id,
				language: value.languageTag,
				nameId: name.id,
				nameRevision: 1,
			})
			.returning();
		if (!presentation) throw new Error("Initial participant presentation insertion failed");
		await tx
			.insert(entityPresentationRevision)
			.values({
				entityId: identity.id,
				language: value.languageTag,
				revision: 1,
				snapshot: presentation,
				operatorAuthUserId: input.operatorAuthUserId,
			});
	}
	return identity;
}
