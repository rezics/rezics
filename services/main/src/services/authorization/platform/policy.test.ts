import { describe, expect, it } from "vitest";

import { PlatformCapabilityValues } from "../../database/schema";
import {
	isPlatformCapability,
	isSuperAdminCapabilitySet,
	preservesPermanentGrantManager,
} from "./policy";

describe("platform authorization policy", () => {
	it("recognizes only contract capabilities", () => {
		expect(isPlatformCapability("platform.grants.manage")).toBe(true);
		expect(isPlatformCapability("platform.super-admin")).toBe(false);
	});

	it("derives Super Admin from the complete capability set", () => {
		expect(isSuperAdminCapabilitySet(new Set(PlatformCapabilityValues))).toBe(true);
		expect(
			isSuperAdminCapabilitySet(
				new Set(
					PlatformCapabilityValues.filter(
						(capability) => capability !== "platform.grants.manage",
					),
				),
			),
		).toBe(false);
	});

	it.each([
		[[], "target", false, false],
		[["target"], "target", false, false],
		[["target", "other"], "target", false, true],
		[["target"], "target", true, true],
	] as const)(
		"checks permanent-manager continuity for %o",
		(current, target, remains, expected) => {
			expect(preservesPermanentGrantManager(current, target, remains)).toBe(expected);
		},
	);
});
