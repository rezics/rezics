import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import { contentReviewCaseAdvisoryLock, contentReviewReporterAdvisoryLock } from "./advisory-lock";

const dialect = new PgDialect();

describe("report advisory locks", () => {
	const realmId = "019b76da-a800-7300-8000-000000000003";
	const unitId = "019b76da-a800-7360-8000-000000000001";

	it("binds the platform case key as one explicitly typed text parameter", () => {
		const query = dialect.sqlToQuery(contentReviewCaseAdvisoryLock("platform", null, unitId));

		expect(query.sql).toBe("select pg_advisory_xact_lock(hashtextextended($1::text, 0))");
		expect(query.params).toEqual([`content-review:platform:${unitId}`]);
	});

	it("binds the Realm case key as one explicitly typed text parameter", () => {
		const query = dialect.sqlToQuery(contentReviewCaseAdvisoryLock("realm", realmId, unitId));

		expect(query.sql).toBe("select pg_advisory_xact_lock(hashtextextended($1::text, 0))");
		expect(query.params).toEqual([`content-review:${realmId}:${unitId}`]);
	});

	it("scopes duplicate protection to one case and reporter", () => {
		const reporterId = "019b76da-a800-7360-8000-000000000002";
		const caseId = "019b76da-a800-7360-8000-000000000004";
		const query = dialect.sqlToQuery(contentReviewReporterAdvisoryLock(caseId, reporterId));

		expect(query.sql).toBe("select pg_advisory_xact_lock(hashtextextended($1::text, 0))");
		expect(query.params).toEqual([`content-review-reporter:${caseId}:${reporterId}`]);
	});
});
