import { describe, expect, test } from "vitest";

import { isProfileActivityReadable } from "./policy";

describe("isProfileActivityReadable", () => {
	test("lets an owner inspect every stored visibility", () => {
		expect(
			isProfileActivityReadable({
				categoryVisibility: "private",
				itemVisibility: "private",
				ownerProfileId: "owner",
				viewerProfileId: "owner",
				blocked: false,
				surface: "profile",
			}),
		).toBe(true);
	});

	test("requires both controls to be public on a profile", () => {
		for (const [categoryVisibility, itemVisibility, expected] of [
			["public", "public", true],
			["unlisted", "public", false],
			["public", "unlisted", false],
			["private", "public", false],
		] as const)
			expect(
				isProfileActivityReadable({
					categoryVisibility,
					itemVisibility,
					ownerProfileId: "owner",
					viewerProfileId: "viewer",
					blocked: false,
					surface: "profile",
				}),
			).toBe(expected);
	});

	test("allows unlisted records only through an explicit linked surface", () => {
		expect(
			isProfileActivityReadable({
				categoryVisibility: "unlisted",
				itemVisibility: "unlisted",
				ownerProfileId: "owner",
				viewerProfileId: "viewer",
				blocked: false,
				surface: "linked",
			}),
		).toBe(true);
	});

	test("never discloses a private category or item to another profile", () => {
		for (const [categoryVisibility, itemVisibility] of [
			["private", "public"],
			["public", "private"],
		] as const)
			expect(
				isProfileActivityReadable({
					categoryVisibility,
					itemVisibility,
					ownerProfileId: "owner",
					viewerProfileId: "viewer",
					blocked: false,
					surface: "linked",
				}),
			).toBe(false);
	});

	test("respects bilateral blocks", () => {
		expect(
			isProfileActivityReadable({
				categoryVisibility: "public",
				itemVisibility: "public",
				ownerProfileId: "owner",
				viewerProfileId: "viewer",
				blocked: true,
				surface: "profile",
			}),
		).toBe(false);
	});
});
