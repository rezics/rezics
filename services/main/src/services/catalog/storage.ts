import { and, asc, eq, getTableColumns, gt, inArray, isNull, sql } from "drizzle-orm";
import { HTTPError } from "elysia";
import { isDeepStrictEqual } from "node:util";
import { z } from "zod";
import type { DatabaseTransaction } from "../database";
import { CatalogFactTables } from "../database/schema/catalog-facts";
import {
	CatalogIdentityTables,
	catalogDefinition,
	catalogDefinitionRevision,
	catalogUnitLocator,
} from "../database/schema/catalog-identity";
import {
	canAccessCatalog,
	catalogAccessDecisions,
	readCatalogAuthorityScope,
	catalogIdentityReadPredicate,
	requireCatalogIdentityAdmission,
} from "../participation/policy";
import { insertCatalogIdentity } from "./identity-storage";
import {
	CatalogDefinitionInputSchema,
	CatalogOwnerValues,
	CatalogPageSchema,
	CatalogReferenceSchema,
	type CatalogIdentityInput,
	type CatalogReference,
} from "./contracts";
import {
	assertCatalogDefinitionRevision,
	validateCatalogParticipants,
	validateCatalogScalar,
} from "./definitions";
import {
	currentCatalogSemantic,
	currentCatalogSemanticState,
	pageCurrentCatalogSemanticTargets,
	publishCatalogSemanticRevision,
} from "./semantic-history";
import { CatalogValueNodeSchema } from "./value-nodes";
import {
	hasCatalogMergeRedirect,
	mergedCatalogReadPredicate,
	unmergedCatalogWritePredicate,
} from "./merge-read";
import { catalogRatingReadable } from "./read-policy";

