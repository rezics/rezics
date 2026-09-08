import { describe, expect, it } from "vitest";

import {
	AllFollowingKinds,
	FollowingFilters,
	FollowingKinds,
	followingHref,
	followingManagementHref,
} from "./following-route";

describe("following routes", () => {
	it("maps every navigable Unit kind to its canonical route", () => {
		expect(followingHref("entity", "profile-id")).toBe("/catalog/entity/profile-id");
		expect(followingHref("zone", "zone-id")).toBe("/zone/zone-id");
		expect(followingHref("realm", "realm-id")).toBe("/realm/realm-id");
		expect(followingHref("publishing", "work-id")).toBe("/catalog/publishing/work-id");
		expect(followingHref("software", "software-id")).toBe("/catalog/software/software-id");
		expect(followingHref("program", "program-id")).toBe("/catalog/program/program-id");
		expect(followingHref("video", "video-id")).toBe("/units/video/video-id");
		expect(followingHref("audio", "audio-id")).toBe("/units/audio/audio-id");
		expect(followingHref("music", "release-id")).toBe("/catalog/music/release-id");
		expect(followingHref("entity", "entity-id")).toBe("/catalog/entity/entity-id");
		expect(followingHref("tag", "tag-id")).toBe("/tags/tag-id");
		expect(followingHref("collection", "collection-id")).toBe("/collections/collection-id");
		expect(followingHref("post", "post-id")).toBe("/posts/post-id");
		expect(followingHref("poll", "poll-id")).toBe("/polls/poll-id");
	});

	it("keeps non-page Unit kinds visible but non-navigable", () => {
		for (const kind of ["label", "realm_rule", "custom_theme"] as const)
			expect(followingHref(kind, "unit-id")).toBeUndefined();
	});

	it("derives filter choices from the generated API contract", () => {
		expect(FollowingKinds).toContain("publishing");
		expect(FollowingKinds).toContain("music");
		expect(FollowingKinds).toContain("program");
		expect(FollowingKinds).not.toContain("book");
		expect(FollowingFilters).toEqual([AllFollowingKinds, ...FollowingKinds]);
	});

	it("builds addressable management routes for sidebar All links", () => {
		expect(followingManagementHref()).toBe("/me/following");
		expect(followingManagementHref("zone")).toBe("/me/following?kind=zone");
		expect(followingManagementHref("realm")).toBe("/me/following?kind=realm");
	});
});
