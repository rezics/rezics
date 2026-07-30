import { describe, expect, it } from "vitest";

import { workZoneFeedContentKinds } from "./work-zone-feed";

describe("work Zone Feed content kinds", () => {
	it("limits official units to their direct Unit, Collections, and Posts", () => {
		expect(workZoneFeedContentKinds("book")).toEqual([
			"unit:book",
			"unit:collection",
			"post:post",
			"post:excerpt",
			"post:review",
			"post:chapter",
			"post:wiki",
			"post:picture",
		]);
		expect(workZoneFeedContentKinds("media")).toContain("unit:media");
		expect(workZoneFeedContentKinds("software")).toContain("unit:software");
	});

	it("does not enable the unit selector for unrelated Zones", () => {
		expect(workZoneFeedContentKinds("realm")).toBeUndefined();
		expect(workZoneFeedContentKinds("global")).toBeUndefined();
	});
});
