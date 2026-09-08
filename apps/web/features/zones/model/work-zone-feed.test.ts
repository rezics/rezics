import { describe, expect, it } from "vitest";

import { workZoneFeedContentKinds } from "./work-zone-feed";

describe("work Zone Feed content kinds", () => {
	it("limits official units to their direct Unit, Collections, and Posts", () => {
		expect(workZoneFeedContentKinds({ where: { owner: { in: ["publishing"] } } })).toEqual([
			"publishing:work",
			"publishing:text_version",
			"publishing:publication",
			"collection:collection",
			"post:post",
			"post:excerpt",
			"post:review",
			"post:chapter",
			"post:wiki",
			"post:picture",
		]);
		expect(workZoneFeedContentKinds({ where: { owner: { in: ["program"] } } })).toContain(
			"program:program",
		);
		expect(workZoneFeedContentKinds({ where: { owner: { in: ["software"] } } })).toContain(
			"software:content",
		);
	});

	it("does not enable the unit selector for unrelated Zones", () => {
		expect(workZoneFeedContentKinds({ categories: ["realms"] })).toBeUndefined();
		expect(workZoneFeedContentKinds({})).toBeUndefined();
	});
});
