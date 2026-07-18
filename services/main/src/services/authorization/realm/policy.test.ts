import { RealmCapabilityValues } from "../../database/schema";
import { describe, expect, it } from "vitest";

import {
	canManageRealmMember,
	canRealmRolePerform,
	isRealmJoinable,
	isRealmVisible,
	shouldRequireRealmRuleAcknowledgement,
} from "./policy";

describe("realm policy", () => {
	it.each([
		["member", "realm.contribute", true],
		["member", "realm.units.moderate", false],
		["moderator", "realm.pins.manage", true],
		["admin", "realm.rules.publish", true],
		["unknown", "realm.contribute", false],
	] as const)("allows %s to perform %s: %s", (role, capability, expected) => {
		expect(canRealmRolePerform(role, capability)).toBe(expected);
	});

	it.each(RealmCapabilityValues)("gives owners the %s capability", (capability) => {
		expect(canRealmRolePerform("owner", capability)).toBe(true);
	});

	it.each([
		["moderator", "member", "member", true],
		["moderator", "member", "moderator", false],
		["admin", "moderator", "moderator", true],
		["admin", "admin", undefined, false],
		["owner", "owner", undefined, false],
		["unknown", "member", undefined, false],
	] as const)("manages role changes from %s to %s as %s: %s", (actor, target, next, expected) => {
		expect(canManageRealmMember(actor, target, next)).toBe(expected);
	});

	it("keeps rule acknowledgements scoped to their configured trigger", () => {
		const rules = { requireOnPost: true, requireOnUpdate: false };

		expect(shouldRequireRealmRuleAcknowledgement("post", rules)).toBe(true);
		expect(shouldRequireRealmRuleAcknowledgement("update", rules)).toBe(false);
	});

	it.each([
		["published", "public", undefined, true],
		["draft", "public", undefined, false],
		["PUBLISHED", "private", "active", true],
		["published", "private", "pending", false],
		["published", "private", "banned", false],
	] as const)("shows %s/%s to %s: %s", (status, visibility, membership, expected) => {
		expect(isRealmVisible(status, visibility, membership)).toBe(expected);
	});

	it.each([
		["published", "public", undefined, true],
		["published", "private", undefined, false],
		["published", "private", "pending", true],
		["published", "private", "active", true],
		["published", "private", "banned", false],
		["published", "public", "removed", false],
		["draft", "public", "active", false],
	] as const)("allows joining %s/%s as %s: %s", (status, visibility, membership, expected) => {
		expect(isRealmJoinable(status, visibility, membership)).toBe(expected);
	});
});
