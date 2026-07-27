import { describe, expect, it } from "vitest";

import { validateCollectionParent } from "./hierarchy";

const memberships = [
	{ unitId: "work", parentUnitId: null },
	{ unitId: "review", parentUnitId: "work" },
	{ unitId: "reply", parentUnitId: "review" },
] as const;

describe("Collection parent validation", () => {
	it("accepts a top-level item and a parent from the same Collection", () => {
		expect(
			validateCollectionParent({ targetId: "new", parentTargetId: null }, memberships),
		).toBeNull();
		expect(
			validateCollectionParent({ targetId: "new", parentTargetId: "work" }, memberships),
		).toBeNull();
	});

	it("rejects self-parenting and a parent outside the Collection", () => {
		expect(
			validateCollectionParent({ targetId: "work", parentTargetId: "work" }, memberships),
		).toBe("self-parent");
		expect(
			validateCollectionParent({ targetId: "new", parentTargetId: "missing" }, memberships),
		).toBe("missing-parent");
	});

	it("rejects moving an ancestor below one of its descendants", () => {
		expect(
			validateCollectionParent({ targetId: "work", parentTargetId: "reply" }, memberships),
		).toBe("would-cycle");
	});
});
