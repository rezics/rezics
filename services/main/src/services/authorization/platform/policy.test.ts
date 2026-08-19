import { describe, expect, it } from "vitest";

import {
	grantingPlatformCapabilities,
	isPlatformCapability,
	preservesPermanentAccessManager,
} from "./policy";

describe("platform authorization policy", () => {
	it("recognizes only contract capabilities", () => {
		expect(isPlatformCapability("platform.access.manage")).toBe(true);
		expect(isPlatformCapability("platform.super-admin")).toBe(false);
	});

	it("allows access management to satisfy access reads without implying audit reads", () => {
		expect(grantingPlatformCapabilities("platform.access.read")).toEqual([
			"platform.access.read",
			"platform.access.manage",
		]);
		expect(grantingPlatformCapabilities("platform.audit.read")).toEqual(["platform.audit.read"]);
	});

	it("treats Unit governance reads as the prerequisite for independent mutations", () => {
		expect(grantingPlatformCapabilities("unit.governance.read")).toEqual([
			"unit.governance.read",
			"unit.merge.propose",
			"unit.merge.review",
			"unit.merge",
			"unit.ownership.override",
			"unit.license.manage",
			"unit.delete",
			"unit.restore",
		]);
		expect(grantingPlatformCapabilities("unit.ownership.override")).toEqual([
			"unit.ownership.override",
		]);
	});

	it.each([
		[[], "target", false, false],
		[["target"], "target", false, false],
		[["target", "other"], "target", false, true],
		[["target"], "target", true, true],
	] as const)(
		"checks permanent-manager continuity for %o",
		(current, target, remains, expected) => {
			expect(preservesPermanentAccessManager(current, target, remains)).toBe(expected);
		},
	);
});
