import { sql } from "drizzle-orm";

import { database } from "../database";

/** Verifies the pinned search extensions and canonical authoritative-table indexes. */
export async function checkSearch(signal: AbortSignal): Promise<boolean> {
	if (signal.aborted) return false;
	const result = await database.execute<{ ready: boolean }>(sql`
		select
			(select extversion = '4.0.8' from pg_extension where extname = 'pgroonga')
			and (select extversion = '1.0' from pg_extension where extname = 'approx_count')
			and not exists (
				select 1
				from unnest(array[
					'unit_localization_pgroonga_metadata_idx',
					'unit_localization_pgroonga_content_idx'
				]) expected(index_name)
				where not exists (
					select 1 from pg_index index_state
					join pg_class index_relation on index_relation.oid = index_state.indexrelid
					where index_relation.relname = expected.index_name
						and index_state.indisvalid
						and index_state.indisready
				)
			) as ready
	`);
	return result.rows[0]?.ready === true && !signal.aborted;
}