export class CatalogAccessDenied extends Error {}
export class CatalogRevisionConflict extends HTTPError.id("CatalogRevisionConflict", 409) {
	override readonly message: string;
	constructor(message = "Catalog revision changed") {
		super();
		this.message = message;
	}
}
export class CatalogReferenceNotFound extends HTTPError.id("CatalogReferenceNotFound", 404) {
	override readonly message: string;
	constructor(message = "Catalog reference is unavailable") {
		super();
		this.message = message;
	}
}

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
		.where(
			and(
				eq(table.id, ref.id),
				isNull(table.deletedAt),
				write ? unmergedCatalogWritePredicate(table.id) : undefined,
			),
		)
		.limit(1);
	const [row] = await (write ? query.for(writeLock) : query);
	if (!row && write && (await hasCatalogMergeRedirect(tx, ref)))
		throw new CatalogAccessDenied("Merged source data is read-only");
	if (!row) throw new CatalogReferenceNotFound("Catalog identity is missing or retired");
	if (!write && !catalogRatingReadable(row.contentRating))
		throw new CatalogReferenceNotFound("Catalog identity is unavailable under the viewer policy");
	const creator = await canAccessCatalog(tx, ref, actor, row.createdByAuthUserId, write);
	if (write && row.status === "archived" && (await hasCatalogMergeRedirect(tx, ref)))
		throw new CatalogAccessDenied("Merged source data is read-only");
	let mergedReadable = false;
	if (!write && !creator && row.status === "archived") {
		const scope = await readCatalogAuthorityScope(tx, actor);
		const [allowed] = await tx
			.select({ id: table.id })
			.from(table)
			.where(and(eq(table.id, ref.id), mergedCatalogReadPredicate(ref.owner, table, scope)))
			.limit(1);
		mergedReadable = Boolean(allowed);
	}
	if (
		write
			? !creator
			: !creator &&
				!mergedReadable &&
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

/** Admit an identity with current self contribution authority; actor UUIDs and scoped grants are insufficient. @internal */
export async function createCatalogIdentity(
	tx: DatabaseTransaction,
	input: CatalogIdentityInput,
	actor: string,
) {
	await requireCatalogIdentityAdmission(tx, actor);
	return insertCatalogIdentity(tx, input, actor);
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
	const parsed = CatalogReferenceSchema.safeParse({ owner: locator.owner, id });
	if (!parsed.success)
		throw new CatalogReferenceNotFound("This identity has another registered owner");
	const reference = parsed.data;
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
	for (const role of value.constraints.roles ?? [])
		await assertCatalogDefinitionRevision(tx, role.roleRevisionId, "role");
	for (const qualifier of value.constraints.qualifierRevisionIds ?? [])
		await assertCatalogDefinitionRevision(tx, qualifier, "property");
	if (value.constraints.vocabularyRevisionId)
		await assertCatalogDefinitionRevision(tx, value.constraints.vocabularyRevisionId, "vocabulary");
	for (const vocabulary of new Set(
		(value.constraints.rules ?? []).flatMap((r) =>
			r.vocabularyRevisionId ? [r.vocabularyRevisionId] : [],
		),
	))
		await assertCatalogDefinitionRevision(tx, vocabulary, "vocabulary");
	for (const member of value.constraints.memberRevisionIds ?? [])
		await assertCatalogDefinitionRevision(tx, member, ["class", "vocabulary"]);
	if (value.kind === "predicate" && !value.constraints.roles?.length)
		throw new TypeError("Predicates must declare governed roles");
	if (
		value.kind === "property" &&
		["object", "array"].includes(value.valueKind ?? "") &&
		!value.constraints.rules
	)
		throw new TypeError("Structured properties must declare a governed rule grammar");
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
		.values({
			definitionId: definition.id,
			version: 1,
			valueKind: value.valueKind,
			constraints: value.constraints,
		})
		.onConflictDoNothing();
	const [revision] = await tx
		.select()
		.from(catalogDefinitionRevision)
		.where(and(eq(catalogDefinitionRevision.definitionId, definition.id)))
		.orderBy(sql`${catalogDefinitionRevision.version} desc`)
		.limit(1);
	if (
		!revision ||
		revision.valueKind !== value.valueKind ||
		!isDeepStrictEqual(revision.constraints, value.constraints)
	)
		throw new Error("Catalog definition revision has another value shape");
	return { definitionId: definition.id, revisionId: revision.id };
}

export { addCatalogName } from "./names";

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
	options: {
		spoiler?: 0 | 1 | 2;
		purpose?: "assertion" | "qualifier";
		semanticId?: string;
		expectedHeadVersion?: number;
		initialSemanticId?: string;
	} = {},
) {
	const staged = z
		.strictObject({
			purpose: z.enum(["assertion", "qualifier"]).default("assertion"),
			spoiler: z.union([z.literal(0), z.literal(1), z.literal(2)]).default(0),
			semanticId: z.uuid().optional(),
			initialSemanticId: z.uuid().optional(),
			expectedHeadVersion: z
				.number()
				.int()
				.min(0)
				.max(Number.MAX_SAFE_INTEGER - 1)
				.default(0),
		})
		.parse(options);
	if (
		Boolean(staged.semanticId) !== staged.expectedHeadVersion > 0 ||
		(staged.initialSemanticId && (staged.semanticId || staged.expectedHeadVersion !== 0))
	)
		throw new TypeError(
			"Replacement requires an exact existing semantic head; explicit initialization is separate",
		);
	await assertCatalogDefinitionRevision(tx, definitionRevisionId, "property");
	const revision = await recordCatalogChange(tx, reference, actor, expectedVersion, "fact.begin");
	if (staged.initialSemanticId) {
		const head = CatalogFactTables[reference.owner].semanticHead;
		const [existing] = await tx
			.select({ version: head.version })
			.from(head)
			.where(and(eq(head.ownerId, reference.id), eq(head.semanticId, staged.initialSemanticId)))
			.limit(1);
		if (existing)
			throw new CatalogRevisionConflict("An existing semantic head cannot be initialized again");
	}

	const table = CatalogFactTables[reference.owner].fact;
	const [created] = await tx
		.insert(table)
		.values({
			ownerId: reference.id,
			definitionRevisionId,
			spoiler: staged.spoiler,
			purpose: staged.purpose,
			semanticId: staged.initialSemanticId ?? staged.semanticId,
			expectedHeadVersion: staged.expectedHeadVersion,
		})
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
	const definition = await assertCatalogDefinitionRevision(
		tx,
		fact.definitionRevisionId,
		"property",
	);
	const valueTable = CatalogFactTables[reference.owner].valueNode;
	const parentPositions = [
		...new Set(
			nodes.flatMap((n) =>
				n.parentPosition !== null && n.parentPosition <= expectedLastPosition
					? [n.parentPosition]
					: [],
			),
		),
	];
	const parents = parentPositions.length
		? await tx
				.select({ position: valueTable.position, rulePosition: valueTable.rulePosition })
				.from(valueTable)
				.where(
					and(
						eq(valueTable.ownerId, reference.id),
						eq(valueTable.factId, factId),
						inArray(valueTable.position, parentPositions),
					),
				)
				.limit(512)
		: [];
	const rulesByPosition = new Map(parents.map((p) => [p.position, p.rulePosition]));
	const values = nodes.map((node) => {
		const rules = definition.constraints.rules;
		const rule = rules
			? node.position === 0
				? rules[0]
				: rules.find(
						(r) =>
							r.parent === rulesByPosition.get(node.parentPosition ?? -1) &&
							r.memberKey === node.memberKey,
					)
			: undefined;
		if (rules && !rule) throw new TypeError("Value member is not declared by the governed grammar");
		validateCatalogScalar(
			node,
			rule ?? definition.constraints,
			rule?.kind ?? definition.valueKind ?? "null",
		);
		const rulePosition = rule?.position ?? 0;
		rulesByPosition.set(node.position, rulePosition);
		return { ...node, rulePosition, ownerId: reference.id, factId };
	});
	const vocabularyIds = [
		...new Set(
			values.flatMap((node) => {
				const rule = definition.constraints.rules?.[node.rulePosition] ?? definition.constraints;
				return rule.vocabularyRevisionId ? [rule.vocabularyRevisionId] : [];
			}),
		),
	];
	const vocabularies = vocabularyIds.length
		? await tx
				.select({
					id: catalogDefinitionRevision.id,
					constraints: catalogDefinitionRevision.constraints,
				})
				.from(catalogDefinitionRevision)
				.where(inArray(catalogDefinitionRevision.id, vocabularyIds))
				.limit(128)
		: [];
	for (const node of values) {
		const rule = definition.constraints.rules?.[node.rulePosition] ?? definition.constraints;
		if (rule.vocabularyRevisionId && node.kind !== "null") {
			const vocabulary = vocabularies.find((v) => v.id === rule.vocabularyRevisionId);
			if (
				node.kind !== "string" ||
				!vocabulary?.constraints.memberRevisionIds?.includes(node.textValue ?? "")
			)
				throw new TypeError("Value is not a member of the exact vocabulary revision");
		}
	}
	await tx.insert(valueTable).values(values);
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
	const definition = await assertCatalogDefinitionRevision(
		tx,
		fact.definitionRevisionId,
		"property",
	);
	if (
		!root ||
		(root.kind !== root.expectedKind &&
			!(
				root.kind === "null" &&
				(definition.constraints.rules?.[0]?.nullable ?? definition.constraints.nullable)
			))
	)
		throw new TypeError("Catalog value root differs from its property definition");
	await tx
		.update(tables.fact)
		.set({ sealedAt: sql`current_timestamp` })
		.where(and(eq(tables.fact.ownerId, reference.id), eq(tables.fact.id, factId)));
	const head = await publishCatalogSemanticRevision(tx, reference, actor, {
		semanticId: fact.semanticId,
		expectedHeadVersion: fact.expectedHeadVersion,
		factId,
	});
	return { revision, ...head };
}

