import { describe, expect, it } from "vitest";

import { collectionSubtreeIds, orderedCollectionMoveRoots } from "./move";

const memberships = [
	{ unitId: "a", parentUnitId: null, position: "a0" },
	{ unitId: "a-1", parentUnitId: "a", position: "a0" },
	{ unitId: "a-2", parentUnitId: "a", position: "a1" },
	{ unitId: "b", parentUnitId: null, position: "a1" },
] as const;

describe("Collection multi-item move selection", () => {
	it("moves selected ancestors once while carrying their selected descendants", () => {
		const roots = orderedCollectionMoveRoots(new Set(["a-2", "b", "a"]), memberships);

		expect(roots).toEqual(["a", "b"]);
		expect(collectionSubtreeIds(roots, memberships)).toEqual(new Set(["a", "a-1", "a-2", "b"]));
	});

	it("orders independent move roots by tree preorder rather than click order", () => {
		expect(orderedCollectionMoveRoots(new Set(["b", "a-2"]), memberships)).toEqual([
			"a-2",
			"b",
		]);
	});

	it("rejects disconnected cyclic hierarchy state", () => {
		expect(() =>
			orderedCollectionMoveRoots(new Set(["a"]), [
				{ unitId: "a", parentUnitId: "b", position: "a0" },
				{ unitId: "b", parentUnitId: "a", position: "a0" },
			]),
		).toThrow("Request validation failed");
	});
});
