import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import { realm } from "../../database/schema";
import { getRealmParticipationCondition } from "./query";

const ProfileId = "01900000-0000-7000-8000-000000000001";

describe("getRealmParticipationCondition", () => {
	it("compiles the complete participation decision into one SQL predicate", () => {
		const condition = getRealmParticipationCondition(ProfileId, realm);
		expect(condition).toBeDefined();
		if (!condition) throw new Error("Realm participation condition was not constructed");
		const query = new PgDialect().sqlToQuery(condition);

		expect(query.sql).toContain('"current_realm_entity_membership"');
		expect(query.sql).not.toContain('"realm_member"');
		expect(query.sql).toContain("public.realm_enforcement");
		expect(query.sql).toContain("e.state in ('muted','banned')");
		expect(query.sql).toContain('"unit_access_grant"');
		expect(query.sql).toContain('"unit_access_restriction"');
		expect(query.sql).toContain('"platform_capability_grant"');
		expect(query.params).toEqual(
			expect.arrayContaining([ProfileId, "active", "realm.contribute", "unit.edit"]),
		);
	});
});
