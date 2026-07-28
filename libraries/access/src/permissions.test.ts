import { describe, expect, it } from "vitest";

import {
	AuthenticatedGrantableUnitPermissionValues,
	DevelopmentPreviewCapability,
	expandPlatformCapabilities,
	expandUnitPermissions,
	isUnitPermissionApplicable,
	isUnitPermissionGrantableToAuthenticated,
	PlatformCapabilityDefinitions,
	PlatformCapabilityValues,
	StandardPermissionActionValues,
	UnitPermissionDefinitions,
	UnitPermissionImplications,
	UnitPermissionValues,
	unitPermissionsForTarget,
} from "./permissions";
import { scopeCovers, unitScope } from "./scope";

describe("permission schema", () => {
	it("has one definition for every canonical permission", () => {
		expect(Object.keys(UnitPermissionDefinitions)).toEqual([...UnitPermissionValues]);
		expect(new Set(UnitPermissionValues).size).toBe(UnitPermissionValues.length);
	});

	it("keeps key actions aligned with their definitions", () => {
		const standardActions: ReadonlySet<string> = new Set(StandardPermissionActionValues);
		for (const permission of UnitPermissionValues) {
			const definition = UnitPermissionDefinitions[permission];
			expect(permission.split(".").at(-1)).toBe(definition.action);
			if (definition.kind === "standard")
				expect(standardActions.has(definition.action)).toBe(true);
			else expect(definition.rationale.trim().length).toBeGreaterThan(0);
		}
	});

	it("keeps implications valid and acyclic", () => {
		const visiting = new Set<string>();
		const visited = new Set<string>();
		const visit = (permission: (typeof UnitPermissionValues)[number]) => {
			expect(visiting.has(permission)).toBe(false);
			if (visited.has(permission)) return;
			visiting.add(permission);
			for (const implied of UnitPermissionImplications[permission] ?? []) {
				expect(UnitPermissionValues).toContain(implied);
				visit(implied);
			}
			visiting.delete(permission);
			visited.add(permission);
		};
		for (const permission of UnitPermissionValues) visit(permission);
		expect(visited.size).toBe(UnitPermissionValues.length);
	});

	it("keeps status update supplemental to general Unit update", () => {
		expect(expandUnitPermissions(["unit.status.update"])).toEqual([
			"unit.read",
			"unit.status.update",
		]);
	});

	it("keeps direct Realm Unit creation independent from Reply creation", () => {
		expect(expandUnitPermissions(["realm.units.create"])).toEqual([
			"unit.read",
			"realm.units.create",
		]);
		expect(expandUnitPermissions(["realm.post.replies.create"])).toEqual([
			"unit.read",
			"realm.post.replies.create",
		]);
	});

	it("scopes Realm and Entity permissions to their logical targets", () => {
		expect(isUnitPermissionApplicable("realm", "realm.members.manage")).toBe(true);
		expect(isUnitPermissionApplicable("unit", "realm.members.manage")).toBe(false);
		expect(isUnitPermissionApplicable("entity", "entity.association.credit.direct")).toBe(true);
		expect(unitPermissionsForTarget("realm")).toContain("unit.status.update");
		expect(unitPermissionsForTarget("realm")).not.toContain(
			"entity.association.credit.request",
		);
	});

	it("keeps authenticated grants inside the declared boundary", () => {
		const authenticatedPermissions: ReadonlySet<string> = new Set(
			AuthenticatedGrantableUnitPermissionValues,
		);
		for (const permission of UnitPermissionValues)
			expect(isUnitPermissionGrantableToAuthenticated(permission)).toBe(
				authenticatedPermissions.has(permission),
			);
		expect(isUnitPermissionGrantableToAuthenticated("realm.units.create")).toBe(true);
		expect(isUnitPermissionGrantableToAuthenticated("realm.post.replies.create")).toBe(true);
		expect(isUnitPermissionGrantableToAuthenticated("unit.access.manage")).toBe(false);
	});

	it("uses one platform release gate for every development preview", () => {
		expect(DevelopmentPreviewCapability).toBe("platform.development_preview.access");
		expect(
			PlatformCapabilityValues.filter((capability) => capability.includes("preview")),
		).toEqual([DevelopmentPreviewCapability]);
	});

	it("defines every platform capability and keeps audit reads independent", () => {
		expect(Object.keys(PlatformCapabilityDefinitions)).toEqual([...PlatformCapabilityValues]);
		expect(expandPlatformCapabilities(["platform.access.manage"])).toEqual([
			"platform.access.read",
			"platform.access.manage",
		]);
		expect(expandPlatformCapabilities(["platform.audit.read"])).toEqual([
			"platform.audit.read",
		]);
		expect(expandPlatformCapabilities(["platform.user.status.update"])).toEqual([
			"platform.user.read",
			"platform.user.status.update",
		]);
		expect(expandPlatformCapabilities(["platform.session.revoke"])).toEqual([
			"platform.user.read",
			"platform.session.read",
			"platform.session.revoke",
		]);
	});
});

describe("Unit scope", () => {
	it("lets ancestors cover descendants but not siblings or parents", () => {
		expect(scopeCovers(unitScope("pages"), unitScope("pages", "welcome"))).toBe(true);
		expect(scopeCovers(unitScope("pages", "welcome"), unitScope("pages"))).toBe(false);
		expect(scopeCovers(unitScope("menu"), unitScope("pages", "welcome"))).toBe(false);
	});

	it("rejects invalid path syntax", () => {
		expect(() => unitScope("/menu")).toThrow("Invalid Unit authorization scope");
		expect(unitScope("zone", "page", "2026-highlights")).toEqual([
			"zone",
			"page",
			"2026-highlights",
		]);
	});
});