export async function readCatalogFactNodes(
	tx: DatabaseTransaction,
	reference: CatalogReference,
	actor: string | null,
	factId: string,
	afterPosition = -1,
	limit = 100,
	maxSpoiler: 0 | 1 | 2 = 0,
	relationId?: string,
) {
	const identity = await loadCatalogIdentity(tx, reference, actor, false);
	z.uuid().parse(factId);
	z.number().int().min(-1).max(Number.MAX_SAFE_INTEGER).parse(afterPosition);
	z.number().int().min(1).max(512).parse(limit);
	const tables = CatalogFactTables[reference.owner];
	const [fact] = await tx
		.select()
		.from(tables.fact)
		.where(and(eq(tables.fact.id, factId), eq(tables.fact.ownerId, reference.id)))
		.limit(1);
	z.number().int().min(0).max(2).parse(maxSpoiler);
	if (!fact?.sealedAt || !["active", "disputed"].includes(fact.state) || fact.spoiler > maxSpoiler)
		throw new CatalogReferenceNotFound("Catalog fact is missing, withdrawn or not sealed");
	const ownerAccess = await canAccessCatalog(tx, reference, actor, identity.createdByAuthUserId, false);
	if (fact.purpose === "qualifier" || !ownerAccess) {
		const [current] = fact.purpose === "assertion" ? await tx
			.select({ id: tables.fact.id })
			.from(tables.fact)
			.where(
				and(
					eq(tables.fact.ownerId, reference.id),
					eq(tables.fact.id, factId),
					currentCatalogSemantic(reference, "fact"),
				),
			)
			.limit(1) : [];
		if (!current) {
			if (!relationId)
				throw new CatalogReferenceNotFound(
					"Qualifier values require an exact visible relation; historical assertions require owner authority",
				);
			z.uuid().parse(relationId);
			const [scoped] = await tx
				.select({ id: tables.relationScope.id })
				.from(tables.relationScope)
				.innerJoin(
					tables.relation,
					and(
						eq(tables.relation.ownerId, tables.relationScope.ownerId),
						eq(tables.relation.id, tables.relationScope.relationId),
					),
				)
				.where(
					and(
						eq(tables.relationScope.ownerId, reference.id),
						eq(tables.relationScope.relationId, relationId),
						eq(tables.relationScope.valueFactId, factId),
						ownerAccess ? undefined : currentCatalogSemantic(reference, "relation"),
						await readableRelation(tx, reference, actor, maxSpoiler),
					),
				)
				.limit(1);
			if (!scoped)
				throw new CatalogReferenceNotFound(
					"Historical value is not supported by a visible exact relation",
				);
		}
	}
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
		readonly spoiler?: 0 | 1 | 2;
		readonly semanticId?: string;
		readonly initialSemanticId?: string;
		readonly expectedHeadVersion?: number;
		readonly qualifiers?: readonly { definitionRevisionId: string; valueFactId: string }[];
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
			semanticId: z.uuid().optional(),
			initialSemanticId: z.uuid().optional(),
			expectedHeadVersion: z
				.number()
				.int()
				.min(0)
				.max(Number.MAX_SAFE_INTEGER - 1)
				.default(0),
			spoiler: z.union([z.literal(0), z.literal(1), z.literal(2)]).default(0),
			qualifiers: z
				.array(z.strictObject({ definitionRevisionId: z.uuid(), valueFactId: z.uuid() }))
				.max(64)
				.default([]),
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
	if (Boolean(value.semanticId) !== value.expectedHeadVersion > 0 ||
		(value.initialSemanticId && (value.semanticId || value.expectedHeadVersion !== 0)))
		throw new TypeError("Replacement requires an exact existing semantic head");
	const revision = await recordCatalogChange(
		tx,
		reference,
		actor,
		expectedVersion,
		"relation.create",
	);
	const predicate = await assertCatalogDefinitionRevision(
		tx,
		value.definitionRevisionId,
		"predicate",
	);
	const targetShapes = await assertReadableTargets(
		tx,
		value.participants.map(({ target }) => target),
		actor,
	);
	validateCatalogParticipants(
		predicate.constraints,
		value.participants.map((p) => ({
			roleRevisionId: p.roleRevisionId,
			target: { ...p.target, shape: targetShapes.get(`${p.target.owner}:${p.target.id}`) ?? "" },
		})),
	);
	for (const qualifier of value.qualifiers) {
		if (!predicate.constraints.qualifierRevisionIds?.includes(qualifier.definitionRevisionId))
			throw new TypeError("Qualifier is not allowed by this predicate revision");
		const factTable = CatalogFactTables[reference.owner].fact;
		const [fact] = await tx
			.select()
			.from(factTable)
			.where(
				and(
					eq(factTable.ownerId, reference.id),
					eq(factTable.id, qualifier.valueFactId),
					eq(factTable.definitionRevisionId, qualifier.definitionRevisionId),
				),
			)
			.limit(1);
		if (!fact?.sealedAt || fact.state !== "active")
			throw new TypeError(
				"Relation qualifier requires an active sealed fact of the declared definition",
			);
	}
	const tables = CatalogFactTables[reference.owner];
	const [relation] = await tx
		.insert(tables.relation)
		.values({
			ownerId: reference.id,
			definitionRevisionId: value.definitionRevisionId,
			spoiler: value.spoiler,
			semanticId: value.initialSemanticId ?? value.semanticId,
			expectedHeadVersion: value.expectedHeadVersion,
		})
		.returning({ id: tables.relation.id, semanticId: tables.relation.semanticId });
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
	if (value.qualifiers.length)
		await tx
			.insert(tables.relationScope)
			.values(
				value.qualifiers.map((q) => ({ ...q, ownerId: reference.id, relationId: relation.id })),
			);
	const head = await publishCatalogSemanticRevision(tx, reference, actor, {
		semanticId: relation.semanticId,
		expectedHeadVersion: value.expectedHeadVersion,
		relationId: relation.id,
	});
	return { id: relation.id, revision, ...head };
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
		distributionId: reference.owner === "distribution" ? reference.id : null,
	};
}

