import { and, eq, gt, sql } from "drizzle-orm";
import { z } from "zod";
import type { DatabaseTransaction } from "../database";
import { CatalogNameTables } from "../database/schema/catalog-names";
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
				sql`${identity.deletedAt} is null and ((${identity.createdByAuthUserId} = ${actor}::uuid) is true or (${identity.visibility} in ('public','unlisted') and ${identity.status} = 'published' and ${identity.moderationStatus} = 'approved'))`,
				page.afterOwnerId
					? sql`(${table.ownerId},${table.id}) > (${page.afterOwnerId}::uuid,${page.afterId}::uuid)`
					: undefined,
			),
		)
		.orderBy(table.ownerId, table.id)
		.limit(page.limit);
}
