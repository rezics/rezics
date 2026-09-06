import { and, eq, gt, or } from "drizzle-orm";
import { z } from "zod";
import type { DatabaseTransaction } from "../database";
import {
	groupingClassAssignment,
	groupingOrderEntry,
	groupingOrderProfile,
} from "../database/schema/catalog-grouping";
import { groupingCatalogRelation } from "../database/schema/catalog-facts";
import { isFractionalPosition } from "../ordering/position";
import type { CatalogReference } from "./contracts";
import { loadCatalogIdentity, readableRelation, recordCatalogChange } from "./storage";

const groupingReferenceSchema = z.strictObject({ owner: z.literal("grouping"), id: z.uuid() });

export async function assignGroupingClass(
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
		"grouping.class.assign",
	);
	await tx
		.insert(groupingClassAssignment)
		.values({ groupingId: ref.id, classRevisionId })
		.onConflictDoNothing();
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
			sourcePosition: z.string().optional(),
		})
		.parse(input);
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
	} = {},
) {
	const ref = groupingReferenceSchema.parse({ owner: reference.owner, id: reference.id });
	await loadCatalogIdentity(tx, ref, actor, false);
	z.uuid().parse(profileId);
	const page = z
		.strictObject({
			limit: z.number().int().min(1).max(100).default(50),
			after: z
				.strictObject({ position: z.string().refine(isFractionalPosition), relationId: z.uuid() })
				.optional(),
		})
		.parse(input);
	const table = groupingOrderEntry;
	return tx
		.select({
			relationId: table.relationId,
			position: table.position,
			sourcePosition: table.sourcePosition,
		})
		.from(table)
		.innerJoin(
			groupingCatalogRelation,
			and(
				eq(groupingCatalogRelation.ownerId, table.ownerId),
				eq(groupingCatalogRelation.id, table.relationId),
			),
		)
		.where(
			and(
				eq(table.ownerId, ref.id),
				eq(table.profileId, profileId),
				eq(groupingCatalogRelation.state, "active"),
				readableRelation(ref, actor),
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
}
