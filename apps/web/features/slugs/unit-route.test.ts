import {
	canonicalHrefFromShortPath,
	PublicSlugRouteManifest,
	TopLevelSlugNamespaceUnitIds,
} from "@rezics/slug";
import { describe, expect, it } from "vitest";

import { realmHref, zoneHref } from "./unit-route";

describe("public Unit slug routes", () => {
	it("keeps every enabled namespace and prefix unique", () => {
		for (const key of [
			"namespaceSlug",
			"namespaceUnitId",
			"canonicalSegment",
			"shortSegment",
		] as const)
			expect(new Set(PublicSlugRouteManifest.map((route) => route[key])).size).toBe(
				PublicSlugRouteManifest.length,
			);
	});

	it("prefers enabled canonical and short routes", () => {
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
		expect(realmHref(realm)).toBe("/realm/art");
		expect(realmHref(realm, "short")).toBe("/r/art");
		expect(zoneHref(zone)).toBe("/zone/summer");
		expect(zoneHref(zone, "short")).toBe("/z/summer");
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
		).toBe("/realms/realm-id");
	});

	it("keeps the short-link manifest closed to unenabled nested routes", () => {
		expect(canonicalHrefFromShortPath("u", ["alice"])).toBe("/user/alice");
		expect(canonicalHrefFromShortPath("u", ["alice", "favorites"])).toBeUndefined();
		expect(canonicalHrefFromShortPath("c", ["collection"])).toBeUndefined();
	});
});