export async function findCatalogRelations(
	tx: DatabaseTransaction,
	reference: CatalogReference,
	actor: string | null,
	definitionRevisionId: string,
	query: {
		readonly afterId?: string;
		readonly maxSpoiler?: 0 | 1 | 2;
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
			maxSpoiler: z.union([z.literal(0), z.literal(1), z.literal(2)]).default(0),
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
		distribution: participant.distributionId,
	};
	const participantConditions = input.participants.map(
		(condition) => sql`exists (
		select 1 from ${participant} where ${participant.ownerId} = ${table.ownerId}
		and ${participant.relationId} = ${table.id} and ${participant.roleRevisionId} = ${condition.roleRevisionId}::uuid
		and ${targetColumns[condition.target.owner]} = ${condition.target.id}::uuid)`,
	);
	return tx
		.select({
			...getTableColumns(table),
			state: currentCatalogSemanticState(reference, "relation"),
		})
		.from(table)
		.where(
			and(
				eq(table.ownerId, reference.id),
				eq(table.definitionRevisionId, definitionRevisionId),
				eq(table.state, "active"),
				await readableRelation(tx, reference, actor, input.maxSpoiler),
				currentCatalogSemantic(reference, "relation"),
				input.afterId ? gt(table.id, input.afterId) : undefined,
				...participantConditions,
			),
		)
		.orderBy(table.id)
		.limit(100);
}

