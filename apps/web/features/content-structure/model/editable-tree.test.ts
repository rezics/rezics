import { describe, expect, it } from "vitest";

import {
	editableTreeSearchVisibility,
	moveEditableTreeSelection,
	normalizeEditableTreeSelection,
	removeEditableTreeNodes,
} from "./editable-tree";

const nodes = [
	{ id: "a", parentId: null, order: 0, title: "Alpha" },
	{ id: "b", parentId: "a", order: 0, title: "Beta" },
	{ id: "c", parentId: "b", order: 0, title: "Gamma" },
	{ id: "d", parentId: null, order: 1, title: "Delta" },
] as const;

describe("editable tree", () => {
	it("normalizes nested selections to their roots", () => {
		expect(normalizeEditableTreeSelection(nodes, new Set(["a", "b", "c"]))).toEqual(
			new Set(["a"]),
		);
	});

	it("rejects moves into a selected subtree", () => {
		expect(
			moveEditableTreeSelection(nodes, new Set(["a"]), {
				kind: "node",
				nodeId: "c",
				placement: "inside",
			}),
		).toEqual(nodes);
	});

	it("promotes children without deleting their descendants", () => {
		expect(removeEditableTreeNodes(nodes, new Set(["b"]), "promote-children")).toEqual([
			nodes[0],
			{ ...nodes[2], parentId: "a" },
			nodes[3],
		]);
	});

	it("keeps search matches and their ancestors visible", () => {
		expect(editableTreeSearchVisibility(nodes, "gamma", (node) => node.title)).toEqual({
			visibleIds: new Set(["a", "b", "c"]),
			ancestorIds: new Set(["a", "b"]),
		});
	});
});
