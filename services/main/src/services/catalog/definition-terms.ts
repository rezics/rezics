import { eq, gt, and } from "drizzle-orm";
import { z } from "zod";
import type { DatabaseTransaction } from "../database";
import {
	catalogDefinitionTerm,
	catalogDefinitionTermSupport,
} from "../database/schema/catalog-definition-terms";
import { assertCatalogDefinitionRevision } from "./definitions";
import { loadCatalogIdentity } from "./storage";
import {
	requireCatalogSourceReferenceEvidence,
	type CatalogSourceReferenceEvidence,
} from "./source-observations";

/** @alpha Link an exact governed class/vocabulary meaning to a native concept; a changed meaning needs a new definition revision. */
export async function attachCatalogDefinitionTerm(
	tx: DatabaseTransaction,
	actor: string,
	input: {
		definitionRevisionId: string;
		conceptId: string;
		evidence?: CatalogSourceReferenceEvidence;
	},
) {
	const definitionRevisionId = z.uuid().parse(input.definitionRevisionId);
	const conceptId = z.uuid().parse(input.conceptId);
	await assertCatalogDefinitionRevision(tx, definitionRevisionId, ["class", "vocabulary"]);
	const identity = await loadCatalogIdentity(
		tx,
		{ owner: "reference", id: conceptId },
		actor,
		true,
		"share",
	);
	if (identity.shape !== "concept")
		throw new TypeError("Definition term requires a native concept");
	await tx
		.insert(catalogDefinitionTerm)
		.values({ definitionRevisionId, conceptId })
		.onConflictDoNothing();
	const [linked] = await tx
		.select()
		.from(catalogDefinitionTerm)
		.where(eq(catalogDefinitionTerm.definitionRevisionId, definitionRevisionId))
		.limit(1);
	if (!linked || linked.conceptId !== conceptId)
		throw new TypeError("Definition meaning already designates another native concept");
	if (input.evidence) {
		const evidence = requireCatalogSourceReferenceEvidence(input.evidence);
		await tx
			.insert(catalogDefinitionTermSupport)
			.values({
				definitionRevisionId,
				sourceRecordId: evidence.sourceRecordId,
				snapshotId: evidence.snapshotId,
				sourcePath: evidence.path,
			})
			.onConflictDoNothing();
	}
	return linked;
}

/** @alpha Resolve a governed meaning to its named native concept using one indexed lookup. */
export async function readCatalogDefinitionTerm(
	tx: DatabaseTransaction,
	actor: string,
	definitionRevisionId: string,
) {
	z.uuid().parse(definitionRevisionId);
	const [row] = await tx
		.select()
		.from(catalogDefinitionTerm)
		.where(eq(catalogDefinitionTerm.definitionRevisionId, definitionRevisionId))
		.limit(1);
	if (!row) return null;
	await loadCatalogIdentity(tx, { owner: "reference", id: row.conceptId }, actor, false);
	return row;
}

/** @alpha List exact meanings represented by a concept; names, hierarchy and source-independent export stay on that concept. */
export async function listCatalogConceptDefinitions(
	tx: DatabaseTransaction,
	actor: string,
	conceptId: string,
	input: { after?: string; limit?: number } = {},
) {
	z.uuid().parse(conceptId);
	const query = z
		.strictObject({
			after: z.uuid().optional(),
			limit: z.number().int().min(1).max(128).default(64),
		})
		.parse(input);
	const identity = await loadCatalogIdentity(
		tx,
		{ owner: "reference", id: conceptId },
		actor,
		false,
	);
	if (identity.shape !== "concept") throw new TypeError("Expected native concept");
	return tx
		.select()
		.from(catalogDefinitionTerm)
		.where(
			and(
				eq(catalogDefinitionTerm.conceptId, conceptId),
				query.after ? gt(catalogDefinitionTerm.definitionRevisionId, query.after) : undefined,
			),
		)
		.orderBy(catalogDefinitionTerm.definitionRevisionId)
		.limit(query.limit);
}
