import { and, eq, gt, getTableColumns, getTableName, inArray, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { canAccessCatalog } from "../participation/policy";
import type { DatabaseTransaction } from "../database";
import { catalogDefinitionRevision } from "../database/schema/catalog-identity";
import { CatalogFactTables } from "../database/schema/catalog-facts";
import { CatalogFactStateValues, type CatalogFactState, type CatalogReference } from "./contracts";
import {
	loadCatalogIdentity,
	recordCatalogChange,
	CatalogRevisionConflict,
	CatalogReferenceNotFound,
	readableRelation,
} from "./storage";

/** @alpha Publish one immutable value/relation revision with a constant-size atomic head switch. */
export async function publishCatalogSemanticRevision(
	tx: DatabaseTransaction,
	reference: CatalogReference,
	actor: string,
	input: {
		semanticId: string;
		expectedHeadVersion: number;
		factId?: string;
		relationId?: string;
		state?: CatalogFactState;
	},
) {
	const value = z
		.strictObject({
			semanticId: z.uuid(),
			expectedHeadVersion: z
				.number()
				.int()
				.min(0)
				.max(Number.MAX_SAFE_INTEGER - 1),
			factId: z.uuid().optional(),
			relationId: z.uuid().optional(),
			state: z.enum(CatalogFactStateValues).default("active"),
		})
		.refine((v) => Number(!!v.factId) + Number(!!v.relationId) === 1)
		.parse(input);
	await loadCatalogIdentity(tx, reference, actor, true);
	const {
		semanticHead: head,
		semanticRevision: history,
		fact,
		relation,
	} = CatalogFactTables[reference.owner];
	const [current] = await tx
		.select()
		.from(head)
		.where(and(eq(head.ownerId, reference.id), eq(head.semanticId, value.semanticId)))
		.limit(1)
		.for("update");
	if ((current?.version ?? 0) !== value.expectedHeadVersion)
		throw new CatalogRevisionConflict("Semantic head changed");
	if (value.factId) {
		const [row] = await tx
			.select()
			.from(fact)
			.where(and(eq(fact.ownerId, reference.id), eq(fact.id, value.factId)))
			.limit(1);
		if (!row?.sealedAt || row.semanticId !== value.semanticId)
			throw new TypeError("An incomplete staged fact cannot become visible");
	}
	if (value.relationId) {
		const [row] = await tx
			.select()
			.from(relation)
			.where(and(eq(relation.ownerId, reference.id), eq(relation.id, value.relationId)))
			.limit(1);
		if (!row || row.semanticId !== value.semanticId)
			throw new TypeError("Missing immutable relation revision");
	}
	if (current) {
		const [previous] = await tx
			.select()
			.from(history)
			.where(
				and(
					eq(history.ownerId, reference.id),
					eq(history.semanticId, value.semanticId),
					eq(history.version, current.version),
				),
			)
			.limit(1);
		if (!previous || Boolean(previous.factId) !== Boolean(value.factId))
			throw new TypeError("A semantic identity cannot change target family");
		if (
			previous.state === "withdrawn" &&
			value.state === "active" &&
			previous.factId === (value.factId ?? null) &&
			previous.relationId === (value.relationId ?? null)
		)
			throw new TypeError("A revoked revision requires a fresh reviewed value");
		const oldId = previous.factId ?? previous.relationId;
		const newId = value.factId ?? value.relationId;
		const targetTable = value.factId ? fact : relation;
		if (oldId && newId) {
			if (value.factId) {
				const purposes = await tx.select({ purpose: fact.purpose }).from(fact)
					.where(and(eq(fact.ownerId, reference.id), inArray(fact.id, [oldId, newId]))).limit(2);
				if (new Set(purposes.map(row => row.purpose)).size !== 1)
					throw new TypeError("A semantic identity cannot change its fact purpose");
			}
			const rows = await tx
				.select({ definitionRevisionId: targetTable.definitionRevisionId })
				.from(targetTable)
				.where(
					and(
						eq(targetTable.ownerId, reference.id),
						sql`${targetTable.id} in (${oldId}::uuid,${newId}::uuid)`,
					),
				)
				.limit(2);
			const definitions = await tx
				.select({ definitionId: catalogDefinitionRevision.definitionId })
				.from(catalogDefinitionRevision)
				.where(
					sql`${catalogDefinitionRevision.id} in (${sql.join(
						rows.map((row) => sql`${row.definitionRevisionId}::uuid`),
						sql`, `,
					)})`,
				)
				.limit(2);
			if (new Set(definitions.map((d) => d.definitionId)).size !== 1)
				throw new TypeError("A semantic identity cannot change its governed meaning");
		}
	}
	const version = value.expectedHeadVersion + 1;
	await tx.insert(history).values({
		ownerId: reference.id,
		semanticId: value.semanticId,
		version,
		factId: value.factId ?? null,
		relationId: value.relationId ?? null,
		state: value.state,
		actorAuthUserId: actor,
	});
	if (current)
		await tx
			.update(head)
			.set({ version })
			.where(
				and(
					eq(head.ownerId, reference.id),
					eq(head.semanticId, value.semanticId),
					eq(head.version, value.expectedHeadVersion),
				),
			);
	else
		await tx.insert(head).values({ ownerId: reference.id, semanticId: value.semanticId, version });
	return { semanticId: value.semanticId, headVersion: version };
}

/** @alpha Keyset history returns exact immutable targets and never materializes their value trees. */
export async function listCatalogSemanticHistory(
	tx: DatabaseTransaction,
	reference: CatalogReference,
	actor: string | null,
	semanticId: string,
	afterVersion = 0,
	limit = 100,
) {
	z.uuid().parse(semanticId);
	z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).parse(afterVersion);
	z.number().int().min(1).max(100).parse(limit);
	const identity = await loadCatalogIdentity(tx, reference, actor, false);
	if (!(await canAccessCatalog(tx, reference, actor, identity.createdByAuthUserId, false)))
		throw new CatalogReferenceNotFound("Semantic history requires owner authority");
	const { semanticRevision: table, fact, relation } = CatalogFactTables[reference.owner];
	const head = CatalogFactTables[reference.owner].semanticHead;
	const [current] = await tx.select({ purpose: fact.purpose }).from(head)
		.innerJoin(table, and(eq(table.ownerId, head.ownerId), eq(table.semanticId, head.semanticId), eq(table.version, head.version)))
		.leftJoin(fact, and(eq(fact.ownerId, table.ownerId), eq(fact.id, table.factId)))
		.where(and(eq(head.ownerId, reference.id), eq(head.semanticId, semanticId))).limit(1);
	if (current?.purpose === "qualifier")
		throw new CatalogReferenceNotFound("Qualifier history is read through its exact relation revisions");
	return tx
		.select({ ...getTableColumns(table), definitionRevisionId: sql<string>`coalesce(${fact.definitionRevisionId},${relation.definitionRevisionId})` })
		.from(table)
		.leftJoin(fact, and(eq(fact.ownerId, table.ownerId), eq(fact.id, table.factId)))
		.leftJoin(relation, and(eq(relation.ownerId, table.ownerId), eq(relation.id, table.relationId)))
		.where(
			and(
				eq(table.ownerId, reference.id),
				eq(table.semanticId, semanticId),
				gt(table.version, afterVersion),
			),
		)
		.orderBy(table.version)
		.limit(limit);
}

