import { and, eq, gt, sql } from "drizzle-orm";
import { z } from "zod";
import type { DatabaseTransaction } from "../database";
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
	if (identity.createdByAuthUserId !== actor)
		throw new CatalogReferenceNotFound("Semantic history requires owner authority");
	const table = CatalogFactTables[reference.owner].semanticRevision;
	return tx
		.select()
		.from(table)
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
	if (target.relationId) {
		const [visible] = await tx
			.select({ id: tables.relation.id })
			.from(tables.relation)
			.where(
				and(
					eq(tables.relation.ownerId, reference.id),
					eq(tables.relation.id, target.relationId),
					readableRelation(reference, actor, 2),
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
export function currentCatalogSemantic(reference: CatalogReference, kind: "fact" | "relation") {
	const {
		semanticHead: head,
		semanticRevision: revision,
		fact,
		relation,
	} = CatalogFactTables[reference.owner];
	const target = kind === "fact" ? fact : relation;
	const targetId = kind === "fact" ? revision.factId : revision.relationId;
	return sql`exists (select 1 from ${revision} join ${head} on ${head.ownerId}=${revision.ownerId} and ${head.semanticId}=${revision.semanticId} and ${head.version}=${revision.version} where ${revision.ownerId}=${target.ownerId} and ${targetId}=${target.id} and ${revision.state} in ('active','disputed'))`;
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
		.select()
		.from(table)
		.where(
			and(
				eq(table.ownerId, reference.id),
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
