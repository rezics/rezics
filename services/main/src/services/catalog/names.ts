import { catalogSourcePath } from "./source-document-scope";
import { resolveCatalogSourceChildCorrespondence } from "./source-child-correspondence";
import { and, eq, gt } from "drizzle-orm";
import { z } from "zod";
import type { DatabaseTransaction } from "../database";
import { CatalogNameTables } from "@rezics/schema/postgres/knowledge/names";
import {
	CatalogNameValuesSchema,
	CatalogRevisionNumberSchema,
	type CatalogNameInput,
} from "@rezics/schema/contracts/native/names";
import { CatalogPageSchema, type CatalogReference } from "@rezics/schema/contracts/native/catalog";
import {
	CatalogReferenceNotFound,
	CatalogRevisionConflict,
	loadCatalogIdentity,
	recordCatalogChange,
} from "./storage";

async function validateNameScope(
	tx: DatabaseTransaction,
	reference: CatalogReference,
	actor: string,
	values: z.output<typeof CatalogNameValuesSchema>,
) {
	if (values.scopeOwnerId)
		await loadCatalogIdentity(
			tx,
			{ owner: reference.owner, id: values.scopeOwnerId },
			actor,
			false,
		);
	if (values.derivationNameId) {
		const table = CatalogNameTables[reference.owner].nameRevision;
		const [source] = await tx
			.select({ id: table.id })
			.from(table)
			.where(
				and(
					eq(table.ownerId, reference.id),
					eq(table.id, values.derivationNameId),
					eq(table.revision, values.derivationRevision!),
				),
			)
			.limit(1);
		if (!source) throw new CatalogReferenceNotFound("Named-form derivation revision is missing");
	}
}

/** @alpha @remarks Creates an independently identified name and complete first revision under catalog write policy. */
export async function addCatalogName(
	tx: DatabaseTransaction,
	reference: CatalogReference,
	actor: string,
	expectedVersion: number,
	input: CatalogNameInput,
) {
	const values = CatalogNameValuesSchema.parse(input);
	await validateNameScope(tx, reference, actor, values);
	const revision = await recordCatalogChange(tx, reference, actor, expectedVersion, "name.add");
	const table = CatalogNameTables[reference.owner].name;
	const [row] = await tx
		.insert(table)
		.values({ ...values, ownerId: reference.id, recordedByAuthUserId: actor })
		.returning({ id: table.id, nameRevision: table.revision });
	if (!row) throw new Error("Catalog name insertion returned no row");
	return { ...row, revision };
}

/** @alpha @remarks Appends a complete revision. Withdrawal/restoration set state without destroying history or extending old authority. */
export async function reviseCatalogName(
	tx: DatabaseTransaction,
	reference: CatalogReference,
	actor: string,
	nameId: string,
	expectedRevision: number,
	input: CatalogNameInput,
) {
	z.uuid().parse(nameId);
	CatalogRevisionNumberSchema.parse(expectedRevision);
	const values = CatalogNameValuesSchema.parse(input);
	await loadCatalogIdentity(tx, reference, actor, true, "share");
	await validateNameScope(tx, reference, actor, values);
	const table = CatalogNameTables[reference.owner].name;
	const [row] = await tx
		.update(table)
		.set({
			...values,
			revision: expectedRevision + 1,
			recordedAt: new Date(),
			recordedByAuthUserId: actor,
		})
		.where(
			and(
				eq(table.ownerId, reference.id),
				eq(table.id, nameId),
				eq(table.revision, expectedRevision),
			),
		)
		.returning();
	if (!row) throw new CatalogRevisionConflict("Named-form revision changed");
	return row;
}

/** @alpha @remarks Bounded immutable history is protected by the catalog owner's read policy. */
export async function readCatalogNameHistory(
	tx: DatabaseTransaction,
	reference: CatalogReference,
	actor: string | null,
	nameId: string,
	afterRevision = 0,
	limit = 50,
) {
	z.uuid().parse(nameId);
	z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).parse(afterRevision);
	CatalogPageSchema.parse({ limit });
	await loadCatalogIdentity(tx, reference, actor, false);
	const table = CatalogNameTables[reference.owner].nameRevision;
	return tx
		.select()
		.from(table)
		.where(
			and(eq(table.ownerId, reference.id), eq(table.id, nameId), gt(table.revision, afterRevision)),
		)
		.orderBy(table.revision)
		.limit(limit);
}

/** @alpha @remarks Pins a readable current or historical named form for a credit; text equality never resolves identity. */
export async function requireCatalogNameRevision(
	tx: DatabaseTransaction,
	reference: CatalogReference,
	actor: string | null,
	nameId: string,
	revision: number,
) {
	z.uuid().parse(nameId);
	CatalogRevisionNumberSchema.parse(revision);
	await loadCatalogIdentity(tx, reference, actor, false);
	const table = CatalogNameTables[reference.owner].nameRevision;
	const [row] = await tx
		.select()
		.from(table)
		.where(and(eq(table.ownerId, reference.id), eq(table.id, nameId), eq(table.revision, revision)))
		.limit(1);
	if (!row) throw new CatalogReferenceNotFound("Named-form revision is missing");
	return row;
}