/** @alpha Restoration records a new decision; revoked heads cannot silently be reactivated. */
export async function restoreCatalogSemanticRevision(
	tx: DatabaseTransaction,
	reference: CatalogReference,
	actor: string,
	expectedOwnerVersion: number,
	semanticId: string,
	expectedHeadVersion: number,
	restoreVersion: number,
) {
	z.uuid().parse(semanticId);
	z.number().int().positive().max(Number.MAX_SAFE_INTEGER).parse(restoreVersion);
	const revision = await recordCatalogChange(
		tx,
		reference,
		actor,
		expectedOwnerVersion,
		"semantic.restore",
	);
	const tables = CatalogFactTables[reference.owner];
	const [target] = await tx
		.select()
		.from(tables.semanticRevision)
		.where(
			and(
				eq(tables.semanticRevision.ownerId, reference.id),
				eq(tables.semanticRevision.semanticId, semanticId),
				eq(tables.semanticRevision.version, restoreVersion),
			),
		)
		.limit(1);
	const [current] = await tx
		.select()
		.from(tables.semanticRevision)
		.where(
			and(
				eq(tables.semanticRevision.ownerId, reference.id),
				eq(tables.semanticRevision.semanticId, semanticId),
				eq(tables.semanticRevision.version, expectedHeadVersion),
			),
		)
		.limit(1);
	if (!target || target.state !== "active" || !current || current.state === "withdrawn")
		throw new TypeError("Withdrawn or unavailable semantics require a fresh review decision");
	const supportTarget = target.factId
		? eq(tables.support.factId, target.factId)
		: eq(tables.support.relationId, target.relationId ?? "00000000-0000-0000-0000-000000000000");
	const [anySupport] = await tx
		.select({ id: tables.support.id })
		.from(tables.support)
		.where(and(eq(tables.support.ownerId, reference.id), supportTarget))
		.limit(1);
	if (anySupport) {
		const [activeSupport] = await tx
			.select({ id: tables.support.id })
			.from(tables.support)
			.where(
				and(
					eq(tables.support.ownerId, reference.id),
					supportTarget,
					isNull(tables.support.withdrawnAt),
				),
			)
			.limit(1);
		if (!activeSupport)
			throw new TypeError("All support for this historical revision has been revoked");
	}
	if (target.relationId) {
		const [visible] = await tx
			.select({ id: tables.relation.id })
			.from(tables.relation)
			.where(
				and(
					eq(tables.relation.ownerId, reference.id),
					eq(tables.relation.id, target.relationId),
					await readableRelation(tx, reference, actor, 2),
				),
			)
			.limit(1);
		if (!visible) throw new TypeError("Historical relation targets are no longer readable");
	}
	const result = await publishCatalogSemanticRevision(tx, reference, actor, {
		semanticId,
		expectedHeadVersion,
		...(target.factId ? { factId: target.factId } : { relationId: target.relationId ?? undefined }),
	});
	return { ...result, revision };
}

