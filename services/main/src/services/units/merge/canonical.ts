import { sql } from "drizzle-orm";

import type { DatabaseExecutor } from "../../database";

/** Resolves one immutable Unit identity through the bounded redirect chain. */
export async function resolveCanonicalUnitId(
	executor: DatabaseExecutor,
	unitId: string,
): Promise<string> {
	const result = await executor.execute<{ canonicalUnitId: string }>(
		sql`select public.resolve_canonical_unit_id(${unitId}::uuid) as "canonicalUnitId"`,
	);
	return result.rows[0]?.canonicalUnitId ?? unitId;
}

export async function resolveCanonicalUnitIds(
	executor: DatabaseExecutor,
	unitIds: readonly string[],
): Promise<ReadonlyMap<string, string>> {
	const ids = [...new Set(unitIds)];
	if (!ids.length) return new Map();
	const result = await executor.execute<{ sourceUnitId: string; canonicalUnitId: string }>(sql`
		select source_id as "sourceUnitId",
			public.resolve_canonical_unit_id(source_id) as "canonicalUnitId"
		from unnest(${ids}::uuid[]) as source(source_id)
	`);
	return new Map(result.rows.map((row) => [row.sourceUnitId, row.canonicalUnitId]));
}
