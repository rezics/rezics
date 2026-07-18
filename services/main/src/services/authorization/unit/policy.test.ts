import { describe, expect, it } from "vitest";

import { isPubliclyReadableUnit, roleAllows } from "./policy";
import { scopeCovers, unitScope } from "./scope";

describe("unit visibility", () => {
	it.each([
		["published", "public", true],
		["published", "unlisted", true],
		["published", "private", false],
		["draft", "public", false],
	] as const)("treats %s/%s as publicly readable: %s", (status, visibility, expected) => {
		expect(isPubliclyReadableUnit(status, visibility)).toBe(expected);
	});
});

describe("unit access policy", () => {
	it("maps roles to permissions without route-specific role checks", () => {
		expect(roleAllows("viewer", "unit.read")).toBe(true);
		expect(roleAllows("viewer", "unit.update")).toBe(false);
		expect(roleAllows("publisher", "unit.publish")).toBe(true);
		expect(roleAllows("maintainer", "unit.access.manage")).toBe(true);
		expect(roleAllows("owner", "unit.delete")).toBe(true);
	});

	it("lets ancestor scopes cover descendants but not siblings or parents", () => {
		expect(scopeCovers(unitScope("pages"), unitScope("pages", "welcome"))).toBe(true);
		expect(scopeCovers(unitScope("pages", "welcome"), unitScope("pages"))).toBe(false);
		expect(scopeCovers(unitScope("menu"), unitScope("pages", "welcome"))).toBe(false);
	});

	it("rejects untyped path syntax at scope construction", () => {
		expect(() => unitScope("/menu")).toThrow("Invalid Unit authorization scope");
		expect(unitScope("zone", "page", "2026-highlights")).toEqual([
			"zone",
			"page",
			"2026-highlights",
		]);
	});
});
