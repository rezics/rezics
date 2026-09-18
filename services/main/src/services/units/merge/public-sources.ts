import { and, desc, eq, inArray, lt, sql } from "drizzle-orm";
import type { CatalogReference } from "@rezics/reference";
import type { DatabaseTransaction } from "../../database";
import { unitMergeRequest } from "@rezics/schema/postgres/identity/unit-merge";
import { loadCatalogIdentity } from "../../catalog/storage";
import { CatalogIdentityTables } from "@rezics/schema/postgres/catalog/identity";
import {
	readCatalogAuthorityScope,
	catalogIdentityReadPredicate,
} from "../../participation/policy";
import { MergePlanSchema, MergeSourcePreviewSchema } from "./contracts";
/** Every target page can discover the exact retained source without exposing private merge operators. */
export async function listMergedCatalogSources(
	tx: DatabaseTransaction,
	target: CatalogReference,
	actor: string | null,
	input: { limit: number; cursor?: string },
) {
	await loadCatalogIdentity(tx, target, actor, false);
	const rows = await tx
		.select({
			id: unitMergeRequest.id,
			sourceUnitId: unitMergeRequest.sourceUnitId,
			sourceTitle: unitMergeRequest.sourceTitle,
			state: unitMergeRequest.state,
			plan: unitMergeRequest.plan,
			canonicalizedAt: unitMergeRequest.canonicalizedAt,
		})
		.from(unitMergeRequest)
		.where(
			and(
				eq(unitMergeRequest.targetUnitId, target.id),
				eq(unitMergeRequest.owner, target.owner),
				sql`${unitMergeRequest.canonicalizedAt} is not null`,
				input.cursor ? lt(unitMergeRequest.id, input.cursor) : undefined,
			),
		)
		.orderBy(desc(unitMergeRequest.id))
		.limit(input.limit + 1);
	const page = rows.slice(0, input.limit),
		items = [];
	const table = CatalogIdentityTables[target.owner],
		scope = await readCatalogAuthorityScope(tx, actor);
	const readableIds = new Set(
		page.length
			? (
					await tx
						.select({ id: table.id })
						.from(table)
						.where(
							and(
								inArray(
									table.id,
									page.map((row) => row.sourceUnitId),
								),
								catalogIdentityReadPredicate(scope, target.owner, table),
							),
						)
						.limit(page.length)
				).map((row) => row.id)
			: [],
	);
	for (const row of page) {
		const readable = readableIds.has(row.sourceUnitId);
		if (!row.canonicalizedAt) throw new Error("Merged source lost its canonicalization evidence");
		items.push(
			MergeSourcePreviewSchema.parse({
				requestId: row.id,
				readable,
				source: {
					owner: target.owner,
					id: row.sourceUnitId,
					title: readable ? row.sourceTitle : null,
				},
				state: row.state,
				plan: MergePlanSchema.parse(row.plan),
				canonicalizedAt: row.canonicalizedAt.toISOString(),
			}),
		);
	}
	return { items, nextCursor: rows.length > input.limit ? (page.at(-1)?.id ?? null) : null };
}