/** @alpha Selection predicate for current accepted rows, usable by bounded exports and queries. */
export function currentCatalogSemantic(reference: CatalogReference, kind: "fact" | "relation", includeInactive = false) {
	const {
		semanticHead: head,
		semanticRevision: revision,
		fact,
		relation,
	} = CatalogFactTables[reference.owner];
	const target = kind === "fact" ? fact : relation;
	const targetId = kind === "fact" ? revision.factId : revision.relationId;
	return sql`exists (select 1 from ${revision} join ${head} on ${head.ownerId}=${revision.ownerId} and ${head.semanticId}=${revision.semanticId} and ${head.version}=${revision.version} where ${revision.ownerId}=${target.ownerId} and ${targetId}=${target.id} ${includeInactive ? sql`` : sql`and ${revision.state} in ('active','disputed')`})`;
}

/** Bounded head candidates make pagination independent of the number of obsolete value revisions. @internal */
export async function pageCurrentCatalogSemanticTargets(tx: DatabaseTransaction, reference: CatalogReference, afterId: string | undefined, limit: number) {
	const { semanticHead: head, semanticRevision: revision } = CatalogFactTables[reference.owner];
	return tx.select({ semanticId: head.semanticId, factId: revision.factId, relationId: revision.relationId }).from(head)
		.innerJoin(revision, and(eq(revision.ownerId, head.ownerId), eq(revision.semanticId, head.semanticId), eq(revision.version, head.version)))
		.where(and(eq(head.ownerId, reference.id), afterId ? gt(head.semanticId, afterId) : undefined))
		.orderBy(head.semanticId).limit(limit);
}

/** @alpha Withdraw or dispute the current semantic decision without changing historical data. */
export async function transitionCatalogSemanticState(
	tx: DatabaseTransaction,
	reference: CatalogReference,
	actor: string,
	expectedOwnerVersion: number,
	semanticId: string,
	expectedHeadVersion: number,
	state: CatalogFactState,
) {
	z.enum(CatalogFactStateValues).parse(state);
	if (state === "active") throw new TypeError("Reactivation requires an explicit restore decision");
	const revision = await recordCatalogChange(
		tx,
		reference,
		actor,
		expectedOwnerVersion,
		`semantic.${state}`,
	);
	const table = CatalogFactTables[reference.owner].semanticRevision;
	const [current] = await tx
		.select()
		.from(table)
		.where(
			and(
				eq(table.ownerId, reference.id),
				eq(table.semanticId, semanticId),
				eq(table.version, expectedHeadVersion),
			),
		)
		.limit(1);
	if (!current) throw new CatalogRevisionConflict("Semantic head changed");
	if (current.state === "withdrawn")
		throw new TypeError("A withdrawn semantic decision requires a new reviewed value or relation");
	const head = await publishCatalogSemanticRevision(tx, reference, actor, {
		semanticId,
		expectedHeadVersion,
		state,
		...(current.factId
			? { factId: current.factId }
			: { relationId: current.relationId ?? undefined }),
	});
	return { ...head, revision };
}