export async function readableRelation(
	tx: DatabaseTransaction,
	reference: CatalogReference,
	actor: string | null,
	maxSpoiler: 0 | 1 | 2 = 0,
) {
	z.number().int().min(0).max(2).parse(maxSpoiler);
	const { relation, participant } = CatalogFactTables[reference.owner];
	const scope = await readCatalogAuthorityScope(tx, actor);
	const targets = {
		publishing: participant.publishingId,
		music: participant.musicId,
		program: participant.programId,
		software: participant.softwareId,
		entity: participant.entityId,
		grouping: participant.groupingId,
		reference: participant.referenceId,
		distribution: participant.distributionId,
	};
	const visibleTargets = CatalogOwnerValues.map((owner) => {
		const table = CatalogIdentityTables[owner];
		return sql`(${targets[owner]} is not null and exists (select 1 from ${table} where ${table.id} = ${targets[owner]} and ${catalogIdentityReadPredicate(scope, owner, table)}))`;
	});
	return sql`${relation.spoiler} <= ${maxSpoiler} and exists (select 1 from ${participant} where ${participant.ownerId} = ${relation.ownerId} and ${participant.relationId} = ${relation.id}) and not exists (select 1 from ${participant} where ${participant.ownerId} = ${relation.ownerId} and ${participant.relationId} = ${relation.id} and not (${sql.join(visibleTargets, sql` or `)}))`;
}

export async function assertReadableTargets(
	tx: DatabaseTransaction,
	references: readonly CatalogReference[],
	actor: string | null,
) {
	const shapes = new Map<string, string>();
	if (references.length > 128)
		throw new RangeError("Catalog target batches are limited to 128 references");
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
		for (const row of rows) shapes.set(`${owner}:${row.id}`, row.shape);
		if (rows.length !== ids.length)
			throw new CatalogReferenceNotFound("Catalog participant target is missing");
		if (rows.some((row) => !catalogRatingReadable(row.contentRating)))
			throw new CatalogAccessDenied(
				"Catalog participant target is unavailable under the viewer policy",
			);
		const access = await catalogAccessDecisions(
			tx,
			rows.map((row) => ({
				reference: { owner, id: row.id },
				createdByAuthUserId: row.createdByAuthUserId,
			})),
			actor,
			false,
		);
		if (
			rows.some(
				(row, position) =>
					!access[position] &&
					(row.visibility === "private" ||
						row.status !== "published" ||
						row.moderationStatus !== "approved"),
			)
		)
			throw new CatalogAccessDenied("Catalog participant target is not readable");
	}
	return shapes;
}

