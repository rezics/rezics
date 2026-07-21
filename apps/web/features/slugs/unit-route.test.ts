import {
	publicSlugHref,
	publicUnitIdHref,
	PublicSlugRouteManifest,
	TopLevelSlugNamespaceUnitIds,
} from "@rezics/slug";
import { describe, expect, it } from "vitest";

import { realmHref, zoneHref } from "./unit-route";

describe("public Unit slug routes", () => {
	it("keeps every enabled namespace and prefix unique", () => {
		for (const key of ["namespaceSlug", "namespaceUnitId", "idSegment", "slugSegment"] as const)
			expect(new Set(PublicSlugRouteManifest.map((route) => route[key])).size).toBe(
				PublicSlugRouteManifest.length,
			);
		expect(
			PublicSlugRouteManifest.map(({ targetKind, idSegment, slugSegment }) => ({
				targetKind,
				idSegment,
				slugSegment,
			})),
		).toEqual([
			{ targetKind: "profile", idSegment: "user", slugSegment: "u" },
			{ targetKind: "realm", idSegment: "realm", slugSegment: "r" },
			{ targetKind: "zone", idSegment: "zone", slugSegment: "z" },
		]);
	});

	it("uses long routes only for IDs", () => {
		expect(publicUnitIdHref("profile", "profile-id")).toBe("/user/profile-id");
		expect(publicUnitIdHref("realm", "realm-id")).toBe("/realm/realm-id");
		expect(publicUnitIdHref("zone", "zone-id")).toBe("/zone/zone-id");
	});

	it("prefers enabled slug routes", () => {
		const realm = {
			id: "realm-id",
			slugAddress: {
				slug: "art",
				scopeUnitId: TopLevelSlugNamespaceUnitIds.realms,
				canonicalPath: ["realms", "art"],
			},
		};
		const zone = {
			id: "zone-id",
			slugAddress: {
				slug: "summer",
				scopeUnitId: TopLevelSlugNamespaceUnitIds.zones,
				canonicalPath: ["zones", "summer"],
			},
		};
		expect(realmHref(realm)).toBe("/r/art");
		expect(zoneHref(zone)).toBe("/z/summer");
	});

	it("falls back to IDs when the address proof does not match the route", () => {
		expect(
			realmHref({
				id: "realm-id",
				slugAddress: {
					slug: "art",
					scopeUnitId: TopLevelSlugNamespaceUnitIds.users,
					canonicalPath: ["realms", "art"],
				},
			}),
		).toBe("/realm/realm-id");
	});

	it("keeps unenabled nested slug routes closed", () => {
		expect(
			publicSlugHref("profile", {
				slug: "favorites",
				scopeUnitId: "profile-id",
				canonicalPath: ["users", "alice", "favorites"],
			}),
		).toBeUndefined();
	});
});
