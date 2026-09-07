import { isDeepStrictEqual } from "node:util";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import type { DatabaseTransaction } from "../database";
import {
	CatalogProfileHistoryTables,
	CatalogProfileSourceTables,
} from "../database/schema/catalog-profile-source";
import { CatalogSourceProfileBaselines } from "../database/schema/catalog-source-owned-baseline";
import {
	EntityProfileSchema,
	ReferenceProfileSchema,
	type EntityProfileInput,
	type ReferenceProfileInput,
} from "./entity-contracts";
import { initializeEntityProfile, removeEntityProfile } from "./entities";
import { initializeReferenceProfile, removeReferenceProfile } from "./references";
import { CatalogRevisionConflict, loadCatalogIdentity } from "./storage";
import type { CatalogReference } from "./contracts";
import type { CatalogSourceNativeChange } from "./source-applications";
import { resolveCatalogSourceChildCorrespondence } from "./source-child-correspondence";

const owner = z.enum(["entity", "reference"]);
const revision = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const evidence = z.strictObject({
	sourceRecordId: z.uuid(),
	snapshotId: z.uuid(),
	sourcePath: z
		.string()
		.startsWith("/")
		.refine((value) => Buffer.byteLength(value) <= 512),
	revision,
});
export type CatalogSourceProfileChange = Extract<
	CatalogSourceNativeChange,
	{ kind: "catalog-profile" }
>;

/** Exact numeric profile head; other names, relations and identity mutations cannot reorder it. @internal */
export async function readCatalogProfileHead(
	tx: DatabaseTransaction,
	reference: CatalogReference,
	actor: string,
) {
	const type = owner.parse(reference.owner);
	await loadCatalogIdentity(tx, reference, actor, true);
	const table = CatalogProfileHistoryTables[type];
	const [head] = await tx
		.select()
		.from(table)
		.where(eq(table.ownerId, reference.id))
		.orderBy(desc(table.revision))
		.limit(1);
	return head ?? null;
}

/** Reusing the same source snapshot preserves its first immutable native occurrence across compensation cycles. @internal */
export async function bindCatalogProfileSourceOccurrence(
	tx: DatabaseTransaction,
	reference: CatalogReference,
	actor: string,
	input: z.input<typeof evidence>,
) {
	const type = owner.parse(reference.owner);
	const value = evidence.parse(input);
	await loadCatalogIdentity(tx, reference, actor, true);
	const history = CatalogProfileHistoryTables[type];
	const [current] = await tx
		.select()
		.from(history)
		.where(and(eq(history.ownerId, reference.id), eq(history.revision, value.revision)))
		.limit(1);
	if (!current || current.removed)
		throw new TypeError("Source profile occurrence requires an existing exact native profile");
	const table = CatalogProfileSourceTables[type];
	const scope = await resolveCatalogSourceChildCorrespondence(tx, value.sourceRecordId);
	await tx
		.insert(table)
		.values({ ...value, ...scope, ownerId: reference.id })
		.onConflictDoNothing();
	const [existing] = await tx
		.select()
		.from(table)
		.where(
			and(
				eq(table.sourceRecordId, value.sourceRecordId),
				eq(table.mappingKey, scope.mappingKey),
				eq(table.correspondenceRevision, scope.correspondenceRevision),
				eq(table.snapshotId, value.snapshotId),
				eq(table.ownerId, reference.id),
			),
		)
		.limit(1);
	if (!existing || existing.sourcePath !== value.sourcePath)
		throw new CatalogRevisionConflict("Source profile occurrence has another evidence scope");
	if (existing.revision !== current.revision) {
		const [original] = await tx
			.select()
			.from(history)
			.where(and(eq(history.ownerId, reference.id), eq(history.revision, existing.revision)))
			.limit(1);
		if (!original || original.removed || !isDeepStrictEqual(original.snapshot, current.snapshot))
			throw new CatalogRevisionConflict(
				"The same source profile snapshot cannot assert different native values",
			);
	}
	return existing;
}

