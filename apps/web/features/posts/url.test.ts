import { describe, expect, it } from "vitest";
import { isAvailableZonePageSlug, TopLevelSlugNamespaceUnitIds } from "@rezics/slug";

import { postHref } from "./url";

describe("postHref", () => {
	it("uses the global Post interaction route without context", () => {
		expect(postHref("post-1")).toBe("/posts/post-1");
	});

	it("preserves Realm context as a query parameter", () => {
		expect(postHref("post-1", { kind: "realm", realmId: "realm-1" })).toBe(
			"/posts/post-1?realmId=realm-1",
		);
	});

	it("preserves Zone context in the route hierarchy", () => {
		expect(
			postHref("post-1", {
				kind: "zone",
				zone: {
					id: "zone-1",
					slugAddress: {
						slug: "fiction",
						scopeUnitId: TopLevelSlugNamespaceUnitIds.zones,
						canonicalPath: ["zones", "fiction"],
					},
				},
			}),
		).toBe("/z/fiction/posts/post-1");
	});

	it("keeps the Zone Post route segment unavailable to Page slugs", () => {
		expect(isAvailableZonePageSlug("posts")).toBe(false);
	});
});
