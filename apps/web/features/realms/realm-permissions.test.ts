import { describe, expect, it } from "vitest";

import { canManageRealm, isRealmOwner } from "./realm-permissions";

describe("realm membership permissions", () => {
	it.each([
		[{ role: "moderator", state: "active" }, true, false],
		[{ role: "admin", state: "active" }, true, false],
		[{ role: "owner", state: "active" }, true, true],
		[{ role: "admin", state: "pending" }, false, false],
		[{ role: "owner", state: "banned" }, false, false],
		[{ role: "member", state: "active" }, false, false],
		[undefined, false, false],
	] as const)("derives management and ownership from %o", (membership, canManage, isOwner) => {
		expect(canManageRealm(membership)).toBe(canManage);
		expect(isRealmOwner(membership)).toBe(isOwner);
	});
});
