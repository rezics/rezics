import { and, eq, gt, inArray, or } from "drizzle-orm";
import { z } from "zod";
import type { DatabaseTransaction } from "../database";
import {
	groupingClassAssignment,
	groupingOrderEntry,
	groupingOrderProfile,
	groupingCommandRevision,
} from "../database/schema/catalog-grouping";
import { groupingCatalogRelation } from "../database/schema/catalog-facts";
import { isFractionalPosition } from "../ordering/position";
import type { CatalogReference } from "./contracts";
import {
	addCatalogName,
	createCatalogIdentity,
	loadCatalogIdentity,
	readableRelation,
	recordCatalogChange,
	CatalogReferenceNotFound,
} from "./storage";
import { NativeCatalogNameSchema } from "./entity-contracts";
import { requireProfileDefinition } from "./entities";
import { currentCatalogSemanticState } from "./semantic-history";

const groupingReferenceSchema = z.strictObject({ owner: z.literal("grouping"), id: z.uuid() });
const orderKeySchema = z
	.string()
	.min(1)
	.refine((value) => Buffer.byteLength(value, "utf8") <= 160);
export const GroupingCommandSnapshotSchema = z.discriminatedUnion("operation", [
	z.strictObject({ operation: z.literal("class.assign"), classRevisionId: z.uuid() }),
	z.strictObject({ operation: z.literal("class.remove"), classRevisionId: z.uuid() }),
	z.strictObject({
		operation: z.literal("order.create"),
		profileId: z.uuid(),
		key: orderKeySchema,
	}),
	z.strictObject({
		operation: z.literal("order.rename"),
		profileId: z.uuid(),
		key: orderKeySchema,
	}),
	z.strictObject({
		operation: z.literal("order.set"),
		profileId: z.uuid(),
		relationId: z.uuid(),
		position: z.string().refine(isFractionalPosition),
		sourcePosition: z.string().optional(),
	}),
	z.strictObject({
		operation: z.literal("order.remove"),
		profileId: z.uuid(),
		relationId: z.uuid(),
	}),
]);

/** @alpha @remarks Class definitions distinguish universe, franchise, series and continuity without source identity. */
export async function createGrouping(
	tx: DatabaseTransaction,
	actor: string,
	input: { name: z.input<typeof NativeCatalogNameSchema>; classes?: readonly string[] },
) {
	const value = z
		.strictObject({
			name: NativeCatalogNameSchema,
			classes: z.array(z.uuid()).max(128).default([]),
		})
		.parse(input);
	for (const id of value.classes) await requireProfileDefinition(tx, id, ["class"]);
	const identity = await createCatalogIdentity(tx, { owner: "grouping", shape: "grouping" }, actor);
	const name = await addCatalogName(tx, identity, actor, identity.revision, {
		...value.name,
		kind: "primary",
	});
	let revision = name.revision;
	for (const id of value.classes)
		revision = (await assignGroupingClass(tx, identity, actor, revision, id)).revision;
	return { ...identity, revision, nameId: name.id };
}

export async function assignGroupingClass(
	tx: DatabaseTransaction,
	reference: CatalogReference,
	actor: string,
	expectedVersion: number,
	classRevisionId: string,
) {
	const ref = groupingReferenceSchema.parse({ owner: reference.owner, id: reference.id });
	z.uuid().parse(classRevisionId);
	await requireProfileDefinition(tx, classRevisionId, ["class"]);
	const revision = await recordCatalogChange(
		tx,
		ref,
		actor,
		expectedVersion,
		"grouping.class.assign",
	);
	await tx
		.insert(groupingClassAssignment)
		.values({ groupingId: ref.id, classRevisionId })
		.onConflictDoNothing();
	await tx.insert(groupingCommandRevision).values({
		ownerId: ref.id,
		revision,
		snapshot: { operation: "class.assign", classRevisionId },
	});
	return { revision };
}

