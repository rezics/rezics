import { describe, expect, it } from "vitest";

import { isSidebarFollowingKind, sidebarFollowingHref } from "./sidebar-following";

describe("sidebar following model", () => {
	it("admits only navigational Zone and Realm follows", () => {
		expect(isSidebarFollowingKind("zone")).toBe(true);
		expect(isSidebarFollowingKind("realm")).toBe(true);
		expect(isSidebarFollowingKind("profile")).toBe(false);
		expect(isSidebarFollowingKind("book")).toBe(false);
	});

	it("maps each admitted kind to its canonical product route", () => {
		expect(sidebarFollowingHref("zone", "zone-id")).toBe("/zone/zone-id");
		expect(sidebarFollowingHref("realm", "realm-id")).toBe("/realm/realm-id");
	});
});
