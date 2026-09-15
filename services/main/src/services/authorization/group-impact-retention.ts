import { sql } from "drizzle-orm";
import { database } from "../database";

/**
 * Prune one expired review in child-first pages, retaining invalidity while work remains.
 * @internal
 * @remarks Each worker tick removes at most 402 rows, including both heads. Fence tombstones survive all
 * reviews so a deleted/reinserted dependency can never reuse an observed epoch.
 */
export async function pruneExpiredGroupImpactReview(): Promise<void> {
	await database.transaction(async tx => {
		const [review] = (await tx.execute<{ id: string }>(sql`select id from public.access_group_impact_review
			where expires_at < clock_timestamp()-interval '1 day' order by expires_at,id limit 1 for update skip locked`)).rows;
		if (!review) return;
		await tx.execute(sql`update public.access_group_impact_review set status='invalidated',reason='expired'
			where id=${review.id}::uuid and status in ('discovering','complete')`);
		await tx.execute(sql`delete from public.access_group_impact_effect where id in (
			select id from public.access_group_impact_effect where review_id=${review.id}::uuid order by ordinal limit 100)`);
		await tx.execute(sql`delete from public.access_group_impact_evaluation e where e.review_id=${review.id}::uuid
			and not exists(select 1 from public.access_group_impact_effect where review_id=e.review_id)`);
		await tx.execute(sql`delete from public.access_group_impact_fact where id in (
			select id from public.access_group_impact_fact where review_id=${review.id}::uuid order by ordinal limit 100)`);
		for (const table of ["access_group_impact_witness", "access_group_impact_node"]) {
			await tx.execute(sql`delete from ${sql.identifier("public")}.${sql.identifier(table)} where (review_id,kind,key) in (
				select review_id,kind,key from ${sql.identifier("public")}.${sql.identifier(table)}
				where review_id=${review.id}::uuid order by kind,key limit 100)`);
		}
		await tx.execute(sql`delete from public.access_group_impact_review r where r.id=${review.id}::uuid
			and not exists(select 1 from public.access_group_impact_evaluation where review_id=r.id)
			and not exists(select 1 from public.access_group_impact_fact where review_id=r.id)
			and not exists(select 1 from public.access_group_impact_witness where review_id=r.id)
			and not exists(select 1 from public.access_group_impact_node where review_id=r.id)`);
	});
}