export async function createGroupingOrderProfile(
	tx: DatabaseTransaction,
	reference: CatalogReference,
	actor: string,
	expectedVersion: number,
	key: string,
) {
	const ref = groupingReferenceSchema.parse({ owner: reference.owner, id: reference.id });
	z.string()
		.min(1)
		.refine((value) => Buffer.byteLength(value, "utf8") <= 160)
		.parse(key);
	const revision = await recordCatalogChange(
		tx,
		ref,
		actor,
		expectedVersion,
		"grouping.order.create",
	);
	const [profile] = await tx
		.insert(groupingOrderProfile)
		.values({ ownerId: ref.id, key })
		.returning({ id: groupingOrderProfile.id });
	if (!profile) throw new Error("Grouping order profile insertion returned no row");
	await tx.insert(groupingCommandRevision).values({
		ownerId: ref.id,
		revision,
		snapshot: { operation: "order.create", profileId: profile.id, key },
	});
	return { id: profile.id, revision };
}

export async function orderGroupingRelation(
	tx: DatabaseTransaction,
	reference: CatalogReference,
	actor: string,
	expectedVersion: number,
	input: {
		readonly profileId: string;
		readonly relationId: string;
		readonly position: string;
		readonly sourcePosition?: string;
	},
) {
	const ref = groupingReferenceSchema.parse({ owner: reference.owner, id: reference.id });
	const value = z
		.strictObject({
			profileId: z.uuid(),
			relationId: z.uuid(),
			position: z.string().refine(isFractionalPosition),
			sourcePosition: z
				.string()
				.refine((value) => Buffer.byteLength(value, "utf8") <= 4096)
				.optional(),
		})
		.parse(input);
	await loadCatalogIdentity(tx, ref, actor, true);
	const [relation] = await tx
		.select({ id: groupingCatalogRelation.id })
		.from(groupingCatalogRelation)
		.where(
			and(
				eq(groupingCatalogRelation.ownerId, ref.id),
				eq(groupingCatalogRelation.id, value.relationId),
				eq(currentCatalogSemanticState(ref, "relation"), "active"),
				await readableRelation(tx, ref, actor),
			),
		)
		.limit(1);
	if (!relation)
		throw new CatalogReferenceNotFound("Only an active readable membership can be ordered");
	const revision = await recordCatalogChange(tx, ref, actor, expectedVersion, "grouping.order.set");
	await tx
		.insert(groupingOrderEntry)
		.values({ ownerId: ref.id, ...value })
		.onConflictDoUpdate({
			target: [
				groupingOrderEntry.ownerId,
				groupingOrderEntry.profileId,
				groupingOrderEntry.relationId,
			],
			set: { position: value.position, sourcePosition: value.sourcePosition ?? null },
		});
	await tx
		.insert(groupingCommandRevision)
		.values({ ownerId: ref.id, revision, snapshot: { operation: "order.set", ...value } });
	return { revision };
}

export async function readGroupingOrder(
	tx: DatabaseTransaction,
	reference: CatalogReference,
	actor: string | null,
	profileId: string,
	input: {
		readonly limit?: number;
		readonly after?: { readonly position: string; readonly relationId: string };
		readonly maxSpoiler?: 0 | 1 | 2;
	} = {},
) {
	const ref = groupingReferenceSchema.parse({ owner: reference.owner, id: reference.id });
	await loadCatalogIdentity(tx, ref, actor, false);
	z.uuid().parse(profileId);
	const page = z
		.strictObject({
			limit: z.number().int().min(1).max(100).default(50),
			maxSpoiler: z.union([z.literal(0), z.literal(1), z.literal(2)]).default(0),
			after: z
				.strictObject({ position: z.string().refine(isFractionalPosition), relationId: z.uuid() })
				.optional(),
		})
		.parse(input);
	const table = groupingOrderEntry;
	// Page the ordered candidates before visibility checks so sparse private or
	// withdrawn memberships cannot turn one request into a whole-group scan.
	const candidates = await tx
		.select({
			relationId: table.relationId,
			position: table.position,
			sourcePosition: table.sourcePosition,
		})
		.from(table)
		.where(
			and(
				eq(table.ownerId, ref.id),
				eq(table.profileId, profileId),
				page.after
					? or(
							gt(table.position, page.after.position),
							and(
								eq(table.position, page.after.position),
								gt(table.relationId, page.after.relationId),
							),
						)
					: undefined,
			),
		)
		.orderBy(table.position, table.relationId)
		.limit(page.limit);
	const visible = candidates.length ? await tx.select({ id: groupingCatalogRelation.id })
		.from(groupingCatalogRelation).where(and(eq(groupingCatalogRelation.ownerId, ref.id),
			inArray(groupingCatalogRelation.id, candidates.map(row => row.relationId)),
			eq(currentCatalogSemanticState(ref, "relation"), "active"),
			await readableRelation(tx, ref, actor, page.maxSpoiler),
		)).limit(candidates.length) : [];
	const visibleIds = new Set(visible.map(row => row.id));
	const last = candidates.at(-1);
	return { items: candidates.filter(row => visibleIds.has(row.relationId)),
		after: candidates.length === page.limit && last ? { position: last.position, relationId: last.relationId } : null };
}

