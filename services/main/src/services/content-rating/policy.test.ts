import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import {
	contentRatingAllowlistFromStored,
	contentRatingPolicyKey,
	DefaultContentRatingPolicy,
	getContentRatingCondition,
	resolveContentRatingPolicy,
} from "./policy";

const dialect = new PgDialect();

describe("content-rating policy", () => {
	it("normalizes missing and invalid stored preferences to the safe default", () => {
		expect(contentRatingAllowlistFromStored(undefined)).toEqual(["general", "r15"]);
		expect(contentRatingAllowlistFromStored([])).toEqual(["general", "r15"]);
		expect(contentRatingAllowlistFromStored(["r18", "invalid", "r18"])).toEqual(["r18"]);
	});

	it("never lets a request widen the stored allowlist", () => {
		expect(resolveContentRatingPolicy(["general", "r15"], ["general", "r18"])).toEqual({
			kind: "allow",
			ratings: ["general"],
		});
	});

	it("turns disjoint and invalid-only requests into match-none", () => {
		expect(resolveContentRatingPolicy(["general", "r15"], ["r18"])).toEqual({ kind: "none" });
		expect(resolveContentRatingPolicy(["general", "r15"], ["invalid"])).toEqual({
			kind: "none",
		});
	});

	it("uses a stable key for cursor and request binding", () => {
		expect(contentRatingPolicyKey(DefaultContentRatingPolicy)).toBe("general,r15");
		expect(contentRatingPolicyKey({ kind: "none" })).toBe("none");
	});

	it("compiles match-none as a false predicate and allowlists as an IN predicate", () => {
		expect(dialect.sqlToQuery(getContentRatingCondition({ kind: "none" })).sql).toBe("false");
		expect(
			dialect.sqlToQuery(getContentRatingCondition(DefaultContentRatingPolicy)).sql,
		).toContain(" in (");
	});
});
