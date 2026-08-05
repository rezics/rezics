import { sql } from "drizzle-orm";

import { database } from "../database";
import { CanonicalPgroongaIndexes } from "../database/schema/pgroonga";

const canonicalIndexNames = sql`array[${sql.join(
	CanonicalPgroongaIndexes.map((index) => sql`${index}`),
	sql`, `,
)}]::text[]`;

/** Verifies the pinned search extensions and canonical authoritative-table indexes. */
export async function checkSearch(signal: AbortSignal): Promise<boolean> {
	if (signal.aborted) return false;
	const result = await database.execute<{ ready: boolean }>(sql`
		select
			(select extversion = '4.0.8' from pg_extension where extname = 'pgroonga')
			and (select extversion = '1.0' from pg_extension where extname = 'approx_count')
			and not exists (
				select 1
				from unnest(${canonicalIndexNames}) expected(index_name)
				where not exists (
					select 1 from pg_index index_state
					join pg_class index_relation on index_relation.oid = index_state.indexrelid
					join pg_namespace index_namespace on index_namespace.oid = index_relation.relnamespace
					join pg_am access_method on access_method.oid = index_relation.relam
					where index_namespace.nspname = 'public'
						and index_relation.relname = expected.index_name
						and access_method.amname = 'pgroonga'
						and index_state.indisvalid
						and index_state.indisready
				)
			) as ready
	`);
	return result.rows[0]?.ready === true && !signal.aborted;
}
