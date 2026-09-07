import { and, asc, eq, gt, inArray, isNull, sql } from "drizzle-orm";
import { canonicalizeContentLanguageTag } from "@rezics/content-language";
import { z } from "zod";
import type { DatabaseTransaction } from "../database";
import {
	CatalogIdentityTables,
	catalogDefinition,
	catalogDefinitionRevision,
	catalogUnitLocator,
} from "../database/schema/catalog-identity";
import { CatalogFactTables } from "../database/schema/catalog-facts";
import {
	CatalogDefinitionInputSchema,
	CatalogIdentityInputSchema,
	CatalogPageSchema,
	CatalogReferenceSchema,
	type CatalogIdentityInput,
	type CatalogReference,
	CatalogOwnerValues,
} from "./contracts";
import { CatalogValueNodeSchema } from "./value-nodes";

export class CatalogAccessDenied extends Error {}
export class CatalogRevisionConflict extends Error {}
export class CatalogReferenceNotFound extends Error {}

export async function loadCatalogIdentity(
	tx: DatabaseTransaction,
	reference: CatalogReference,
	actor: string | null,
	write: boolean,
	/** Scoped child writes may share the authority lock while locking their own current head. */
	writeLock: "update" | "share" = "update",
) {
	if (actor !== null) z.uuid().parse(actor);
	const ref = CatalogReferenceSchema.parse({ owner: reference.owner, id: reference.id });
	const table = CatalogIdentityTables[ref.owner];
	const query = tx
		.select()
		.from(table)
		.where(and(eq(table.id, ref.id), isNull(table.deletedAt)))
		.limit(1);
	const [row] = await (write ? query.for(writeLock) : query);
	if (!row) throw new CatalogReferenceNotFound("Catalog identity is missing or retired");
	const creator = actor !== null && row.createdByAuthUserId === actor;
	if (
		write
			? !creator
			: !creator &&
				(row.visibility === "private" ||
					row.status !== "published" ||
					row.moderationStatus !== "approved")
	)
		throw new CatalogAccessDenied("Catalog actor cannot access this identity");
	return row;
}

export async function recordCatalogChange(
	tx: DatabaseTransaction,
	reference: CatalogReference,
	actor: string,
	expectedVersion: number,
	operation: string,
): Promise<number> {
	const row = await loadCatalogIdentity(tx, reference, actor, true);
	if (row.revision !== expectedVersion)
		throw new CatalogRevisionConflict("Catalog revision changed");
	const table = CatalogIdentityTables[reference.owner];
	const [updated] = await tx
		.update(table)
		.set({ revision: sql`${table.revision} + 1` })
		.where(and(eq(table.id, reference.id), eq(table.revision, expectedVersion)))
		.returning({ revision: table.revision });
	if (!updated) throw new CatalogRevisionConflict("Catalog revision changed");
	await tx.insert(CatalogFactTables[reference.owner].change).values({
		ownerId: reference.id,
		version: updated.revision,
		actorAuthUserId: actor,
		operation,
	});
	return updated.revision;
}

/** Authenticated callers must supply the actual private Auth actor; catalog authors are separate. */
export async function createCatalogIdentity(
	tx: DatabaseTransaction,
	input: CatalogIdentityInput,
	actor: string,
) {
	const { owner, ...values } = CatalogIdentityInputSchema.parse(input);
	z.uuid().parse(actor);
	const table = CatalogIdentityTables[owner];
	const [created] = await tx
		.insert(table)
		.values({ ...values, createdByAuthUserId: actor })
		.returning({ id: table.id, revision: table.revision });
	if (!created) throw new Error("Catalog identity insertion returned no row");
	await tx.insert(CatalogFactTables[owner].change).values({
		ownerId: created.id,
		version: 1,
		actorAuthUserId: actor,
		operation: "identity.create",
	});
	return { owner, id: created.id, revision: created.revision };
}

