import { sql, type SQL } from "drizzle-orm";

/**
 * Stabilizes the current rule revision without serializing concurrent readers.
 * Realm rule publication takes the matching exclusive transaction-level lock.
 */
export const currentRealmRuleRevisionReadLock = (realmId: string): SQL =>
	sql`select pg_advisory_xact_lock_shared(hashtextextended(${realmId}::text, 0))`;
