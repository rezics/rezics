import { and, eq, gt, sql } from "drizzle-orm";
import { isDeepStrictEqual } from "node:util";
import { catalogSourceSupportColumns } from "./source-support";
import { z } from "zod";
import { readCatalogAuthorityScope, catalogIdentityReadPredicate } from "../participation/policy";
import type { DatabaseTransaction } from "../database";
import { CatalogNameTables } from "../database/schema/catalog-names";
import { CatalogFactTables } from "../database/schema/catalog-facts";
import { CatalogIdentityTables } from "../database/schema/catalog-identity";
import { CatalogPageSchema, type CatalogOwner, type CatalogReference } from "./contracts";
import {
	CatalogRevisionNumberSchema,
	normalizeCatalogIdentifier,
	type CatalogIdentifierInput,
} from "./name-contracts";
import { CatalogRevisionConflict, loadCatalogIdentity, recordCatalogChange } from "./storage";

/** @alpha @remarks A normalized identifier remains a fallible claim; duplicate assignments are retained. */
export async function addCatalogIdentifier(
	tx: DatabaseTransaction,
	reference: CatalogReference,
	actor: string,
	expectedVersion: number,
	input: CatalogIdentifierInput,
) {
	const values = normalizeCatalogIdentifier(input);
	if (values.issuerEntityId)
		await loadCatalogIdentity(tx, { owner: "entity", id: values.issuerEntityId }, actor, false);
	const revision = await recordCatalogChange(
		tx,
		reference,
		actor,
		expectedVersion,
		"identifier.add",
	);
	const table = CatalogNameTables[reference.owner].identifier;
	const [row] = await tx
		.insert(table)
		.values({ ...values, ownerId: reference.id, recordedByAuthUserId: actor })
		.returning({ id: table.id, identifierRevision: table.revision });
	if (!row) throw new Error("Identifier insertion returned no row");
	return { ...row, revision };
}

/** @alpha @remarks Full replacement revisions implement edits, disputes, withdrawal and restoration with optimistic concurrency. */
export async function reviseCatalogIdentifier(
	tx: DatabaseTransaction,
	reference: CatalogReference,
	actor: string,
	id: string,
	expectedRevision: number,
	input: CatalogIdentifierInput,
) {
	z.uuid().parse(id);
	CatalogRevisionNumberSchema.parse(expectedRevision);
	const values = normalizeCatalogIdentifier(input);
	await loadCatalogIdentity(tx, reference, actor, true, "share");
	if (values.issuerEntityId)
		await loadCatalogIdentity(tx, { owner: "entity", id: values.issuerEntityId }, actor, false);
	const table = CatalogNameTables[reference.owner].identifier;
	const [row] = await tx
		.update(table)
		.set({
			...values,
			revision: expectedRevision + 1,
			recordedAt: new Date(),
			recordedByAuthUserId: actor,
		})
		.where(
			and(eq(table.ownerId, reference.id), eq(table.id, id), eq(table.revision, expectedRevision)),
		)
		.returning();
	if (!row) throw new CatalogRevisionConflict("Identifier revision changed");
	return row;
}