export async function resolveCatalogIdentity(
	tx: DatabaseTransaction,
	id: string,
	actor: string | null,
) {
	z.uuid().parse(id);
	const [locator] = await tx
		.select()
		.from(catalogUnitLocator)
		.where(eq(catalogUnitLocator.id, id))
		.limit(1);
	if (!locator)
		throw new CatalogReferenceNotFound("Catalog routing is missing; owner repair is required");
	const reference = { owner: locator.owner, id };
	const row = await loadCatalogIdentity(tx, reference, actor, false);
	if (row.routingGeneration !== locator.generation)
		throw new CatalogReferenceNotFound("Catalog routing generation is stale");
	return {
		...reference,
		shape: row.shape,
		status: row.status,
		visibility: row.visibility,
		revision: row.revision,
	};
}

/** Registration is for reviewed definitions; a conflicting meaning cannot be reused silently. */
export async function ensureCatalogDefinition(
	tx: DatabaseTransaction,
	input: z.input<typeof CatalogDefinitionInputSchema>,
) {
	const value = CatalogDefinitionInputSchema.parse(input);
	await tx
		.insert(catalogDefinition)
		.values({ namespace: value.namespace, key: value.key, kind: value.kind })
		.onConflictDoNothing();
	const [definition] = await tx
		.select()
		.from(catalogDefinition)
		.where(
			and(eq(catalogDefinition.namespace, value.namespace), eq(catalogDefinition.key, value.key)),
		)
		.limit(1);
	if (!definition || definition.kind !== value.kind)
		throw new Error("Catalog definition identity has another meaning");
	await tx
		.insert(catalogDefinitionRevision)
		.values({ definitionId: definition.id, version: 1, valueKind: value.valueKind })
		.onConflictDoNothing();
	const [revision] = await tx
		.select()
		.from(catalogDefinitionRevision)
		.where(
			and(
				eq(catalogDefinitionRevision.definitionId, definition.id),
				eq(catalogDefinitionRevision.version, 1),
			),
		)
		.limit(1);
	if (!revision || revision.valueKind !== value.valueKind)
		throw new Error("Catalog definition revision has another value shape");
	return { definitionId: definition.id, revisionId: revision.id };
}

export async function addCatalogName(
	tx: DatabaseTransaction,
	reference: CatalogReference,
	actor: string,
	expectedVersion: number,
	input: { readonly languageTag: string | null; readonly kind: string; readonly value: string },
) {
	const value = z
		.strictObject({
			languageTag: z.string().nullable(),
			kind: z.string().min(1).max(96),
			value: z.string().min(1).max(131_072),
		})
		.parse(input);
	const languageTag =
		value.languageTag === null ? null : canonicalizeContentLanguageTag(value.languageTag);
	const version = await recordCatalogChange(tx, reference, actor, expectedVersion, "name.add");
	const table = CatalogFactTables[reference.owner].name;
	const [created] = await tx
		.insert(table)
		.values({ ownerId: reference.id, ...value, languageTag })
		.returning({ id: table.id });
	if (!created) throw new Error("Catalog name insertion returned no row");
	return { id: created.id, revision: version };
}

export async function listCatalogNames(
	tx: DatabaseTransaction,
	reference: CatalogReference,
	actor: string | null,
	input: z.input<typeof CatalogPageSchema> = {},
) {
	await loadCatalogIdentity(tx, reference, actor, false);
	const page = CatalogPageSchema.parse(input);
	const table = CatalogFactTables[reference.owner].name;
	return tx
		.select()
		.from(table)
		.where(
			and(eq(table.ownerId, reference.id), page.afterId ? gt(table.id, page.afterId) : undefined),
		)
		.orderBy(asc(table.id))
		.limit(page.limit);
}

export async function beginCatalogFact(
	tx: DatabaseTransaction,
	reference: CatalogReference,
	actor: string,
	expectedVersion: number,
	definitionRevisionId: string,
) {
	z.uuid().parse(definitionRevisionId);
	const revision = await recordCatalogChange(tx, reference, actor, expectedVersion, "fact.begin");
	const table = CatalogFactTables[reference.owner].fact;
	const [created] = await tx
		.insert(table)
		.values({ ownerId: reference.id, definitionRevisionId })
		.returning({ id: table.id });
	if (!created) throw new Error("Catalog fact insertion returned no row");
	return { id: created.id, revision, lastNodePosition: -1 };
}

