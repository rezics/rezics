import { TopLevelSlugNamespaceUnitIds } from "@rezics/slug";
import { describe, expect, it } from "vitest";

import {
	loadRealmContentCreateRoute,
	realmContentCreateHref,
	realmContentCreateSearch,
} from "./realm-content-create-route";

describe("Realm content creation routes", () => {
	it("keeps the default composer mode out of the canonical URL", () => {
		expect(realmContentCreateHref({ id: "realm-id" })).toBe("/realm/realm-id/new");
		expect(realmContentCreateSearch("post")).toBe("");
	});

	it("deep-links to the requested non-default composer mode", () => {
		expect(realmContentCreateHref({ id: "realm-id" }, "tag-context")).toBe(
			"/realm/realm-id/new?mode=tag-context",
		);
		expect(realmContentCreateSearch("wiki")).toBe("?mode=wiki");
	});

	it("prefers the canonical Realm slug address", () => {
		expect(
			realmContentCreateHref(
				{
					id: "realm-id",
					slugAddress: {
						slug: "art",
						scopeUnitId: TopLevelSlugNamespaceUnitIds.realms,
						canonicalPath: ["realms", "art"],
					},
				},
				"tag-context",
			),
		).toBe("/r/art/new?mode=tag-context");
	});

	it("parses known modes and defaults unknown input safely", async () => {
		await expect(loadRealmContentCreateRoute({ mode: "tag-context" })).resolves.toEqual({
			mode: "tag-context",
		});
		await expect(loadRealmContentCreateRoute({ mode: "unknown" })).resolves.toEqual({
			mode: "post",
		});
	});
});
