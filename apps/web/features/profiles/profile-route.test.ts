import { describe, expect, it } from "vitest";
import { TopLevelSlugNamespaceUnitIds } from "@rezics/slug";

import { profileHref } from "./profile-route";

describe("profile routes", () => {
	it("uses the id-based profile as the canonical user home", () => {
		expect(profileHref("profile-id")).toBe("/user/by-id/profile-id");
		expect(profileHref("profile-id", "profile")).toBe("/user/by-id/profile-id");
	});

	it("keeps profile tabs below the canonical profile route", () => {
		expect(profileHref("profile-id", "content")).toBe("/user/by-id/profile-id/content");
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
		expect(profileHref(profile)).toBe("/user/alice");
		expect(profileHref(profile, "content")).toBe("/user/alice/content");
		expect(profileHref(profile, "profile", "short")).toBe("/u/alice");
	});
});