const sourceBindingKeySchema = z.strictObject({
	sourceRecordId: z.uuid(),
	namespace: z
		.string()
		.min(1)
		.max(96)
		.refine((value) => Buffer.byteLength(value) <= 96),
	localKey: z
		.string()
		.min(1)
		.max(512)
		.refine((value) => Buffer.byteLength(value) <= 512),
});
const sourceOccurrenceSchema = sourceBindingKeySchema.extend({
	nameId: z.uuid(),
	nameRevision: CatalogRevisionNumberSchema,
	snapshotId: z.uuid(),
	sourcePath: z
		.string()
		.min(1)
		.max(4096)
		.refine((value) => Buffer.byteLength(value) <= 4096),
});

/** @alpha @remarks Binds source-local aliases such as staff aid without treating their spelling as identity. */
export async function bindCatalogNameSourceOccurrence(
	tx: DatabaseTransaction,
	reference: CatalogReference,
	actor: string,
	input: z.input<typeof sourceOccurrenceSchema>,
) {
	const value = sourceOccurrenceSchema.parse(input);
	value.sourcePath = catalogSourcePath(value.sourceRecordId, value.snapshotId, value.sourcePath);
	const scope = await resolveCatalogSourceChildCorrespondence(tx, value.sourceRecordId);
	await loadCatalogIdentity(tx, reference, actor, true, "share");
	await requireCatalogNameRevision(tx, reference, actor, value.nameId, value.nameRevision);
	const { sourceBinding: binding, sourceOccurrence: occurrence } =
		CatalogNameTables[reference.owner];
	await tx
		.insert(binding)
		.values({
			ownerId: reference.id,
			...scope,
			sourceRecordId: value.sourceRecordId,
			namespace: value.namespace,
			localKey: value.localKey,
			nameId: value.nameId,
		})
		.onConflictDoNothing();
	const [bound] = await tx
		.select()
		.from(binding)
		.where(
			and(
				eq(binding.sourceRecordId, value.sourceRecordId),
				eq(binding.mappingKey, scope.mappingKey),
				eq(binding.correspondenceRevision, scope.correspondenceRevision),
				eq(binding.ownerId, reference.id),
				eq(binding.namespace, value.namespace),
				eq(binding.localKey, value.localKey),
			),
		)
		.limit(1);
	if (!bound || bound.ownerId !== reference.id || bound.nameId !== value.nameId)
		throw new CatalogRevisionConflict("Source alias is bound to a different named-form identity");
	await tx
		.insert(occurrence)
		.values({ ...value, ...scope, ownerId: reference.id })
		.onConflictDoNothing();
	const [observed] = await tx
		.select()
		.from(occurrence)
		.where(
			and(
				eq(occurrence.sourceRecordId, value.sourceRecordId),
				eq(occurrence.mappingKey, scope.mappingKey),
				eq(occurrence.correspondenceRevision, scope.correspondenceRevision),
				eq(occurrence.ownerId, reference.id),
				eq(occurrence.namespace, value.namespace),
				eq(occurrence.localKey, value.localKey),
				eq(occurrence.snapshotId, value.snapshotId),
			),
		)
		.limit(1);
	if (
		!observed ||
		observed.nameId !== value.nameId ||
		observed.nameRevision !== value.nameRevision ||
		observed.sourcePath !== value.sourcePath
	)
		throw new CatalogRevisionConflict(
			"Source alias snapshot already has different immutable evidence",
		);
	return observed;
}

/** @alpha @remarks Resolves only an explicit source key; absence remains unresolved and names are never guessed. */
export async function resolveCatalogNameSourceBinding(
	tx: DatabaseTransaction,
	reference: CatalogReference,
	actor: string | null,
	input: z.input<typeof sourceBindingKeySchema>,
) {
	const value = sourceBindingKeySchema.parse(input);
	const scope = await resolveCatalogSourceChildCorrespondence(tx, value.sourceRecordId);
	await loadCatalogIdentity(tx, reference, actor, false);
	const { sourceBinding: binding, name } = CatalogNameTables[reference.owner];
	const [row] = await tx
		.select({ nameId: name.id, nameRevision: name.revision })
		.from(binding)
		.innerJoin(name, and(eq(name.ownerId, binding.ownerId), eq(name.id, binding.nameId)))
		.where(
			and(
				eq(binding.ownerId, reference.id),
				eq(binding.sourceRecordId, value.sourceRecordId),
				eq(binding.mappingKey, scope.mappingKey),
				eq(binding.correspondenceRevision, scope.correspondenceRevision),
				eq(binding.ownerId, reference.id),
				eq(binding.namespace, value.namespace),
				eq(binding.localKey, value.localKey),
			),
		)
		.limit(1);
	return row ?? null;
}