/** @alpha Bounded current canonical facts, independently of source bindings or evidence. */
export async function listCatalogFacts(
	tx: DatabaseTransaction,
	reference: CatalogReference,
	actor: string | null,
	input: {
		afterId?: string;
		limit?: number;
		definitionRevisionId?: string;
		maxSpoiler?: 0 | 1 | 2;
	} = {},
) {
	await loadCatalogIdentity(tx, reference, actor, false);
	const page = z
		.strictObject({
			afterId: z.uuid().optional(),
			limit: z.number().int().min(1).max(100).default(50),
			definitionRevisionId: z.uuid().optional(),
			maxSpoiler: z.number().int().min(0).max(2).default(0),
		})
		.parse(input);
	const table = CatalogFactTables[reference.owner].fact;
	return tx
		.select({ ...getTableColumns(table), state: currentCatalogSemanticState(reference, "fact") })
		.from(table)
		.where(
			and(
				eq(table.ownerId, reference.id),
				eq(table.purpose, "assertion"),
				currentCatalogSemantic(reference, "fact"),
				sql`${table.spoiler} <= ${page.maxSpoiler}`,
				page.afterId ? gt(table.id, page.afterId) : undefined,
				page.definitionRevisionId
					? eq(table.definitionRevisionId, page.definitionRevisionId)
					: undefined,
			),
		)
		.orderBy(table.id)
		.limit(page.limit);
}

/** @alpha Candidate-bounded fact export does not scan indefinitely through old or hidden revisions. */
export async function pageCatalogFacts(
	tx: DatabaseTransaction,
	reference: CatalogReference,
	actor: string | null,
	input: {
		afterId?: string;
		limit?: number;
		definitionRevisionId?: string;
		maxSpoiler?: 0 | 1 | 2;
		includeInactive?: boolean;
	} = {},
) {
	await loadCatalogIdentity(tx, reference, actor, false);
	const page = z
		.strictObject({
			afterId: z.uuid().optional(),
			limit: z.number().int().min(1).max(100).default(50),
			definitionRevisionId: z.uuid().optional(),
			maxSpoiler: z.number().int().min(0).max(2).default(0),
			includeInactive: z.boolean().default(false),
		})
		.parse(input);
	if (page.includeInactive) await loadCatalogIdentity(tx, reference, actor, true);
	const table = CatalogFactTables[reference.owner].fact;
	const candidates = await pageCurrentCatalogSemanticTargets(tx, reference, page.afterId, page.limit);
	const afterId = candidates.length === page.limit ? candidates.at(-1)?.semanticId ?? null : null;
	const ids = candidates.flatMap(candidate => candidate.factId ? [candidate.factId] : []);
	if (!ids.length) return { items: [], afterId };
	const items = await tx
		.select({ ...getTableColumns(table), state: currentCatalogSemanticState(reference, "fact") })
		.from(table)
		.where(
			and(
				eq(table.ownerId, reference.id),
				inArray(table.id, ids),
				eq(table.purpose, "assertion"),
				page.definitionRevisionId ? eq(table.definitionRevisionId, page.definitionRevisionId) : undefined,
				currentCatalogSemantic(reference, "fact", page.includeInactive),
				sql`${table.spoiler} <= ${page.maxSpoiler}`,
			),
		)
		.orderBy(table.semanticId)
		.limit(page.limit);
	return {
		items,
		afterId,
	};
}

/** @alpha State belongs to the current editorial decision, not its immutable value row. */
export function currentCatalogSemanticState(
	reference: CatalogReference,
	kind: "fact" | "relation",
) {
	const {
		semanticHead: head,
		semanticRevision: revision,
		fact,
		relation,
	} = CatalogFactTables[reference.owner];
	const target = kind === "fact" ? fact : relation;
	// A single-table Drizzle selection strips Column qualifiers even inside a SQL subquery.
	const r = sql.identifier(getTableName(revision));
	const h = sql.identifier(getTableName(head));
	const t = sql.identifier(getTableName(target));
	const targetKey = sql.identifier(kind === "fact" ? "fact_id" : "relation_id");
	return sql<CatalogFactState>`(select ${r}."state" from ${revision} join ${head} on ${h}."owner_id"=${r}."owner_id" and ${h}."semantic_id"=${r}."semantic_id" and ${h}."version"=${r}."version" where ${r}."owner_id"=${t}."owner_id" and ${r}.${targetKey}=${t}."id" limit 1)`;
}