/** Resolve source revision to its most recently compensated exact native head in one indexed lookup. @internal */
export async function resolveCatalogProfileSourceBaseline(
	tx: DatabaseTransaction,
	reference: CatalogReference,
	key: { sourceRecordId: string; mappingKey: string; correspondenceRevision?: number },
	sourceRevision: number,
) {
	const table = CatalogSourceProfileBaselines[owner.parse(reference.owner)];
	const correspondenceRevision =
		key.correspondenceRevision ??
		(await resolveCatalogSourceChildCorrespondence(tx, key.sourceRecordId)).correspondenceRevision;
	revision.parse(sourceRevision);
	const [baseline] = await tx
		.select()
		.from(table)
		.where(
			and(
				eq(table.sourceRecordId, key.sourceRecordId),
				eq(table.mappingKey, key.mappingKey),
				eq(table.correspondenceRevision, correspondenceRevision),
				eq(table.ownerId, reference.id),
			),
		)
		.limit(1);
	return baseline && baseline.sourceRevision === sourceRevision
		? baseline.currentRevision
		: sourceRevision;
}

/** A whole fixed profile has one revision fence; mappers retain any independent current fields before calling this native command. @internal */
export async function writeCatalogSourceProfile(
	tx: DatabaseTransaction,
	reference: CatalogReference,
	actor: string,
	expectedRevision: number,
	input: {
		expectedProfileRevision: number | null;
		profile: EntityProfileInput | ReferenceProfileInput | null;
		sourceRecordId: string;
		snapshotId: string;
		sourcePath: string;
	},
) {
	const type = owner.parse(reference.owner);
	const expected = revision.nullable().parse(input.expectedProfileRevision);
	const head = await readCatalogProfileHead(tx, reference, actor);
	if ((head?.revision ?? null) !== expected)
		throw new CatalogRevisionConflict("Source profile was independently changed");
	const saved =
		type === "entity"
			? input.profile === null
				? await removeEntityProfile(tx, reference, actor, expectedRevision)
				: await initializeEntityProfile(
						tx,
						reference,
						actor,
						expectedRevision,
						EntityProfileSchema.parse(input.profile),
					)
			: input.profile === null
				? await removeReferenceProfile(tx, reference, actor, expectedRevision)
				: await initializeReferenceProfile(
						tx,
						reference,
						actor,
						expectedRevision,
						ReferenceProfileSchema.parse(input.profile),
					);
	if (input.profile !== null)
		await bindCatalogProfileSourceOccurrence(tx, reference, actor, {
			sourceRecordId: input.sourceRecordId,
			snapshotId: input.snapshotId,
			sourcePath: input.sourcePath,
			revision: saved.revision,
		});
	const change: CatalogSourceProfileChange = {
		kind: "catalog-profile",
		owner: type,
		ownerId: reference.id,
		beforeRevision: expected,
		afterRevision: saved.revision,
	};
	return { ...saved, change };
}

/** Restore exact fixed values or their prior absence through the owning native commands, preserving unrelated object components. @internal */
export async function compensateCatalogProfileSourceChange(
	tx: DatabaseTransaction,
	actor: string,
	change: CatalogSourceProfileChange,
): Promise<CatalogSourceProfileChange> {
	const reference = { owner: change.owner, id: change.ownerId };
	const current = await readCatalogProfileHead(tx, reference, actor);
	if (!current || current.revision !== change.afterRevision)
		throw new CatalogRevisionConflict(
			"Source profile compensation would overwrite independent values",
		);
	const history = CatalogProfileHistoryTables[change.owner];
	const [previous] =
		change.beforeRevision === null
			? []
			: await tx
					.select()
					.from(history)
					.where(
						and(eq(history.ownerId, reference.id), eq(history.revision, change.beforeRevision)),
					)
					.limit(1);
	if (change.beforeRevision !== null && !previous)
		throw new TypeError("Profile compensation history is missing");
	const native = await loadCatalogIdentity(tx, reference, actor, true);
	const absent = !previous || previous.removed;
	const saved =
		change.owner === "entity"
			? absent
				? await removeEntityProfile(tx, reference, actor, native.revision)
				: await initializeEntityProfile(
						tx,
						reference,
						actor,
						native.revision,
						EntityProfileSchema.parse(previous.snapshot),
					)
			: absent
				? await removeReferenceProfile(tx, reference, actor, native.revision)
				: await initializeReferenceProfile(
						tx,
						reference,
						actor,
						native.revision,
						ReferenceProfileSchema.parse(previous.snapshot),
					);
	return { ...change, beforeRevision: change.afterRevision, afterRevision: saved.revision };
}
