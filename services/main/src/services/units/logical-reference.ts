import { eq } from "drizzle-orm";
import { z } from "zod";
import { UnitReferenceSchema } from "@rezics/reference";
import { LogicalReferenceSchema } from "@rezics/schema";
import {
	descriptionObject,
	wikiPage,
	mediaItem,
	schemaTerm,
	schemaRelation,
	referenceValue,
} from "@rezics/schema/postgres";
import type { DatabaseTransaction } from "../database";
import { allocateReferenceValue } from "./reference-value";

const targets = {
	description: { table: descriptionObject, column: referenceValue.targetDescriptionId },
	wiki: { table: wikiPage, column: referenceValue.targetWikiId },
	indexed_media: { table: mediaItem, column: referenceValue.targetIndexedMediaId },
	vocabulary_term: { table: schemaTerm, column: referenceValue.targetVocabularyTermId },
	semantic_relation: { table: schemaRelation, column: referenceValue.targetSemanticRelationId },
} as const;

/** @alpha Allocate a concrete, restrictive reference only when a cross-domain feature needs one. */
export async function allocateLogicalReference(
	tx: DatabaseTransaction,
	input: z.input<typeof LogicalReferenceSchema>,
) {
	const reference = LogicalReferenceSchema.parse(input);
	if (reference.revisionId)
		throw new TypeError("An identity reference cannot discard an exact revision");
	const unit = UnitReferenceSchema.safeParse(reference);
	if (unit.success) return allocateReferenceValue(tx, unit.data);
	const owner = z
			.enum(["description", "wiki", "indexed_media", "vocabulary_term", "semantic_relation"])
			.parse(reference.owner),
		target = targets[owner];
	const [exists] = await tx
		.select({ id: target.table.id })
		.from(target.table)
		.where(eq(target.table.id, reference.id))
		.for("key share");
	if (!exists) throw new TypeError("Logical target does not exist");
	const columns = {
		description: "targetDescriptionId",
		wiki: "targetWikiId",
		indexed_media: "targetIndexedMediaId",
		vocabulary_term: "targetVocabularyTermId",
		semantic_relation: "targetSemanticRelationId",
	} as const;
	await tx
		.insert(referenceValue)
		.values({ [columns[owner]]: reference.id })
		.onConflictDoNothing();
	const [row] = await tx
		.select({ id: referenceValue.id })
		.from(referenceValue)
		.where(eq(target.column, reference.id))
		.limit(1);
	if (!row) throw new TypeError("Logical target reference was not allocated");
	return row.id;
}

/** @alpha Resolve identity only. A capability/access check is still required by the consuming operation. */
export async function resolveExtendedLogicalReference(tx: DatabaseTransaction, id: string) {
	z.uuid().parse(id);
	const [row] = await tx.select().from(referenceValue).where(eq(referenceValue.id, id)).limit(1);
	if (!row) throw new TypeError("Reference does not exist");
	for (const [owner, key] of Object.entries({
		description: "targetDescriptionId",
		wiki: "targetWikiId",
		indexed_media: "targetIndexedMediaId",
		vocabulary_term: "targetVocabularyTermId",
		semantic_relation: "targetSemanticRelationId",
	} as const)) {
		const value = row[key];
		if (value) return { owner, id: value };
	}
	return null;
}
