import { and, eq, sql, type SQLWrapper } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { CatalogOwner, CatalogReference } from "@rezics/reference";
import type { DatabaseTransaction } from "../database";
import { CatalogIdentityTables } from "../database/schema/catalog-identity";
import { unitMergeRedirect } from "../database/schema/unit-merge";
import { catalogReadRatingPredicate } from "./read-policy";
/** A retained source is readable by the canonical target's current audience, never writable through this rule. */
export function mergedCatalogReadPredicate(
	owner: CatalogOwner,
	source: {
		id: SQLWrapper;
		status: SQLWrapper;
		visibility: SQLWrapper;
		moderationStatus: SQLWrapper;
	},
	scope: { creatorAuthUserId: string | null; references: readonly CatalogReference[] },
) {
	const target = alias(CatalogIdentityTables[owner], `merged_read_${owner}`),
		ids = scope.references.filter((ref) => ref.owner === owner).map((ref) => ref.id);
	const creator =
		scope.creatorAuthUserId === null
			? sql`false`
			: sql`${target.createdByAuthUserId}=${scope.creatorAuthUserId}`;
	const granted = ids.length ? sql`${target.id}=any(${sql.param(ids)}::uuid[])` : sql`false`;
	return sql`(${source.status}='archived' and ${source.moderationStatus}='approved' and exists(
 select 1 from public.unit_merge_redirect merged_edge join public.unit_merge_request merged_request on merged_request.id=merged_edge.request_id
 join ${CatalogIdentityTables[owner]} as ${sql.identifier(`merged_read_${owner}`)} on ${target.id}=public.resolve_canonical_unit_id(merged_edge.target_unit_id)
 where merged_edge.source_unit_id=${source.id} and merged_edge.owner=${owner} and merged_request.plan->>'retainedAccess'='target_readers'
 and ${source.visibility}=merged_request.visibility_at_request and ${target.deletedAt} is null and ${catalogReadRatingPredicate(target.contentRating)}
 and ((${creator}) is true or (${granted}) is true or (${target.visibility} in ('public','unlisted') and ${target.status}='published' and ${target.moderationStatus}='approved'))
 ))`;
}
export async function hasCatalogMergeRedirect(
	tx: DatabaseTransaction,
	reference: CatalogReference,
) {
	const [row] = await tx
		.select({ id: unitMergeRedirect.sourceUnitId })
		.from(unitMergeRedirect)
		.where(
			and(
				eq(unitMergeRedirect.sourceUnitId, reference.id),
				eq(unitMergeRedirect.owner, reference.owner),
			),
		)
		.limit(1);
	return Boolean(row);
}

export const unmergedCatalogWritePredicate = (id: SQLWrapper) =>
	sql`(not exists(select 1 from public.unit_merge_redirect merged_write_guard where merged_write_guard.source_unit_id=${id})
	and not exists(select 1 from public.unit_merge_graph_lock accepted_lock
	 join public.unit_merge_operation accepted_operation on accepted_operation.id=accepted_lock.operation_id
	 where accepted_lock.unit_id=${id} and accepted_operation.source_unit_id=${id}
	 and not coalesce(accepted_operation.request_id::text=current_setting('rezics.merge_request_id',true)
	  and accepted_operation.lease_token::text=current_setting('rezics.merge_lease_token',true)
	  and accepted_operation.state='processing' and accepted_operation.lease_expires_at>clock_timestamp(),false)))`;