export async function appendCatalogFactNodes(
	tx: DatabaseTransaction,
	reference: CatalogReference,
	actor: string,
	expectedVersion: number,
	factId: string,
	expectedLastPosition: number,
	input: readonly unknown[],
) {
	z.uuid().parse(factId);
	const nodes = z.array(CatalogValueNodeSchema).min(1).max(512).parse(input);
	if (Buffer.byteLength(JSON.stringify(nodes), "utf8") > 512_000)
		throw new RangeError("Catalog value batch exceeds the command byte budget");
	const revision = await recordCatalogChange(tx, reference, actor, expectedVersion, "fact.append");
	const table = CatalogFactTables[reference.owner].fact;
	const [fact] = await tx
		.select()
		.from(table)
		.where(and(eq(table.ownerId, reference.id), eq(table.id, factId)))
		.limit(1)
		.for("update");
	if (!fact || fact.sealedAt || fact.lastNodePosition !== expectedLastPosition)
		throw new CatalogRevisionConflict("Catalog fact append position changed or is sealed");
	for (let i = 0; i < nodes.length; i++)
		if (nodes[i]?.position !== expectedLastPosition + i + 1)
			throw new TypeError("Catalog node batch must extend the exact contiguous prefix");
	await tx
		.insert(CatalogFactTables[reference.owner].valueNode)
		.values(nodes.map((node) => ({ ...node, ownerId: reference.id, factId })));
	const lastNodePosition = expectedLastPosition + nodes.length;
	await tx
		.update(table)
		.set({ lastNodePosition })
		.where(and(eq(table.ownerId, reference.id), eq(table.id, factId)));
	return { revision, lastNodePosition };
}

export async function sealCatalogFact(
	tx: DatabaseTransaction,
	reference: CatalogReference,
	actor: string,
	expectedVersion: number,
	factId: string,
	expectedLastPosition: number,
) {
	const revision = await recordCatalogChange(tx, reference, actor, expectedVersion, "fact.seal");
	const tables = CatalogFactTables[reference.owner];
	const [fact] = await tx
		.select()
		.from(tables.fact)
		.where(and(eq(tables.fact.ownerId, reference.id), eq(tables.fact.id, factId)))
		.limit(1)
		.for("update");
	if (
		!fact ||
		fact.sealedAt ||
		fact.lastNodePosition < 0 ||
		fact.lastNodePosition !== expectedLastPosition
	)
		throw new CatalogRevisionConflict("Catalog fact is not at the expected complete prefix");
	const [root] = await tx
		.select({ kind: tables.valueNode.kind, expectedKind: catalogDefinitionRevision.valueKind })
		.from(tables.valueNode)
		.innerJoin(
			catalogDefinitionRevision,
			eq(catalogDefinitionRevision.id, fact.definitionRevisionId),
		)
		.where(
			and(
				eq(tables.valueNode.ownerId, reference.id),
				eq(tables.valueNode.factId, factId),
				eq(tables.valueNode.position, 0),
			),
		)
		.limit(1);
	if (!root || (root.kind !== "null" && root.kind !== root.expectedKind))
		throw new TypeError("Catalog value root differs from its property definition");
	await tx
		.update(tables.fact)
		.set({ sealedAt: sql`current_timestamp` })
		.where(and(eq(tables.fact.ownerId, reference.id), eq(tables.fact.id, factId)));
	return { revision };
}

export async function readCatalogFactNodes(
	tx: DatabaseTransaction,
	reference: CatalogReference,
	actor: string | null,
	factId: string,
	afterPosition = -1,
	limit = 100,
) {
	await loadCatalogIdentity(tx, reference, actor, false);
	z.uuid().parse(factId);
	z.number().int().min(-1).max(Number.MAX_SAFE_INTEGER).parse(afterPosition);
	z.number().int().min(1).max(512).parse(limit);
	const tables = CatalogFactTables[reference.owner];
	const [fact] = await tx
		.select()
		.from(tables.fact)
		.where(and(eq(tables.fact.id, factId), eq(tables.fact.ownerId, reference.id)))
		.limit(1);
	if (!fact?.sealedAt || !["active", "disputed"].includes(fact.state))
		throw new CatalogReferenceNotFound("Catalog fact is missing, withdrawn or not sealed");
	return tx
		.select()
		.from(tables.valueNode)
		.where(
			and(
				eq(tables.valueNode.ownerId, reference.id),
				eq(tables.valueNode.factId, factId),
				gt(tables.valueNode.position, afterPosition),
			),
		)
		.orderBy(tables.valueNode.position)
		.limit(limit);
}

