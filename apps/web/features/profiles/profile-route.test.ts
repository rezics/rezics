import { describe, expect, it } from "vitest";

import { profileHref } from "./profile-route";

describe("profile routes", () => {
	it("uses the id-based profile as the canonical user home", () => {
		expect(profileHref("profile-id")).toBe("/user/profile-id/profile");
		expect(profileHref("profile-id", "profile")).toBe("/user/profile-id/profile");
	});

	it("keeps profile tabs below the canonical profile route", () => {
		expect(profileHref("profile-id", "content")).toBe("/user/profile-id/profile/content");
	});
});
