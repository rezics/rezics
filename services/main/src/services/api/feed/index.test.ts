import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import {
	getFeedEligibilityCondition,
	prioritizeFeedRealmContexts,
	resolveFeedContentSelection,
} from "./index";

const dialect = new PgDialect();

describe("feed eligibility SQL", () => {
	it("defaults to feedable Units and Post kinds without replies", () => {
		const selection = resolveFeedContentSelection();

		expect(selection.unitKinds).toContain("book");
		expect(selection.postKinds).toContain("post");
		expect(selection.postKinds).not.toContain("reply");
		expect(selection.selected).not.toContain("post:reply");
	});

	it("keeps supported replies available when explicitly selected", () => {
		expect(resolveFeedContentSelection(["post:reply"])).toEqual({
			selected: ["post:reply"],
			unitKinds: [],
			postKinds: ["reply"],
		});
	});

	it("normalizes content selections into the contract order", () => {
		expect(resolveFeedContentSelection(["post:reply", "unit:book"]).selected).toEqual([
			"unit:book",
			"post:reply",
		]);
	});

	it("binds multiple content ratings as scalar values", () => {
		const query = dialect.sqlToQuery(
			getFeedEligibilityCondition(
				{
					personalized: true,
					contentRatings: ["general", "r15"],
					preferredLanguages: ["zh"],
				},
				{},
				new Date("2026-07-16T00:00:00.000Z"),
			),
		);

		expect(query.sql).toMatch(/"unit"\."content_rating" in \(\$\d+, \$\d+\)/);
		expect(query.sql).not.toContain("::text[]");
		expect(query.params).toEqual(expect.arrayContaining(["general", "r15"]));
	});

	it("filters content kinds before candidate ranking", () => {
		const query = dialect.sqlToQuery(
			getFeedEligibilityCondition(
				{
					personalized: false,
					contentRatings: ["general"],
					preferredLanguages: [],
				},
				{ content: ["post:post"] },
				new Date("2026-07-16T00:00:00.000Z"),
			),
		);

		expect(query.sql).toContain('"unit"."kind" =');
		expect(query.sql).toContain('"post"."kind" in');
		expect(query.params).toEqual(expect.arrayContaining(["post", "general"]));
		expect(query.params).not.toContain("reply");
	});
});

describe("feed realm context ordering", () => {
	it("places the ranked realm first and preserves the remaining order", () => {
		const realms = [{ id: "first" }, { id: "ranked" }, { id: "third" }] as const;

		expect(prioritizeFeedRealmContexts(realms, "ranked")).toEqual([
			realms[1],
			realms[0],
			realms[2],
		]);
	});

	it("returns a copy without dropping contexts when the ranked realm is unavailable", () => {
		const realms = [{ id: "first" }, { id: "second" }] as const;
		const prioritized = prioritizeFeedRealmContexts(realms, "missing");

		expect(prioritized).toEqual(realms);
		expect(prioritized).not.toBe(realms);
	});
});
