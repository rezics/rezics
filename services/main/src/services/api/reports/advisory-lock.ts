import { sql, type SQL } from "drizzle-orm";

const reportAdvisoryLock = (key: string): SQL =>
	sql`select pg_advisory_xact_lock(hashtextextended(${key}::text, 0))`;

/**
 * Builds the transaction lock that serializes platform report case creation per Unit.
 *
 * @internal
 */
export const platformUnitReportCaseAdvisoryLock = (unitId: string): SQL =>
	reportAdvisoryLock(`platform-report:${unitId}`);

/**
 * Builds the transaction lock shared by Realm report creation and Realm Unit moderation.
 *
 * @internal
 */
export const realmUnitReportCaseAdvisoryLock = (realmId: string, unitId: string): SQL =>
	reportAdvisoryLock(`${realmId}:${unitId}`);
