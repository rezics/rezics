import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import { currentRealmRuleRevisionReadLock } from "./rule-revision-lock";

const dialect = new PgDialect();

describe("current Realm rule revision read lock", () => {
	it("uses the writer's Realm key with a shared transaction lock", () => {
		const realmId = "019b76da-a800-7300-8000-000000000003";
		const query = dialect.sqlToQuery(currentRealmRuleRevisionReadLock(realmId));

		expect(query.sql).toBe("select pg_advisory_xact_lock_shared(hashtextextended($1::text, 0))");
		expect(query.params).toEqual([realmId]);
	});
});
