import { createHash } from "node:crypto";
import { and, eq, inArray, isNotNull, or, sql } from "drizzle-orm";
import { z } from "zod";
import type { DatabaseTransaction } from "../database";
import { CatalogFactTables } from "@rezics/schema/postgres/knowledge/facts";
import { catalogDefinition, catalogDefinitionRevision } from "@rezics/schema/postgres/catalog/identity";
import { canAccessCatalog } from "../participation/policy";
import type { CatalogReference } from "@rezics/schema/contracts/native/catalog";
import { assertReadableTargets, CatalogRevisionConflict, ensureCatalogDefinition, loadCatalogIdentity, readableRelation } from "./storage";
import { writeCatalogApiRelation } from "./semantic-api";
import { catalogValueNodes } from "./value-nodes";
import { EntityMeasurementContextSchema, EntityMeasurementContextWriteSchema,
	EntityMeasurementValuesSchema, type EntityContextMeasurement, type EntityMeasurementContext,
	type EntityMeasurementValues } from "./entity-measurement-contracts";

const namespace = "catalog.character.measurement";
const fields = [
	{ key: "heightMillimetres", unit: "mm" }, { key: "weightGrams", unit: "g" },
	{ key: "bustMillimetres", unit: "mm" }, { key: "waistMillimetres", unit: "mm" },
	{ key: "hipsMillimetres", unit: "mm" },
] as const;
const contextTargets = [
	{ owner: "publishing" as const, shapes: ["work", "text_version", "publication", "serialization"] },
	{ owner: "program" as const, shapes: ["program", "season", "program_version", "episode"] },
	{ owner: "software" as const, shapes: ["content", "version", "release"] },
	{ owner: "music" as const, shapes: ["work", "recording", "release_group", "release"] },
];
const emptyValues = (): EntityMeasurementValues => ({
	heightMillimetres: null, weightGrams: null, bustMillimetres: null, waistMillimetres: null, hipsMillimetres: null,
});

