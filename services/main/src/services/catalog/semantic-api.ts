import { and, eq, inArray } from "drizzle-orm";
import type { z } from "zod";
import type { DatabaseTransaction } from "../database";
import { readUnitPresentationsInTransaction } from "../units/presentation-reader";
import { CatalogFactTables } from "@rezics/schema/postgres/knowledge/facts";
import { CatalogOwnerValues, type CatalogReference } from "@rezics/schema/contracts/native/catalog";
import { pageCatalogFacts, listCatalogSemanticHistory } from "./semantic-history";
import {
	appendCatalogFactNodes, beginCatalogFact, createCatalogRelation, pageCatalogRelations,
	readCatalogFactNodes, readCatalogParticipants, sealCatalogFact,
} from "./storage";
import {
	WriteCatalogFactSchema, WriteCatalogRelationSchema, CatalogFactSummarySchema,
	CatalogRelationSummarySchema, CatalogSemanticQuerySchema, CatalogNodeQuerySchema,
	CatalogSemanticHistoryQuerySchema,
} from "./semantic-api-contracts";

/** @alpha A complete bounded fact becomes visible only after grammar validation and an atomic semantic head switch. */
export async function writeCatalogApiFact(tx: DatabaseTransaction, reference: CatalogReference, actor: string,
	input: z.input<typeof WriteCatalogFactSchema>) {
	const value = WriteCatalogFactSchema.parse(input);
	const begun = await beginCatalogFact(tx, reference, actor, value.expectedRevision, value.definitionRevisionId, {
		spoiler: value.spoiler,
		...(value.replaces ? { semanticId: value.replaces.semanticId, expectedHeadVersion: value.replaces.headVersion } : {}),
	});
	const appended = await appendCatalogFactNodes(tx, reference, actor, begun.revision, begun.id, -1, value.nodes);
	const sealed = await sealCatalogFact(tx, reference, actor, appended.revision, begun.id, appended.lastNodePosition);
	return { id: begun.id, ...sealed };
}
/** @alpha Relation occurrences own their participants and qualifiers; no pairwise flattening occurs. */
export async function writeCatalogApiRelation(tx: DatabaseTransaction, reference: CatalogReference, actor: string,
	input: z.input<typeof WriteCatalogRelationSchema>, initialSemanticId?: string) {
	const { expectedRevision, replaces, qualifiers: requestedQualifiers, ...value } = WriteCatalogRelationSchema.parse(input);
	let revision = expectedRevision;
	const qualifiers: { definitionRevisionId: string; valueFactId: string }[] = [];
	for (const qualifier of requestedQualifiers) {
		if ("valueFactId" in qualifier) { qualifiers.push(qualifier); continue; }
		const begun = await beginCatalogFact(tx, reference, actor, revision, qualifier.definitionRevisionId, { purpose: "qualifier", spoiler: value.spoiler });
		const appended = await appendCatalogFactNodes(tx, reference, actor, begun.revision, begun.id, -1, qualifier.nodes);
		const sealed = await sealCatalogFact(tx, reference, actor, appended.revision, begun.id, appended.lastNodePosition);
		revision = sealed.revision;
		qualifiers.push({ definitionRevisionId: qualifier.definitionRevisionId, valueFactId: begun.id });
	}
	return createCatalogRelation(tx, reference, actor, revision, {
		...value,
		qualifiers,
		...(initialSemanticId ? { initialSemanticId } : {}),
		...(replaces ? { semanticId: replaces.semanticId, expectedHeadVersion: replaces.headVersion } : {}),
	});
}

async function heads(tx: DatabaseTransaction, reference: CatalogReference, items: readonly { semanticId: string }[]) {
	if (!items.length) return new Map<string, number>();
	const table = CatalogFactTables[reference.owner].semanticHead;
	const rows = await tx.select({ id: table.semanticId, version: table.version }).from(table)
		.where(and(eq(table.ownerId, reference.id), inArray(table.semanticId, items.map(item => item.semanticId)))).limit(100);
	return new Map(rows.map(row => [row.id, row.version]));
}