/** @alpha @remarks Classification removal changes no memberships, reading progress or source assertions. */
export async function removeGroupingClass(
	tx: DatabaseTransaction,
	reference: CatalogReference,
	actor: string,
	expectedVersion: number,
	classRevisionId: string,
) {
	const ref = groupingReferenceSchema.parse({ owner: reference.owner, id: reference.id });
	z.uuid().parse(classRevisionId);
	const revision = await recordCatalogChange(
		tx,
		ref,
		actor,
		expectedVersion,
		"grouping.class.remove",
	);
	await tx
		.delete(groupingClassAssignment)
		.where(
			and(
				eq(groupingClassAssignment.groupingId, ref.id),
				eq(groupingClassAssignment.classRevisionId, classRevisionId),
			),
		);
	await tx.insert(groupingCommandRevision).values({
		ownerId: ref.id,
		revision,
		snapshot: { operation: "class.remove", classRevisionId },
	});
	return { revision };
}

/** @alpha @remarks Separate class and profile pages avoid loading any memberships during a grouping read. */
export async function readGroupingClasses(
	tx: DatabaseTransaction,
	reference: CatalogReference,
	actor: string | null,
	input: { afterId?: string; limit?: number } = {},
) {
	const ref = groupingReferenceSchema.parse({ owner: reference.owner, id: reference.id });
	await loadCatalogIdentity(tx, ref, actor, false);
	const page = z
		.strictObject({
			afterId: z.uuid().optional(),
			limit: z.number().int().min(1).max(100).default(50),
		})
		.parse(input);
	const table = groupingClassAssignment;
	return tx
		.select()
		.from(table)
		.where(
			and(
				eq(table.groupingId, ref.id),
				page.afterId ? gt(table.classRevisionId, page.afterId) : undefined,
			),
		)
		.orderBy(table.classRevisionId)
		.limit(page.limit);
}

/** @alpha @remarks Named orders remain independent; no source or chronology order is implicitly preferred. */
export async function readGroupingOrderProfiles(
	tx: DatabaseTransaction,
	reference: CatalogReference,
	actor: string | null,
	input: { afterId?: string; limit?: number } = {},
) {
	const ref = groupingReferenceSchema.parse({ owner: reference.owner, id: reference.id });
	await loadCatalogIdentity(tx, ref, actor, false);
	const page = z
		.strictObject({
			afterId: z.uuid().optional(),
			limit: z.number().int().min(1).max(100).default(50),
		})
		.parse(input);
	const table = groupingOrderProfile;
	return tx
		.select()
		.from(table)
		.where(and(eq(table.ownerId, ref.id), page.afterId ? gt(table.id, page.afterId) : undefined))
		.orderBy(table.id)
		.limit(page.limit);
}

/** @alpha @remarks An order entry is removable without withdrawing the underlying semantic membership. */
export async function removeGroupingOrderEntry(
	tx: DatabaseTransaction,
	reference: CatalogReference,
	actor: string,
	expectedVersion: number,
	input: { profileId: string; relationId: string },
) {
	const ref = groupingReferenceSchema.parse({ owner: reference.owner, id: reference.id });
	const value = z.strictObject({ profileId: z.uuid(), relationId: z.uuid() }).parse(input);
	const revision = await recordCatalogChange(
		tx,
		ref,
		actor,
		expectedVersion,
		"grouping.order.remove",
	);
	const table = groupingOrderEntry;
	await tx
		.delete(table)
		.where(
			and(
				eq(table.ownerId, ref.id),
				eq(table.profileId, value.profileId),
				eq(table.relationId, value.relationId),
			),
		);
	await tx
		.insert(groupingCommandRevision)
		.values({ ownerId: ref.id, revision, snapshot: { operation: "order.remove", ...value } });
	return { revision };
}

