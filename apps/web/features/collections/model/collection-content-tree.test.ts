import { describe, expect, it } from "vitest";

import { toCollectionContentGroups } from "./collection-content-tree";

function item(targetId: string, parentTargetId: string | null) {
	return { membership: { targetId, parentTargetId }, label: targetId };
}

describe("Collection content tree", () => {
	it("places a Review beneath its reviewed subject", () => {
		const groups = toCollectionContentGroups([item("work", null), item("review", "work")]);
		expect(groups).toHaveLength(1);
		expect(groups[0]?.root.label).toBe("work");
		expect(groups[0]?.children[0]?.root.label).toBe("review");
	});

	it("temporarily promotes an item whose parent is on another page", () => {
		const groups = toCollectionContentGroups([item("review", "unloaded-work")]);
		expect(groups.map(({ root }) => root.label)).toEqual(["review"]);
	});
});
