import { describe, expect, it } from "vitest";
import { isAvailableZonePageSlug, TopLevelSlugNamespaceUnitIds } from "@rezics/slug";

import { postDiscussionHref, postHref } from "./url";

describe("postHref", () => {
	it("uses the global Post interaction route without context", () => {
		expect(postHref("post-1")).toBe("/posts/post-1");
	});

	it("preserves Realm context as a query parameter", () => {
		expect(postHref("post-1", { kind: "realm", realmId: "realm-1" })).toBe(
			"/posts/post-1?realmId=realm-1",
		);
	});

	it("links a created discussion Post back to its subject discussion", () => {
		expect(postDiscussionHref("post-1")).toBe("/posts/post-1?from=discussion");
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