/** @alpha @remarks Stable profile IDs retain historical entry references across renames. */
export async function renameGroupingOrderProfile(
	tx: DatabaseTransaction,
	reference: CatalogReference,
	actor: string,
	expectedVersion: number,
	profileId: string,
	key: string,
) {
	const ref = groupingReferenceSchema.parse({ owner: reference.owner, id: reference.id });
	z.uuid().parse(profileId);
	orderKeySchema.parse(key);
	const revision = await recordCatalogChange(
		tx,
		ref,
		actor,
		expectedVersion,
		"grouping.order.rename",
	);
	const table = groupingOrderProfile;
	const [row] = await tx
		.update(table)
		.set({ key })
		.where(and(eq(table.ownerId, ref.id), eq(table.id, profileId)))
		.returning({ id: table.id });
	if (!row) throw new CatalogReferenceNotFound("Grouping order profile is missing");
	await tx
		.insert(groupingCommandRevision)
		.values({ ownerId: ref.id, revision, snapshot: { operation: "order.rename", profileId, key } });
	return { revision };
}

/** @alpha @remarks Owner-keyset history contains only local class/order commands, never the full collection. */
export async function readGroupingHistory(
	tx: DatabaseTransaction,
	reference: CatalogReference,
	actor: string | null,
	input: { afterRevision?: number; limit?: number } = {},
) {
	const ref = groupingReferenceSchema.parse({ owner: reference.owner, id: reference.id });
	await loadCatalogIdentity(tx, ref, actor, false);
	const page = z
		.strictObject({
			afterRevision: z.number().int().positive().max(Number.MAX_SAFE_INTEGER).optional(),
			limit: z.number().int().min(1).max(100).default(50),
		})
		.parse(input);
	const table = groupingCommandRevision;
	const rows = await tx
		.select()
		.from(table)
		.where(
			and(
				eq(table.ownerId, ref.id),
				page.afterRevision ? gt(table.revision, page.afterRevision) : undefined,
			),
		)
		.orderBy(table.revision)
		.limit(page.limit);
	return rows.map((row) => ({ ...row, snapshot: GroupingCommandSnapshotSchema.parse(row.snapshot) }));
}

/** @alpha @remarks Reapply one historical command as a new authorized edit; retired relations cannot be revived. */
export async function restoreGroupingCommand(
	tx: DatabaseTransaction,
	reference: CatalogReference,
	actor: string,
	expectedVersion: number,
	revision: number,
) {
	const ref = groupingReferenceSchema.parse({ owner: reference.owner, id: reference.id });
	z.number().int().positive().max(Number.MAX_SAFE_INTEGER).parse(revision);
	await loadCatalogIdentity(tx, ref, actor, true);
	const table = groupingCommandRevision;
	const [row] = await tx
		.select()
		.from(table)
		.where(and(eq(table.ownerId, ref.id), eq(table.revision, revision)))
		.limit(1);
	if (!row) throw new CatalogReferenceNotFound("Grouping command revision is missing");
	const snapshot = GroupingCommandSnapshotSchema.parse(row.snapshot);
	switch (snapshot.operation) {
		case "class.assign":
			return assignGroupingClass(tx, ref, actor, expectedVersion, snapshot.classRevisionId);
		case "class.remove":
			return removeGroupingClass(tx, ref, actor, expectedVersion, snapshot.classRevisionId);
		case "order.create":
		case "order.rename":
			return renameGroupingOrderProfile(
				tx,
				ref,
				actor,
				expectedVersion,
				snapshot.profileId,
				snapshot.key,
			);
		case "order.remove":
			return removeGroupingOrderEntry(tx, ref, actor, expectedVersion, {
				profileId: snapshot.profileId,
				relationId: snapshot.relationId,
			});
		case "order.set":
			return orderGroupingRelation(tx, ref, actor, expectedVersion, {
				profileId: snapshot.profileId,
				relationId: snapshot.relationId,
				position: snapshot.position,
				...(snapshot.sourcePosition === undefined
					? {}
					: { sourcePosition: snapshot.sourcePosition }),
			});
	}
}
