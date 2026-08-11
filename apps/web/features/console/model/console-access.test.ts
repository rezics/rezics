import { describe, expect, it } from "vitest";

import {
	canAccessConsoleSection,
	ConsoleSectionRequiredCapability,
	getAccessibleConsoleSectionIds,
	hasConsoleAccess,
} from "./console-access";

describe("console access", () => {
	it("maps every console section to its exact platform capability", () => {
		expect(ConsoleSectionRequiredCapability).toEqual({
			users: "platform.user.read",
			units: "unit.governance.read",
			"ownership-claims": "unit.governance.read",
			"unit-merges": "unit.governance.read",
			moderation: "platform.moderate",
			audit: "platform.audit.read",
			"api-quotas": "platform.api_quota_policy.read",
		});
	});

	it("derives entry and section access from the same capability mapping", () => {
		const capabilities = ["platform.audit.read", "unit.governance.read", "platform.moderate"];

		expect(getAccessibleConsoleSectionIds(capabilities)).toEqual([
			"units",
			"ownership-claims",
			"unit-merges",
			"moderation",
			"audit",
		]);
		expect(hasConsoleAccess(capabilities)).toBe(true);
		expect(canAccessConsoleSection(capabilities, "moderation")).toBe(true);
		expect(canAccessConsoleSection(capabilities, "users")).toBe(false);
	});

	it("does not expose the console for capabilities without a usable section", () => {
		expect(hasConsoleAccess(["platform.access.read"])).toBe(false);
		expect(hasConsoleAccess(["realm.pins.manage"])).toBe(false);
		expect(getAccessibleConsoleSectionIds([])).toEqual([]);
	});
});
