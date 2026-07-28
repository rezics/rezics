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
			moderation: "platform.moderate",
			audit: "platform.audit.read",
			"token-policies": "platform.api_token_policy.manage",
		});
	});

	it("derives entry and section access from the same capability mapping", () => {
		const capabilities = ["platform.audit.read", "platform.moderate"];

		expect(getAccessibleConsoleSectionIds(capabilities)).toEqual(["moderation", "audit"]);
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
