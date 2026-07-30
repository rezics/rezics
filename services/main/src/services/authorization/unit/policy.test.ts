import { describe, expect, it } from "vitest";

import {
	expandUnitPermissions,
	isPubliclyReadableUnit,
	isUnitPermissionApplicable,
	isUnitPermissionGrantableToAuthenticated,
	resolveUnitAccessOverride,
} from "./policy";
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
	it("closes implied permissions and scopes kind-specific permissions", () => {
		expect(expandUnitPermissions(["unit.status.update"])).toEqual([
			"unit.read",
			"unit.status.update",
		]);
		expect(isUnitPermissionApplicable("realm", "realm.members.manage")).toBe(true);
		expect(isUnitPermissionApplicable("post", "realm.members.manage")).toBe(false);
		expect(isUnitPermissionApplicable("entity", "entity.association.credit.direct")).toBe(true);
	});

	it("keeps the authenticated baseline within the public-safe permission boundary", () => {
		expect(isUnitPermissionGrantableToAuthenticated("unit.read")).toBe(true);
		expect(isUnitPermissionGrantableToAuthenticated("unit.update")).toBe(true);
		expect(isUnitPermissionGrantableToAuthenticated("realm.contribute")).toBe(true);
		expect(isUnitPermissionGrantableToAuthenticated("unit.access.manage")).toBe(false);
		expect(isUnitPermissionGrantableToAuthenticated("unit.ownership.transfer")).toBe(false);
		expect(isUnitPermissionGrantableToAuthenticated("realm.members.manage")).toBe(false);
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

	it("keeps the platform recovery boundary above every restriction", () => {
		expect(
			resolveUnitAccessOverride({
				platformOverride: true,
				hasDirectProfileOwner: false,
				restrictions: [
					{ id: "profile-restriction", subjectKind: "profile" },
					{ id: "realm-restriction", subjectKind: "realm" },
				],
			}),
		).toEqual({ kind: "platform" });
	});

	it("keeps current Unit ownership as a recovery boundary above direct restrictions", () => {
		expect(
			resolveUnitAccessOverride({
				platformOverride: false,
				hasDirectProfileOwner: true,
				restrictions: [{ id: "realm-restriction", subjectKind: "realm" }],
			}),
		).toBeUndefined();
		expect(
			resolveUnitAccessOverride({
				platformOverride: false,
				hasDirectProfileOwner: true,
				restrictions: [{ id: "profile-restriction", subjectKind: "profile" }],
			}),
		).toBeUndefined();
	});
});
