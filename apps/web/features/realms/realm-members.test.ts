import { describe, expect, it } from "vitest";

import { filterRealmMembers } from "./model/realm-member-filters";

const members: Parameters<typeof filterRealmMembers>[0] = [
	{
		profileId: "019f995d-7595-7c99-9183-250790bbfe2f",
		language: "en",
		name: "Edge Coordinates",
		slugAddress: {
			slug: "edge",
			scopeUnitId: "019f995d-7595-7c99-9183-250790bbfe30",
			canonicalPath: ["users", "edge"],
		},
		avatar: null,
		role: "owner",
		state: "active",
		joinedAt: "2026-07-27T00:00:00.000Z",
	},
	{
		profileId: "019f995d-7595-7c99-9183-250790bbfe31",
		language: "zh",
		name: "Jety",
		slugAddress: {
			slug: "jetywolf",
			scopeUnitId: "019f995d-7595-7c99-9183-250790bbfe30",
			canonicalPath: ["users", "jetywolf"],
		},
		avatar: null,
		role: "member",
		state: "muted",
		joinedAt: "2026-07-26T00:00:00.000Z",
	},
];

describe("Realm member filters", () => {
	it("searches ordinary names and displayed u/slug values", () => {
		expect(filterRealmMembers(members, "coordinates", "all", "all")).toEqual([members[0]]);
		expect(filterRealmMembers(members, "u/JETYwolf", "all", "all")).toEqual([members[1]]);
	});

	it("combines role and status filters", () => {
		expect(filterRealmMembers(members, "", "member", "muted")).toEqual([members[1]]);
		expect(filterRealmMembers(members, "", "owner", "muted")).toEqual([]);
	});
});
