import { sql, type SQL } from "drizzle-orm";

const reportAdvisoryLock = (key: string): SQL =>
	sql`select pg_advisory_xact_lock(hashtextextended(${key}::text, 0))`;

/** Serializes active review-case selection for one authority and Unit. */
export const contentReviewCaseAdvisoryLock = (
	authority: "platform" | "realm",
	realmId: string | null,
	unitId: string,
): SQL =>
	reportAdvisoryLock(
		authority === "platform"
			? `content-review:platform:${unitId}`
			: `content-review:${realmId}:${unitId}`,
	);

/** Serializes duplicate-report checks for one reporter without blocking other reporters. */
export const contentReviewReporterAdvisoryLock = (caseId: string, reporterProfileId: string): SQL =>
	reportAdvisoryLock(`content-review-reporter:${caseId}:${reporterProfileId}`);
