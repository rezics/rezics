import { describe, expect, it } from "vitest";
import {
	AccessManagementPermissionDefinitions,
	AccessManagementPermissionValues,
	AccessPermissionValues,
	accessPermissionKey,
	isAccessPermission,
} from "./management";
import {
	PlatformCapabilityValues,
	StandardPermissionActionValues,
	expandUnitPermissions,
	expandPlatformCapabilities,
	UnitPermissionValues,
} from "./permissions";

describe("mixed IAM management vocabulary", () => {
	it("keeps use, definition, activation, assignment and ceiling management distinct", () => {
		expect(AccessManagementPermissionValues).toContain("access.role.update");
		expect(AccessManagementPermissionValues).toContain("access.role.activate");
		expect(AccessManagementPermissionValues).toContain("access.role-binding.manage");
		expect(AccessManagementPermissionValues).toContain("access.assignment-ceiling.manage");
		expect(AccessManagementPermissionValues).not.toContain("unit.read");
	});
	it("defines every management key and justifies nonstandard actions", () => {
		expect(Object.keys(AccessManagementPermissionDefinitions).sort()).toEqual(
			[...AccessManagementPermissionValues].sort(),
		);
		for (const key of AccessManagementPermissionValues) {
			const definition = AccessManagementPermissionDefinitions[key];
			expect(`${definition.resource}.${definition.action}`).toBe(key);
			if (!(StandardPermissionActionValues as readonly string[]).includes(definition.action)) {
				expect("rationale" in definition && definition.rationale.length > 0).toBe(true);
			}
		}
	});
	it("derives one closed permission union without changing existing registries", () => {
		expect(new Set(AccessPermissionValues.map(accessPermissionKey)).size).toBe(
			AccessPermissionValues.length,
		);
		for (const key of UnitPermissionValues)
			expect(isAccessPermission({ family: "unit", key })).toBe(true);
		for (const key of PlatformCapabilityValues)
			expect(isAccessPermission({ family: "platform", key })).toBe(true);
		for (const key of AccessManagementPermissionValues)
			expect(isAccessPermission({ family: "management", key })).toBe(true);
		expect(isAccessPermission({ family: "unit", key: "*" })).toBe(false);
		expect(isAccessPermission(Object.assign([], { family: "unit", key: "unit.read" }))).toBe(false);
		expect(
			isAccessPermission(
				Object.assign(Object.create({ family: "unit", key: "unit.read" }), { a: 1, b: 2 }),
			),
		).toBe(false);
		expect(isAccessPermission({ family: "unit", key: "platform.access.manage" })).toBe(false);
		expect(accessPermissionKey({ family: "unit", key: "realm.members.manage" })).not.toBe(
			accessPermissionKey({ family: "platform", key: "realm.members.manage" }),
		);
	});
	it("preserves the existing implication difference for overlapping Realm keys", () => {
		expect(expandUnitPermissions(["realm.members.manage"])).toContain("unit.read");
		expect(expandPlatformCapabilities(["realm.members.manage"])).not.toContain("unit.read");
	});
});
