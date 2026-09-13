import { and, eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { UnitReferenceSchema, type UnitReference } from "@rezics/reference";
import type { DatabaseExecutor } from "../database";
import { post } from "../database/schema/post";
import { catalogRoutingControl, catalogUnitLocator } from "../database/schema/catalog-identity";
import { unitOwnerTable } from "../database/schema/unit-reference-columns";

type Lock = "share" | "update" | "no key update" | "key share";
type ReadOptions = { readonly lock?: Lock; readonly includeDeleted?: boolean };

/** Reads one explicitly identified owner row. Metadata is internal; callers must apply the owning authorization policy. */
export async function readUnitState(
	executor: DatabaseExecutor,
	input: UnitReference,
	options: ReadOptions = {},
) {
	const reference = UnitReferenceSchema.parse(input);
	const table = unitOwnerTable(reference.owner);
	const query = executor
		.select({
			id: table.id,
			shape:
				reference.owner === "post"
					? post.kind
					: "shape" in table
						? table.shape
						: sql<string>`${reference.owner}`,
			status: table.status,
			visibility: table.visibility,
			contentRating: table.contentRating,
			moderationStatus: table.moderationStatus,
			aiDisclosure: "aiDisclosure" in table ? table.aiDisclosure : sql<null>`null`,
			postTargetingLocked:
				"postTargetingLocked" in table ? table.postTargetingLocked : sql<null>`null`,
			publishedAt: "publishedAt" in table ? table.publishedAt : sql<null>`null`,
			revision: table.revision,
			routingGeneration: table.routingGeneration,
			createdByAuthUserId: table.createdByAuthUserId,
			deletedAt: table.deletedAt,
			createdAt: table.createdAt,
			updatedAt: table.updatedAt,
		})
		.from(table)
		.where(
			and(eq(table.id, reference.id), options.includeDeleted ? undefined : isNull(table.deletedAt)),
		)
		.limit(1);
	const [row] = options.lock ? await query.for(options.lock) : await query;
	return row ? { ...row, reference } : null;
}

/** An ID read performs one locator seek and one concrete owner PK seek; stale routing fails closed without a whole-owner scan. */
export async function readUnitStateById(
	executor: DatabaseExecutor,
	id: string,
	options: ReadOptions = {},
) {
	z.uuid().parse(id);
	const [control] = await executor
		.select({ ready: catalogRoutingControl.ready })
		.from(catalogRoutingControl)
		.where(eq(catalogRoutingControl.singleton, true))
		.limit(1);
	if (!control?.ready) return null;
	const [route] = await executor
		.select()
		.from(catalogUnitLocator)
		.where(eq(catalogUnitLocator.id, id))
		.limit(1);
	if (!route) return null;
	const row = await readUnitState(executor, { owner: route.owner, id }, options);
	return row?.routingGeneration === route.generation ? row : null;
}

export type UnitState = NonNullable<Awaited<ReturnType<typeof readUnitState>>>;
