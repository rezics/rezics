import {
	publicSlugHref,
	publicUnitIdHref,
	PublicSlugRouteManifest,
	TopLevelSlugNamespaceUnitIds,
} from "@rezics/slug";
import { describe, expect, it } from "vitest";

import { realmContentCreateHref, realmHref, zoneHref, zonePageHref } from "./unit-route";

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
		expect(realmContentCreateHref(realm)).toBe("/r/art/new");
		expect(zoneHref(zone)).toBe("/z/summer");
	});

	it("renders the home Page at the Zone root", () => {
		const zone = {
			id: "zone-id",
			slugAddress: {
				slug: "summer",
				scopeUnitId: TopLevelSlugNamespaceUnitIds.zones,
				canonicalPath: ["zones", "summer"],
			},
		};
		expect(zonePageHref(zone, { id: "page-id", slug: "home" })).toBe("/z/summer");
	});

	it("prefers a Zone-scoped Page slug", () => {
		expect(
			zonePageHref({ id: "zone-id", slugAddress: null }, { id: "page-id", slug: "schedule" }),
		).toBe("/zone/zone-id/schedule");
	});

	it("falls back to the stable Zone and Page ID route without a Page slug", () => {
		const zone = {
			id: "zone-id",
			slugAddress: {
				slug: "summer",
				scopeUnitId: TopLevelSlugNamespaceUnitIds.zones,
				canonicalPath: ["zones", "summer"],
			},
		};
		expect(zonePageHref(zone, { id: "page/id", slug: null })).toBe(
			"/zone/zone-id/page/page%2Fid",
		);
	});

	it("does not emit reserved application segments as Page slug routes", () => {
		expect(
			zonePageHref({ id: "zone-id", slugAddress: null }, { id: "page-id", slug: "manage" }),
		).toBe("/zone/zone-id/page/page-id");
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
