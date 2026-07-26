import { describe, expect, it } from "vitest";

import { catalogZoneFeedContentKinds } from "./catalog-zone-feed";

describe("catalog Zone Feed content kinds", () => {
	it("limits official catalogs to their direct Unit, Collections, and Posts", () => {
		expect(catalogZoneFeedContentKinds("book")).toEqual([
			"unit:book",
			"unit:collection",
			"post:post",
			"post:excerpt",
			"post:review",
			"post:chapter",
			"post:chapter_group",
			"post:wiki",
			"post:picture",
		]);
		expect(catalogZoneFeedContentKinds("media")).toContain("unit:media");
		expect(catalogZoneFeedContentKinds("software")).toContain("unit:software");
	});

	it("does not enable the catalog selector for unrelated Zones", () => {
		expect(catalogZoneFeedContentKinds("realm")).toBeUndefined();
		expect(catalogZoneFeedContentKinds("global")).toBeUndefined();
	});
});
