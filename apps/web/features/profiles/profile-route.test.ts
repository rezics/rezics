import { describe, expect, it } from "vitest";
import { TopLevelSlugNamespaceUnitIds } from "@rezics/slug";

import { profileHref, ProfileSections } from "./profile-route";

describe("profile routes", () => {
	it("orders profile sections by personal details, content, then activity", () => {
		expect(ProfileSections).toEqual(["profile", "content", "activity"]);
	});

	it("uses the long profile route for an ID-only profile", () => {
		expect(profileHref("profile-id")).toBe("/user/profile-id");
		expect(profileHref("profile-id", "profile")).toBe("/user/profile-id");
	});

	it("keeps profile tabs below the canonical profile route", () => {
		expect(profileHref("profile-id", "content")).toBe("/user/profile-id/content");
		expect(profileHref("profile-id", "activity")).toBe("/user/profile-id/activity");
	});

	it("prefers a proved Profile slug address", () => {
		const profile = {
			id: "profile-id",
			slugAddress: {
				slug: "alice",
				scopeUnitId: TopLevelSlugNamespaceUnitIds.users,
				canonicalPath: ["users", "alice"],
			},
		};
		expect(profileHref(profile)).toBe("/u/alice");
		expect(profileHref(profile, "content")).toBe("/u/alice/content");
		expect(profileHref(profile, "activity")).toBe("/u/alice/activity");
	});
});