export async function readCatalogParticipants(
	tx: DatabaseTransaction,
	reference: CatalogReference,
	relationId: string,
	actor: string | null,
	afterPosition = -1,
	limit = 100,
	maxSpoiler: 0 | 1 | 2 = 0,
) {
	z.uuid().parse(relationId);
	z.number().int().min(-1).max(Number.MAX_SAFE_INTEGER).parse(afterPosition);
	z.number().int().min(1).max(128).parse(limit);
	const tables = CatalogFactTables[reference.owner];
	const identity = await loadCatalogIdentity(tx, reference, actor, false);
	const [relation] = await tx
		.select()
		.from(tables.relation)
		.where(
			and(
				eq(tables.relation.ownerId, reference.id),
				eq(tables.relation.id, relationId),
				await readableRelation(tx, reference, actor, maxSpoiler),
				(await canAccessCatalog(tx, reference, actor, identity.createdByAuthUserId, false))
					? undefined
					: currentCatalogSemantic(reference, "relation"),
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

/** @alpha Qualifiers remain on the same immutable relation instance as its participants. */
export async function readCatalogRelationQualifiers(
	tx: DatabaseTransaction,
	reference: CatalogReference,
	actor: string | null,
	relationId: string,
	options: { afterId?: string; limit?: number; maxSpoiler?: 0 | 1 | 2 } = {},
) {
	const identity = await loadCatalogIdentity(tx, reference, actor, false);
	const page = z
		.strictObject({
			afterId: z.uuid().optional(),
			limit: z.number().int().min(1).max(64).default(64),
			maxSpoiler: z.union([z.literal(0), z.literal(1), z.literal(2)]).default(0),
		})
		.parse(options);
	z.uuid().parse(relationId);
	const tables = CatalogFactTables[reference.owner];
	const [relation] = await tx
		.select({ id: tables.relation.id })
		.from(tables.relation)
		.where(
			and(
				eq(tables.relation.ownerId, reference.id),
				eq(tables.relation.id, relationId),
				(await canAccessCatalog(tx, reference, actor, identity.createdByAuthUserId, false))
					? undefined
					: currentCatalogSemantic(reference, "relation"),
				await readableRelation(tx, reference, actor, page.maxSpoiler),
			),
		)
		.limit(1);
	if (!relation) throw new CatalogReferenceNotFound("Relation is not visible");
	return tx
		.select({
			id: tables.relationScope.id,
			definitionRevisionId: tables.relationScope.definitionRevisionId,
			valueFactId: tables.relationScope.valueFactId,
			valueFactPurpose: tables.fact.purpose,
		})
		.from(tables.relationScope)
		.innerJoin(
			tables.fact,
			and(
				eq(tables.fact.ownerId, tables.relationScope.ownerId),
				eq(tables.fact.id, tables.relationScope.valueFactId),
			),
		)
		.where(
			and(
				eq(tables.relationScope.ownerId, reference.id),
				eq(tables.relationScope.relationId, relationId),
				sql`${tables.fact.spoiler} <= ${page.maxSpoiler}`,
				page.afterId ? gt(tables.relationScope.id, page.afterId) : undefined,
			),
		)
		.orderBy(tables.relationScope.id)
		.limit(page.limit);
}

/** @alpha Candidate-bounded relation export; the cursor advances even across hidden rows. */
export async function pageCatalogRelations(
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
			maxSpoiler: z.union([z.literal(0), z.literal(1), z.literal(2)]).default(0),
			includeInactive: z.boolean().default(false),
		})
		.parse(input);
	if (page.includeInactive) await loadCatalogIdentity(tx, reference, actor, true);
	const table = CatalogFactTables[reference.owner].relation;
	const candidates = await pageCurrentCatalogSemanticTargets(tx, reference, page.afterId, page.limit);
	const afterId = candidates.length === page.limit ? candidates.at(-1)?.semanticId ?? null : null;
	const ids = candidates.flatMap(candidate => candidate.relationId ? [candidate.relationId] : []);
	if (!ids.length) return { items: [], afterId };
	const items = await tx
		.select({
			...getTableColumns(table),
			state: currentCatalogSemanticState(reference, "relation"),
		})
		.from(table)
		.where(
			and(
				eq(table.ownerId, reference.id),
				inArray(table.id, ids),
				page.definitionRevisionId ? eq(table.definitionRevisionId, page.definitionRevisionId) : undefined,
				currentCatalogSemantic(reference, "relation", page.includeInactive),
				await readableRelation(tx, reference, actor, page.maxSpoiler),
			),
		)
		.orderBy(table.semanticId)
		.limit(page.limit);
	return {
		items,
		afterId,
	};
}
