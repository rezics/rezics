import { describe, expect, it } from "vitest";

import { FollowingKinds, followingHref } from "./following-route";

describe("following routes", () => {
	it("maps every navigable Unit kind to its canonical route", () => {
		expect(followingHref("profile", "profile-id")).toBe("/user/profile-id/profile");
		expect(followingHref("zone", "zone-id")).toBe("/zones/zone-id");
		expect(followingHref("realm", "realm-id")).toBe("/realms/realm-id");
		expect(followingHref("book", "book-id")).toBe("/units/book/book-id");
		expect(followingHref("software", "software-id")).toBe("/units/software/software-id");
		expect(followingHref("media", "media-id")).toBe("/units/media/media-id");
		expect(followingHref("entity", "entity-id")).toBe("/entities/entity-id");
		expect(followingHref("collection", "collection-id")).toBe("/collections/collection-id");
		expect(followingHref("post", "post-id")).toBe("/posts/post-id");
		expect(followingHref("poll", "poll-id")).toBe("/polls/poll-id");
	});

	it("keeps non-page Unit kinds visible but non-navigable", () => {
		for (const kind of ["slug_namespace", "release", "tag", "series", "realm_rule"] as const)
			expect(followingHref(kind, "unit-id")).toBeUndefined();
	});

	it("derives filter choices from the generated API contract", () => {
		expect(FollowingKinds).toEqual([
			"slug_namespace",
			"profile",
			"book",
			"software",
			"media",
			"release",
			"entity",
			"tag",
			"series",
			"zone",
			"collection",
			"post",
			"poll",
			"realm",
			"realm_rule",
		]);
	});
});
