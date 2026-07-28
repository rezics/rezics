import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import {
	platformUnitReportCaseAdvisoryLock,
	realmUnitReportCaseAdvisoryLock,
} from "./advisory-lock";

const dialect = new PgDialect();

describe("report advisory locks", () => {
	const realmId = "019b76da-a800-7300-8000-000000000003";
	const unitId = "019b76da-a800-7360-8000-000000000001";

	it("binds the platform case key as one explicitly typed text parameter", () => {
		const query = dialect.sqlToQuery(platformUnitReportCaseAdvisoryLock(unitId));

		expect(query.sql).toBe("select pg_advisory_xact_lock(hashtextextended($1::text, 0))");
		expect(query.params).toEqual([`platform-report:${unitId}`]);
	});

	it("binds the Realm case key as one explicitly typed text parameter", () => {
		const query = dialect.sqlToQuery(realmUnitReportCaseAdvisoryLock(realmId, unitId));

		expect(query.sql).toBe("select pg_advisory_xact_lock(hashtextextended($1::text, 0))");
		expect(query.params).toEqual([`${realmId}:${unitId}`]);
	});
});
