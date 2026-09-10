import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { CatalogOwnerValues } from "@rezics/reference";
import type { DatabaseTransaction } from "../database";
import {
	revisionReference,
	revisionReferenceFields,
	revisionReferenceValues,
	revisionReferenceTargetColumns,
} from "../database/schema/revision-reference";
import {
	CatalogRevisionReferenceSchema,
	RevisionReferenceKindValues,
	type CatalogRevisionReference,
} from "./revision-reference-contract";
import { allocateImmutableReference } from "./immutable-reference";

/**
 * Allocate an exact value inside an already authorized command; this proves no disclosure right.
 * @remarks Complete history keys are the authority. No identity bridge allocation
 * or independently writable cached parent is involved. Callers own deadlines,
 * authority fences and whole-transaction serialization retries.
 * @internal
 */
export async function allocateRevisionReference(
	tx: DatabaseTransaction,
	input: CatalogRevisionReference,
): Promise<string> {
	const target = CatalogRevisionReferenceSchema.parse(input);
	const keys = revisionReferenceTargetColumns(target.owner, target.kind, revisionReference);
	return allocateImmutableReference(
		async () => {
			const [row] = await tx
				.select({ id: revisionReference.id })
				.from(revisionReference)
				.where(
					and(
						eq(keys[0], target.ownerId),
						eq(keys[1], target.itemId),
						eq(keys[2], target.revision),
					),
				)
				.limit(1);
			return row?.id;
		},
		async () => {
			const [row] = await tx
				.insert(revisionReference)
				.values(revisionReferenceValues(target))
				.onConflictDoNothing({ target: [...keys], where: sql`${keys[0]} is not null` })
				.returning({ id: revisionReference.id });
			return row?.id;
		},
	);
}

/** Decode one complete exact key; the consumer checks access to its target revision. @internal */
export async function resolveRevisionReference(
	tx: DatabaseTransaction,
	id: string,
): Promise<CatalogRevisionReference | null> {
	z.uuid().parse(id);
	const [row] = await tx
		.select()
		.from(revisionReference)
		.where(eq(revisionReference.id, id))
		.limit(1);
	if (!row) return null;
	const targets = CatalogOwnerValues.flatMap((owner) =>
		RevisionReferenceKindValues.flatMap((kind) => {
			const fields = revisionReferenceFields(owner, kind);
			return row[fields.ownerId] === null
				? []
				: [
						{
							owner,
							kind,
							ownerId: row[fields.ownerId],
							itemId: row[fields.itemId],
							revision: row[fields.revision],
						},
					];
		}),
	);
	if (targets.length !== 1) throw new Error("Revision reference has no single complete target");
	return CatalogRevisionReferenceSchema.parse(targets[0]);
}
