import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import { getFeedEligibilityCondition } from "./index";

const dialect = new PgDialect();

describe("feed eligibility SQL", () => {
	it("binds multiple content ratings as scalar values", () => {
		const query = dialect.sqlToQuery(
			getFeedEligibilityCondition(
				{
					personalized: true,
					contentRatings: ["general", "r15"],
					preferredLanguages: ["zh-hant"],
				},
				{},
				new Date("2026-07-16T00:00:00.000Z"),
			),
		);

		expect(query.sql).toMatch(/"unit"\."content_rating" in \(\$\d+, \$\d+\)/);
		expect(query.sql).not.toContain("::text[]");
		expect(query.params).toEqual(expect.arrayContaining(["general", "r15"]));
	});
});