/** @internal Exact native semantic key keeps a context lookup independent of all other contexts and revisions. */
export function entityMeasurementSemanticId(entityId: string, context: EntityMeasurementContext) {
	z.uuid().parse(entityId);
	const reference = EntityMeasurementContextSchema.parse(context);
	const hash = createHash("sha256").update(`rezics.character.measurement.context\n${entityId}\n${reference.owner}\n${reference.id}`).digest("hex");
	return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-8${hash.slice(13, 16)}-8${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}

async function measurementDefinitions(tx: DatabaseTransaction) {
	const subject = await ensureCatalogDefinition(tx, { namespace, key: "subject", kind: "role", valueKind: null,
		constraints: { targets: [{ owner: "entity", shapes: ["character"] }] } });
	const context = await ensureCatalogDefinition(tx, { namespace, key: "context", kind: "role", valueKind: null,
		constraints: { targets: contextTargets } });
	const properties = [];
	for (const field of fields) {
		const property = await ensureCatalogDefinition(tx, { namespace, key: field.key, kind: "property", valueKind: "number",
			constraints: { integer: true, nullable: true, minimum: 0, maximum: Number.MAX_SAFE_INTEGER, unit: field.unit } });
		properties.push({ ...field, revisionId: property.revisionId });
	}
	const predicate = await ensureCatalogDefinition(tx, { namespace, key: "in-context", kind: "predicate", valueKind: null,
		constraints: { roles: [
			{ roleRevisionId: subject.revisionId, min: 1, max: 1, targets: [{ owner: "entity", shapes: ["character"] }] },
			{ roleRevisionId: context.revisionId, min: 1, max: 1, targets: contextTargets },
		], qualifierRevisionIds: properties.map(property => property.revisionId) } });
	return { subject: subject.revisionId, context: context.revisionId, predicate: predicate.revisionId, properties };
}

/** @alpha One atomic contextual measurement; zero and unknown remain distinct and globals are never overwritten. */
export async function writeEntityContextMeasurement(tx: DatabaseTransaction, entityId: string, actor: string,
	input: z.input<typeof EntityMeasurementContextWriteSchema>) {
	const value = EntityMeasurementContextWriteSchema.parse(input), reference = { owner: "entity" as const, id: z.uuid().parse(entityId) };
	const identity = await loadCatalogIdentity(tx, reference, actor, true);
	if (identity.shape !== "character") throw new TypeError("Contextual character measurements require a character Entity");
	if (identity.revision !== value.expectedRevision) throw new CatalogRevisionConflict();
	await loadCatalogIdentity(tx, value.context, actor, false);
	const semanticId = entityMeasurementSemanticId(entityId, value.context), head = CatalogFactTables.entity.semanticHead;
	const [current] = await tx.select({ version: head.version }).from(head)
		.where(and(eq(head.ownerId, entityId), eq(head.semanticId, semanticId))).limit(1).for("update");
	if ((current?.version ?? 0) !== value.expectedHeadVersion) throw new CatalogRevisionConflict("Context measurement head changed");
	const definitions = await measurementDefinitions(tx);
	return writeCatalogApiRelation(tx, reference, actor, {
		expectedRevision: value.expectedRevision, definitionRevisionId: definitions.predicate, spoiler: value.spoiler,
		...(current ? { replaces: { semanticId, headVersion: current.version } } : {}),
		participants: [
			{ roleRevisionId: definitions.subject, target: reference },
			{ roleRevisionId: definitions.context, target: value.context },
		],
		qualifiers: definitions.properties.map(property => ({
			definitionRevisionId: property.revisionId, nodes: [...catalogValueNodes(value.values[property.key])],
		})),
	}, current ? undefined : semanticId);
}

/** @internal Batched exact heads and checked relation bindings; at most eight card Entities, without per-card queries. */
export async function readEntityContextMeasurements(tx: DatabaseTransaction, entityIds: readonly string[], actor: string | null,
	contextInput: EntityMeasurementContext, maxSpoiler: 0 | 1 | 2 = 0): Promise<ReadonlyMap<string, EntityContextMeasurement>> {
	const ids = z.array(z.uuid()).max(8).parse([...new Set(entityIds)]), context = EntityMeasurementContextSchema.parse(contextInput);
	z.number().int().min(0).max(2).parse(maxSpoiler);
	const output = new Map<string, EntityContextMeasurement>();
	if (!ids.length) return output;
	await assertReadableTargets(tx, [...ids.map(id => ({ owner: "entity" as const, id })), context], actor);
	const tables = CatalogFactTables.entity, h = tables.semanticHead, r = tables.semanticRevision, relation = tables.relation;
	const rows = await tx.select({ ownerId: h.ownerId, semanticId: h.semanticId, headVersion: h.version,
		relationId: relation.id, spoiler: relation.spoiler }).from(h)
		.innerJoin(r, and(eq(r.ownerId, h.ownerId), eq(r.semanticId, h.semanticId), eq(r.version, h.version)))
		.innerJoin(relation, and(eq(relation.ownerId, r.ownerId), eq(relation.id, r.relationId)))
		.innerJoin(catalogDefinitionRevision, eq(catalogDefinitionRevision.id, relation.definitionRevisionId))
		.innerJoin(catalogDefinition, eq(catalogDefinition.id, catalogDefinitionRevision.definitionId))
		.where(and(or(...ids.map(id => and(eq(h.ownerId, id), eq(h.semanticId, entityMeasurementSemanticId(id, context))))),
			eq(r.state, "active"), eq(catalogDefinition.namespace, namespace), eq(catalogDefinition.key, "in-context"),
			await readableRelation(tx, { owner: "entity", id: ids[0]! }, actor, maxSpoiler)))
		.limit(8);
	if (!rows.length) return output;
	const relationIds = rows.map(row => row.relationId), p = tables.participant;
	const participants = await tx.select({ ownerId: p.ownerId, relationId: p.relationId,
		role: catalogDefinition.key, namespace: catalogDefinition.namespace,
		entityId: p.entityId, publishingId: p.publishingId, programId: p.programId, softwareId: p.softwareId, musicId: p.musicId })
		.from(p).innerJoin(catalogDefinitionRevision, eq(catalogDefinitionRevision.id, p.roleRevisionId))
		.innerJoin(catalogDefinition, eq(catalogDefinition.id, catalogDefinitionRevision.definitionId))
		.where(and(inArray(p.ownerId, ids), inArray(p.relationId, relationIds))).limit(8 * 128);
	const q = tables.relationScope, fact = tables.fact, node = tables.valueNode;
	const values = await tx.select({ ownerId: q.ownerId, relationId: q.relationId,
		key: catalogDefinition.key, constraints: catalogDefinitionRevision.constraints,
		kind: node.kind, numberValue: node.numberValue }).from(q)
		.innerJoin(fact, and(eq(fact.ownerId, q.ownerId), eq(fact.id, q.valueFactId), eq(fact.definitionRevisionId, q.definitionRevisionId)))
		.innerJoin(node, and(eq(node.ownerId, fact.ownerId), eq(node.factId, fact.id), eq(node.position, 0)))
		.innerJoin(catalogDefinitionRevision, eq(catalogDefinitionRevision.id, fact.definitionRevisionId))
		.innerJoin(catalogDefinition, eq(catalogDefinition.id, catalogDefinitionRevision.definitionId))
		.where(and(inArray(q.ownerId, ids), inArray(q.relationId, relationIds), eq(catalogDefinition.namespace, namespace),
			inArray(catalogDefinition.key, fields.map(field => field.key)), eq(catalogDefinitionRevision.valueKind, "number"),
			isNotNull(fact.sealedAt), eq(fact.state, "active"), sql`${fact.spoiler} <= ${maxSpoiler}`)).limit(8 * 64);
	for (const row of rows) {
		if (row.semanticId !== entityMeasurementSemanticId(row.ownerId, context)) continue;
		const members = participants.filter(item => item.ownerId === row.ownerId && item.relationId === row.relationId);
		const contextField = { publishing: "publishingId", program: "programId", software: "softwareId", music: "musicId" } as const;
		if (members.length !== 2 || !members.some(item => item.namespace === namespace && item.role === "subject" && item.entityId === row.ownerId) ||
			!members.some(item => item.namespace === namespace && item.role === "context" && item[contextField[context.owner]] === context.id)) continue;
		const projected = emptyValues();
		for (const field of fields) {
			const candidates = values.filter(item => item.ownerId === row.ownerId && item.relationId === row.relationId && item.key === field.key);
			if (candidates.length !== 1) continue;
			const candidate = candidates[0]!;
			if (candidate.constraints.unit !== field.unit || candidate.constraints.integer !== true) continue;
			if (candidate.kind === "number" && candidate.numberValue !== null) {
				const number = Number(candidate.numberValue);
				if (Number.isSafeInteger(number) && number >= 0) projected[field.key] = number;
			}
		}
		output.set(row.ownerId, { relationId: row.relationId, semanticId: row.semanticId, headVersion: row.headVersion,
			context, spoiler: row.spoiler, values: EntityMeasurementValuesSchema.parse(projected) });
	}
	return output;
}

/** @alpha Current context details and optimistic edit tokens; no history scan or owner-only participant bypass. */
export async function readEntityMeasurementContext(tx: DatabaseTransaction, entityId: string, actor: string | null,
	context: EntityMeasurementContext, maxSpoiler: 0 | 1 | 2 = 0) {
	const reference: CatalogReference = { owner: "entity", id: z.uuid().parse(entityId) };
	const identity = await loadCatalogIdentity(tx, reference, actor, false);
	if (identity.shape !== "character") throw new TypeError("Contextual character measurements require a character Entity");
	const measurements = await readEntityContextMeasurements(tx, [entityId], actor, context, maxSpoiler);
	const canEdit = await canAccessCatalog(tx, reference, actor, identity.createdByAuthUserId, true);
	const measurement = measurements.get(entityId) ?? null;
	let headVersion = measurement?.headVersion ?? 0;
	if (canEdit) {
		const head = CatalogFactTables.entity.semanticHead;
		const [current] = await tx.select({ version: head.version }).from(head)
			.where(and(eq(head.ownerId, entityId), eq(head.semanticId, entityMeasurementSemanticId(entityId, context)))).limit(1);
		headVersion = current?.version ?? 0;
	}
	return { revision: identity.revision, canEdit, headVersion, measurement };
}