/** @alpha Candidate cursors advance over historical and hidden rows without scanning an owner's full history. */
export async function pageCatalogApiFacts(tx: DatabaseTransaction, reference: CatalogReference, actor: string | null,
	input: z.input<typeof CatalogSemanticQuerySchema>) {
	const query = CatalogSemanticQuerySchema.parse(input);
	const page = await pageCatalogFacts(tx, reference, actor, { ...query, includeInactive: query.includeInactive === "true" });
	const versions = await heads(tx, reference, page.items);
	return { afterId: page.afterId, items: page.items.map(row => CatalogFactSummarySchema.parse({
		id: row.id, semanticId: row.semanticId, definitionRevisionId: row.definitionRevisionId,
		spoiler: row.spoiler, state: row.state, headVersion: versions.get(row.semanticId), lastNodePosition: row.lastNodePosition,
	})) };
}
export async function pageCatalogApiRelations(tx: DatabaseTransaction, reference: CatalogReference, actor: string | null,
	input: z.input<typeof CatalogSemanticQuerySchema>) {
	const query = CatalogSemanticQuerySchema.parse(input);
	const page = await pageCatalogRelations(tx, reference, actor, { ...query, includeInactive: query.includeInactive === "true" });
	const versions = await heads(tx, reference, page.items);
	return { afterId: page.afterId, items: page.items.map(row => CatalogRelationSummarySchema.parse({
		id: row.id, semanticId: row.semanticId, definitionRevisionId: row.definitionRevisionId,
		spoiler: row.spoiler, state: row.state, headVersion: versions.get(row.semanticId),
	})) };
}
export async function pageCatalogApiFactNodes(tx: DatabaseTransaction, reference: CatalogReference, actor: string | null,
	factId: string, input: z.input<typeof CatalogNodeQuerySchema>) {
	const q = CatalogNodeQuerySchema.parse(input);
	const rows = await readCatalogFactNodes(tx, reference, actor, factId, q.afterPosition, q.limit, q.maxSpoiler, q.relationId);
	return { items: rows.map(({ position, parentPosition, parentKind, memberKey, kind, textValue, numberValue, booleanValue, rulePosition }) =>
		({ position, parentPosition, parentKind, memberKey, kind, textValue, numberValue, booleanValue, rulePosition })),
		afterPosition: rows.length === q.limit ? (rows.at(-1)?.position ?? null) : null };
}
export async function pageCatalogApiParticipants(tx: DatabaseTransaction, reference: CatalogReference, actor: string | null,
	relationId: string, input: z.input<typeof CatalogNodeQuerySchema>) {
	const q = CatalogNodeQuerySchema.parse(input);
	const rows = await readCatalogParticipants(tx, reference, relationId, actor, q.afterPosition, q.limit, q.maxSpoiler);
	const participants = rows.map(row => {
		const targets = { publishing: row.publishingId, music: row.musicId, program: row.programId, software: row.softwareId,
			entity: row.entityId, grouping: row.groupingId, reference: row.referenceId, distribution: row.distributionId };
		const refs = CatalogOwnerValues.flatMap(owner => targets[owner] ? [{ owner, id: targets[owner] }] : []);
		const target = refs[0];
		if (refs.length !== 1 || !target) throw new TypeError("Relation participant requires exactly one concrete target");
		return { position: row.position, roleRevisionId: row.roleRevisionId, target, creditedAs: row.creditedAs };
	});
	// readCatalogParticipants has already checked the entire relation's participant privacy.
	const previews = await readUnitPresentationsInTransaction(tx, participants.map(row => row.target.id), q.languageTag ? [q.languageTag] : []);
	return { items: participants.map(row => {
		const preview = previews.get(row.target.id);
		if (preview && preview.owner !== row.target.owner) throw new TypeError("Participant presentation belongs to another native owner");
		return { ...row, targetPreview: preview ? { shape: preview.shape, title: preview.title } : null };
	}), afterPosition: rows.length === q.limit ? (rows.at(-1)?.position ?? null) : null };
}
export async function pageCatalogApiSemanticHistory(tx: DatabaseTransaction, reference: CatalogReference, actor: string | null,
	semanticId: string, input: z.input<typeof CatalogSemanticHistoryQuerySchema>) {
	const q = CatalogSemanticHistoryQuerySchema.parse(input);
	const rows = await listCatalogSemanticHistory(tx, reference, actor, semanticId, q.afterVersion, q.limit);
	return { items: rows.map(row => ({ version: row.version, factId: row.factId, relationId: row.relationId, definitionRevisionId: row.definitionRevisionId,
		state: row.state, createdAt: row.createdAt.toISOString() })),
		afterVersion: rows.length === q.limit ? (rows.at(-1)?.version ?? null) : null };
}