export async function createCatalogRelation(
	tx: DatabaseTransaction,
	reference: CatalogReference,
	actor: string,
	expectedVersion: number,
	input: {
		readonly definitionRevisionId: string;
		readonly participants: readonly {
			readonly roleRevisionId: string;
			readonly target: CatalogReference;
			readonly creditedAs?: string;
		}[];
	},
) {
	const value = z
		.strictObject({
			definitionRevisionId: z.uuid(),
			participants: z
				.array(
					z.strictObject({
						roleRevisionId: z.uuid(),
						target: CatalogReferenceSchema,
						creditedAs: z.string().max(131_072).optional(),
					}),
				)
				.min(1)
				.max(128),
		})
		.parse({
			...input,
			participants: input.participants.map((participant) => ({
				...participant,
				target: { owner: participant.target.owner, id: participant.target.id },
			})),
		});
	const revision = await recordCatalogChange(
		tx,
		reference,
		actor,
		expectedVersion,
		"relation.create",
	);
	await assertReadableTargets(
		tx,
		value.participants.map(({ target }) => target),
		actor,
	);
	const tables = CatalogFactTables[reference.owner];
	const [relation] = await tx
		.insert(tables.relation)
		.values({ ownerId: reference.id, definitionRevisionId: value.definitionRevisionId })
		.returning({ id: tables.relation.id });
	if (!relation) throw new Error("Catalog relation insertion returned no row");
	await tx.insert(tables.participant).values(
		value.participants.map((participant, position) => ({
			ownerId: reference.id,
			relationId: relation.id,
			roleRevisionId: participant.roleRevisionId,
			position,
			creditedAs: participant.creditedAs ?? null,
			...participantTargetColumns(participant.target),
		})),
	);
	return { id: relation.id, revision };
}

function participantTargetColumns(reference: CatalogReference) {
	return {
		publishingId: reference.owner === "publishing" ? reference.id : null,
		musicId: reference.owner === "music" ? reference.id : null,
		programId: reference.owner === "program" ? reference.id : null,
		softwareId: reference.owner === "software" ? reference.id : null,
		entityId: reference.owner === "entity" ? reference.id : null,
		groupingId: reference.owner === "grouping" ? reference.id : null,
		referenceId: reference.owner === "reference" ? reference.id : null,
	};
}

export async function findCatalogRelations(
	tx: DatabaseTransaction,
	reference: CatalogReference,
	actor: string | null,
	definitionRevisionId: string,
	query: {
		readonly afterId?: string;
		readonly participants?: readonly {
			readonly roleRevisionId: string;
			readonly target: CatalogReference;
		}[];
	} = {},
) {
	await loadCatalogIdentity(tx, reference, actor, false);
	z.uuid().parse(definitionRevisionId);
	const input = z
		.strictObject({
			afterId: z.uuid().optional(),
			participants: z
				.array(z.strictObject({ roleRevisionId: z.uuid(), target: CatalogReferenceSchema }))
				.max(16)
				.default([]),
		})
		.parse({
			...query,
			participants: query.participants?.map((participant) => ({
				...participant,
				target: { owner: participant.target.owner, id: participant.target.id },
			})),
		});
	const { relation: table, participant } = CatalogFactTables[reference.owner];
	const targetColumns = {
		publishing: participant.publishingId,
		music: participant.musicId,
		program: participant.programId,
		software: participant.softwareId,
		entity: participant.entityId,
		grouping: participant.groupingId,
		reference: participant.referenceId,
	};
	const participantConditions = input.participants.map(
		(condition) => sql`exists (
		select 1 from ${participant} where ${participant.ownerId} = ${table.ownerId}
		and ${participant.relationId} = ${table.id} and ${participant.roleRevisionId} = ${condition.roleRevisionId}::uuid
		and ${targetColumns[condition.target.owner]} = ${condition.target.id}::uuid)`,
	);
	return tx
		.select()
		.from(table)
		.where(
			and(
				eq(table.ownerId, reference.id),
				eq(table.definitionRevisionId, definitionRevisionId),
				eq(table.state, "active"),
				readableRelation(reference, actor),
				input.afterId ? gt(table.id, input.afterId) : undefined,
				...participantConditions,
			),
		)
		.orderBy(table.id)
		.limit(100);
}