/** @internal An archived identifier occurrence pins immutable native claim history across corrections and replay. */
export async function bindCatalogIdentifierSourceOccurrence(
	tx: DatabaseTransaction,
	reference: CatalogReference,
	actor: string,
	input: {
		sourceRecordId: string;
		snapshotId: string;
		sourcePath: string;
		identifierId: string;
		identifierRevision: number;
	},
) {
	const value = z
		.strictObject({
			sourceRecordId: z.uuid(),
			snapshotId: z.uuid(),
			sourcePath: z.string().startsWith("/").max(512),
			identifierId: z.uuid(),
			identifierRevision: CatalogRevisionNumberSchema,
		})
		.parse(input);
	await loadCatalogIdentity(tx, reference, actor, true);
	const history = CatalogNameTables[reference.owner].identifierRevision;
	const [revision] = await tx
		.select()
		.from(history)
		.where(
			and(
				eq(history.ownerId, reference.id),
				eq(history.id, value.identifierId),
				eq(history.revision, value.identifierRevision),
			),
		)
		.limit(1);
	if (!revision || revision.state !== "active")
		throw new TypeError(
			"Identifier source occurrence requires an active exact native claim revision",
		);
	const support = CatalogFactTables[reference.owner].support;
	const scope = await catalogSourceSupportColumns(tx, value.sourceRecordId);
	const rows = await tx
		.select()
		.from(support)
		.where(
			and(
				eq(support.ownerId, reference.id),
				eq(support.sourceMappingKey, scope.sourceMappingKey),
				eq(support.sourceCorrespondenceRevision, scope.sourceCorrespondenceRevision),
				eq(support.sourceRecordId, value.sourceRecordId),
				eq(support.snapshotId, value.snapshotId),
				eq(support.identifierId, value.identifierId),
				eq(support.sourcePath, value.sourcePath),
			),
		)
		.limit(2);
	if (rows.length > 1) throw new TypeError("Identifier source occurrence is ambiguous");
	const existing = rows[0];
	if (existing) {
		if (!existing.identifierRevision)
			throw new TypeError("Identifier source occurrence is missing its exact revision");
		const [original] = await tx
			.select()
			.from(history)
			.where(
				and(
					eq(history.ownerId, reference.id),
					eq(history.id, value.identifierId),
					eq(history.revision, existing.identifierRevision),
				),
			)
			.limit(1);
		const comparable = (row: typeof revision) => ({
			namespace: row.namespace,
			value: row.value,
			normalizedValue: row.normalizedValue,
			normalizationPolicy: row.normalizationPolicy,
			issuerEntityId: row.issuerEntityId,
			state: row.state,
			validationStatus: row.validationStatus,
		});
		if (!original || !isDeepStrictEqual(comparable(original), comparable(revision)))
			throw new CatalogRevisionConflict(
				"The archived identifier occurrence cannot assert another native value",
			);
		return existing;
	}
	const [created] = await tx
		.insert(support)
		.values({ ownerId: reference.id, ...scope, ...value })
		.returning();
	if (!created) throw new Error("Identifier source occurrence insertion returned no row");
	return created;
}

/** @alpha @remarks Indexed bounded history does not enumerate unrelated identifiers. */
export async function readCatalogIdentifierHistory(
	tx: DatabaseTransaction,
	reference: CatalogReference,
	actor: string | null,
	id: string,
	afterRevision = 0,
	limit = 50,
) {
	z.uuid().parse(id);
	z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).parse(afterRevision);
	CatalogPageSchema.parse({ limit });
	await loadCatalogIdentity(tx, reference, actor, false);
	const table = CatalogNameTables[reference.owner].identifierRevision;
	return tx
		.select()
		.from(table)
		.where(
			and(eq(table.ownerId, reference.id), eq(table.id, id), gt(table.revision, afterRevision)),
		)
		.orderBy(table.revision)
		.limit(limit);
}

/** @alpha @remarks Returns separately identified visible collision candidates; no native identity is merged or selected automatically. */
export async function findCatalogIdentifierClaims(
	tx: DatabaseTransaction,
	owner: CatalogOwner,
	actor: string | null,
	input: CatalogIdentifierInput,
	pageInput: { afterOwnerId?: string; afterId?: string; limit?: number } = {},
) {
	const values = normalizeCatalogIdentifier(input);
	const page = z
		.strictObject({
			afterOwnerId: z.uuid().optional(),
			afterId: z.uuid().optional(),
			limit: z.number().int().min(1).max(100).default(50),
		})
		.refine((value) => (value.afterOwnerId === undefined) === (value.afterId === undefined))
		.parse(pageInput);
	const table = CatalogNameTables[owner].identifier,
		identity = CatalogIdentityTables[owner];
	const scope = await readCatalogAuthorityScope(tx, actor);
	return tx
		.select({
			ownerId: table.ownerId,
			id: table.id,
			revision: table.revision,
			value: table.value,
			state: table.state,
		})
		.from(table)
		.innerJoin(identity, eq(identity.id, table.ownerId))
		.where(
			and(
				eq(table.namespace, values.namespace),
				eq(table.normalizedValue, values.normalizedValue),
				sql`${table.state} in ('active','disputed')`,
				catalogIdentityReadPredicate(scope, owner, identity),
				page.afterOwnerId
					? sql`(${table.ownerId},${table.id}) > (${page.afterOwnerId}::uuid,${page.afterId}::uuid)`
					: undefined,
			),
		)
		.orderBy(table.ownerId, table.id)
		.limit(page.limit);
}
