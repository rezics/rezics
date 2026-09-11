import { sql } from "drizzle-orm";
import type { DatabaseTransaction } from "../../database";

/**
 * Hold ordered resource access fences until the owning transaction ends.
 * @remarks Read-dependent commands take shared fences before native row locks;
 * grant, restriction and ownership changes take exclusive fences. Callers then
 * re-read authority using a current READ COMMITTED statement snapshot.
 * @internal
 */
export async function lockUnitAccessState(
	tx: DatabaseTransaction,
	unitIds: readonly string[],
	mode: "shared" | "exclusive" = "exclusive",
): Promise<void> {
	for (const unitId of [...new Set(unitIds)].sort()) {
		const key = `unit-access:${unitId}`;
		await tx.execute(
			mode === "shared"
				? sql`select pg_advisory_xact_lock_shared(hashtextextended(${key}::text, 0))`
				: sql`select pg_advisory_xact_lock(hashtextextended(${key}::text, 0))`,
		);
	}
}
