import { describe, expect, it } from "vitest";
import { AccessPermissionValues, accessPermissionKey, type AccessPermission } from "./management";
import {
	snapshotAccessPermissionCeiling,
	constrainAccessPermissions,
	accessPermissionCeilingCovers,
} from "./permission-ceilings";
const read: AccessPermission = { family: "unit", key: "unit.read" };
const update: AccessPermission = { family: "unit", key: "unit.update" };
const manage: AccessPermission = { family: "management", key: "access.role-binding.manage" };
const keys = (values: readonly AccessPermission[]) => values.map(accessPermissionKey);
describe("explicit permission approval ceilings", () => {
	it("records prerequisite permissions when an approval is authored", () => {
		expect(keys(snapshotAccessPermissionCeiling([update]))).toEqual(
			["unit.read", "unit.update"].map((key) => `unit:${key}`),
		);
	});
	it("canonicalizes input order and duplicates without mutating the authored values", () => {
		const input = [update, read, update];
		const before = JSON.stringify(input);
		expect(snapshotAccessPermissionCeiling(input)).toEqual(
			snapshotAccessPermissionCeiling([read, update]),
		);
		expect(JSON.stringify(input)).toBe(before);
	});
	it("never expands a previously stored approval at use time", () => {
		expect(constrainAccessPermissions([update], [update])).toEqual([]);
		expect(accessPermissionCeilingCovers([update], [update])).toBe(false);
	});
	it("permits a prerequisite without retaining the broader mutation", () => {
		expect(constrainAccessPermissions([update], [read])).toEqual([read]);
		expect(accessPermissionCeilingCovers([update], [read])).toBe(false);
	});
	it("admits the complete permission closure only inside the recorded approval", () => {
		const approved = snapshotAccessPermissionCeiling([update]);
		expect(constrainAccessPermissions([update], approved)).toEqual(approved);
		expect(accessPermissionCeilingCovers([update], approved)).toBe(true);
	});
	it("does not turn an empty approval into an unrestricted one", () => {
		expect(constrainAccessPermissions([update], [])).toEqual([]);
		expect(accessPermissionCeilingCovers([update], [])).toBe(false);
		expect(accessPermissionCeilingCovers([], [])).toBe(true);
	});
	it("keeps identically spelled Unit and Platform keys separate", () => {
		const unit: AccessPermission = { family: "unit", key: "realm.members.manage" };
		const platform: AccessPermission = { family: "platform", key: "realm.members.manage" };
		const approved = snapshotAccessPermissionCeiling([unit]);
		expect(keys(approved)).toContain("unit:unit.read");
		expect(keys(constrainAccessPermissions([platform], approved))).not.toContain(
			"platform:realm.members.manage",
		);
		expect(accessPermissionCeilingCovers([platform], approved)).toBe(false);
	});
	it("keeps assignment management independent from using the assigned data rights", () => {
		expect(snapshotAccessPermissionCeiling([manage])).toEqual([manage]);
		expect(constrainAccessPermissions([update], [manage])).toEqual([]);
		expect(constrainAccessPermissions([manage], [read, update])).toEqual([]);
	});
	it("does not infer authority from a ceiling with no corresponding grant", () => {
		expect(constrainAccessPermissions([], AccessPermissionValues)).toEqual([]);
	});
	it("clips new role permissions to the original approval", () => {
		const approved = snapshotAccessPermissionCeiling([read]);
		expect(constrainAccessPermissions([read, update, manage], approved)).toEqual([read]);
	});
	it("returns copied frozen references so later edits cannot rewrite an approval", () => {
		const input: AccessPermission = { ...update };
		const approval = snapshotAccessPermissionCeiling([input]);
		input.key = "unit.status.update";
		expect(keys(approval)).toEqual(["unit:unit.read", "unit:unit.update"]);
		expect(Object.isFrozen(approval)).toBe(true);
		expect(approval.every(Object.isFrozen)).toBe(true);
	});
	it("rejects unknown, wildcard, malformed and excessive sets before returning a prefix", () => {
		for (const bad of [
			[{ family: "unit", key: "*" }],
			[{ family: "unknown", key: "unit.read" }],
			null,
			[{ ...read, extra: true }],
			Array(AccessPermissionValues.length + 1).fill(read),
		]) {
			expect(() => snapshotAccessPermissionCeiling(bad as readonly AccessPermission[])).toThrow(
				TypeError,
			);
			expect(() => constrainAccessPermissions([read], bad as readonly AccessPermission[])).toThrow(
				TypeError,
			);
		}
	});
	it("never produces effective permissions outside either the current closure or explicit approval", () => {
		for (const permission of AccessPermissionValues) {
			const closure = snapshotAccessPermissionCeiling([permission]);
			for (const approved of [[], [permission], closure, AccessPermissionValues]) {
				const effective = constrainAccessPermissions([permission], approved);
				for (const value of effective) {
					expect(keys(closure)).toContain(accessPermissionKey(value));
					expect(keys(approved)).toContain(accessPermissionKey(value));
					expect(accessPermissionCeilingCovers([value], approved)).toBe(true);
				}
			}
		}
	});
});
