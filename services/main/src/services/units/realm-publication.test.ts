import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import { unitRealmPublicationAdvisoryLock } from "./realm-publication";

const dialect = new PgDialect();

describe("Unit Realm publication advisory lock", () => {
	it("binds one stable Unit-Realm pair key as text", () => {
		const realmId = "019b76da-a800-7300-8000-000000000003";
		const unitId = "019b76da-a800-7360-8000-000000000001";
		const query = dialect.sqlToQuery(unitRealmPublicationAdvisoryLock(realmId, unitId));

		expect(query.sql).toBe("select pg_advisory_xact_lock(hashtextextended($1::text, 0))");
		expect(query.params).toEqual([`unit-realm-publication:${unitId}:${realmId}`]);
	});
});
