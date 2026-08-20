import { describe, expect, it } from "vitest";

import {
	AllFollowingKinds,
	followingManagementHref,
	FollowingFilters,
	FollowingKinds,
	followingHref,
} from "./following-route";

describe("following routes", () => {
	it("maps every navigable Unit kind to its canonical route", () => {
		expect(followingHref("profile", "profile-id")).toBe("/user/profile-id");
		expect(followingHref("zone", "zone-id")).toBe("/zone/zone-id");
		expect(followingHref("realm", "realm-id")).toBe("/realm/realm-id");
		expect(followingHref("book", "book-id")).toBe("/units/book/book-id");
		expect(followingHref("software", "software-id")).toBe("/units/software/software-id");
		expect(followingHref("media", "media-id")).toBe("/units/media/media-id");
		expect(followingHref("video", "video-id")).toBe("/units/video/video-id");
		expect(followingHref("audio", "audio-id")).toBe("/units/audio/audio-id");
		expect(followingHref("release", "release-id")).toBe("/units/release/release-id");
		expect(followingHref("entity", "entity-id")).toBe("/entities/entity-id");
		expect(followingHref("tag", "tag-id")).toBe("/tags/tag-id");
		expect(followingHref("structure", "structure-id")).toBe("/tag-structures/structure-id");
		expect(followingHref("collection", "collection-id")).toBe("/collections/collection-id");
		expect(followingHref("post", "post-id")).toBe("/posts/post-id");
		expect(followingHref("poll", "poll-id")).toBe("/polls/poll-id");
	});

	it("keeps non-page Unit kinds visible but non-navigable", () => {
		for (const kind of ["slug_namespace", "label", "series", "realm_rule", "zone_page"] as const)
			expect(followingHref(kind, "unit-id")).toBeUndefined();
	});

	it("derives filter choices from the generated API contract", () => {
		expect(FollowingKinds).toEqual([
			"slug_namespace",
			"profile",
			"book",
			"software",
			"media",
			"video",
			"audio",
			"release",
			"entity",
			"label",
			"tag",
			"structure",
			"series",
			"zone",
			"zone_page",
			"collection",
			"post",
			"poll",
			"realm",
			"realm_rule",
		]);
		expect(FollowingFilters).toEqual([AllFollowingKinds, ...FollowingKinds]);
	});

	it("builds addressable management routes for sidebar All links", () => {
		expect(followingManagementHref()).toBe("/me/following");
		expect(followingManagementHref("zone")).toBe("/me/following?kind=zone");
		expect(followingManagementHref("realm")).toBe("/me/following?kind=realm");
	});
});
