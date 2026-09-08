import { z } from "zod";
import type { DatabaseTransaction } from "../database";
import { CatalogFactTables } from "../database/schema/catalog-facts";
import type { CatalogReference } from "./contracts";
import { appendCatalogFactNodes, beginCatalogFact, sealCatalogFact } from "./storage";
import { catalogValueNodes } from "./value-nodes";

/** A governed scalar and its exact source support commit together through the native semantic writer. @internal */
export async function writeCatalogSourceScalar(
	tx: DatabaseTransaction,
	reference: CatalogReference,
	actor: string,
	expectedRevision: number,
	input: {
		definitionRevisionId: string;
		purpose?: "assertion" | "qualifier";
		value: string | number | boolean | null;
		sourceRecordId: string;
		snapshotId: string;
		sourcePath: string;
		semanticId?: string;
		expectedHeadVersion?: number;
	},
) {
	const value = z
		.strictObject({
			definitionRevisionId: z.uuid(),
			purpose: z.enum(["assertion", "qualifier"]).default("assertion"),
			value: z.union([z.string(), z.number().finite(), z.boolean(), z.null()]),
			sourceRecordId: z.uuid(),
			snapshotId: z.uuid(),
			sourcePath: z
				.string()
				.startsWith("/")
				.refine((path) => Buffer.byteLength(path) <= 512),
			semanticId: z.uuid().optional(),
			expectedHeadVersion: z.number().int().min(0).optional(),
		})
		.parse(input);
	const fact = await beginCatalogFact(
		tx,
		reference,
		actor,
		expectedRevision,
		value.definitionRevisionId,
		{ purpose: value.purpose, semanticId: value.semanticId, expectedHeadVersion: value.expectedHeadVersion },
	);
	const appended = await appendCatalogFactNodes(tx, reference, actor, fact.revision, fact.id, -1, [
		...catalogValueNodes(value.value),
	]);
	const sealed = await sealCatalogFact(
		tx,
		reference,
		actor,
		appended.revision,
		fact.id,
		appended.lastNodePosition,
	);
	await tx
		.insert(CatalogFactTables[reference.owner].support)
		.values({
			ownerId: reference.id,
			factId: fact.id,
			sourceRecordId: value.sourceRecordId,
			snapshotId: value.snapshotId,
			sourcePath: value.sourcePath,
		});
	return { id: fact.id, revision: sealed.revision };
}
