import { describe, expect, it } from "vitest";

import {
	ApiPermissionValues,
	fromApiKeyPermissions,
	isApiPermission,
	toApiKeyPermissions,
} from "./api-permissions";

describe("API permissions", () => {
	it("round-trips the flat public contract through Better Auth statements", () => {
		const selected = ["unit:create", "unit:update", "interaction:write"] as const;

		expect(toApiKeyPermissions(selected)).toEqual({
			unit: ["create", "update"],
			interaction: ["write"],
		});
		expect(fromApiKeyPermissions(toApiKeyPermissions(selected))).toEqual(selected);
	});

	it("keeps Unit as the canonical content capability", () => {
		expect(ApiPermissionValues).toContain("unit:create");
		expect(ApiPermissionValues).toContain("unit:update");
		expect(ApiPermissionValues.some((permission) => permission.startsWith("unknown:"))).toBe(false);
	});

	it("rejects unknown permission strings", () => {
		expect(isApiPermission("unit:update")).toBe(true);
		expect(isApiPermission("unknown:write")).toBe(false);
		expect(fromApiKeyPermissions({ unit: ["admin"] })).toEqual([]);
	});
});