export function readableRelation(reference: CatalogReference, actor: string | null) {
	const { relation, participant } = CatalogFactTables[reference.owner];
	const targets = {
		publishing: participant.publishingId,
		music: participant.musicId,
		program: participant.programId,
		software: participant.softwareId,
		entity: participant.entityId,
		grouping: participant.groupingId,
		reference: participant.referenceId,
	};
	const visibleTargets = CatalogOwnerValues.map((owner) => {
		const table = CatalogIdentityTables[owner];
		return sql`(${targets[owner]} is not null and exists (select 1 from ${table} where ${table.id} = ${targets[owner]} and ${table.deletedAt} is null and ((${table.createdByAuthUserId} = ${actor}::uuid) is true or (${table.visibility} in ('public', 'unlisted') and ${table.status} = 'published' and ${table.moderationStatus} = 'approved'))))`;
	});
	return sql`exists (select 1 from ${participant} where ${participant.ownerId} = ${relation.ownerId} and ${participant.relationId} = ${relation.id}) and not exists (select 1 from ${participant} where ${participant.ownerId} = ${relation.ownerId} and ${participant.relationId} = ${relation.id} and not (${sql.join(visibleTargets, sql` or `)}))`;
}

export async function assertReadableTargets(
	tx: DatabaseTransaction,
	references: readonly CatalogReference[],
	actor: string | null,
) {
	for (const owner of CatalogOwnerValues) {
		const ids = [
			...new Set(references.filter((reference) => reference.owner === owner).map(({ id }) => id)),
		];
		if (!ids.length) continue;
		const table = CatalogIdentityTables[owner];
		const rows = await tx
			.select()
			.from(table)
			.where(and(inArray(table.id, ids), isNull(table.deletedAt)))
			.limit(ids.length);
		if (rows.length !== ids.length)
			throw new CatalogReferenceNotFound("Catalog participant target is missing");
		if (
			rows.some(
				(row) =>
					(actor === null || row.createdByAuthUserId !== actor) &&
					(row.visibility === "private" ||
						row.status !== "published" ||
						row.moderationStatus !== "approved"),
			)
		)
			throw new CatalogAccessDenied("Catalog participant target is not readable");
	}
}

export async function readCatalogParticipants(
	tx: DatabaseTransaction,
	reference: CatalogReference,
	relationId: string,
	actor: string | null,
	afterPosition = -1,
	limit = 100,
) {
	z.uuid().parse(relationId);
	z.number().int().min(-1).max(Number.MAX_SAFE_INTEGER).parse(afterPosition);
	z.number().int().min(1).max(128).parse(limit);
	const tables = CatalogFactTables[reference.owner];
	await loadCatalogIdentity(tx, reference, actor, false);
	const [relation] = await tx
		.select()
		.from(tables.relation)
		.where(
			and(
				eq(tables.relation.ownerId, reference.id),
				eq(tables.relation.id, relationId),
				readableRelation(reference, actor),
			),
		)
		.limit(1);
	if (!relation) throw new CatalogReferenceNotFound("Catalog relation is missing");
	return tx
		.select()
		.from(tables.participant)
		.where(
			and(
				eq(tables.participant.ownerId, reference.id),
				eq(tables.participant.relationId, relationId),
				gt(tables.participant.position, afterPosition),
			),
		)
		.orderBy(tables.participant.position)
		.limit(limit);
}
