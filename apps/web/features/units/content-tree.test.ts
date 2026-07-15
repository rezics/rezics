import { describe, expect, it } from "vitest";

import {
	buildContentTree,
	getContentMoveTargets,
	flattenContentTree,
	type ContentNode,
} from "./content-tree";

const part: ContentNode = {
	id: "part",
	parentId: null,
	contentUnitId: null,
	language: null,
	title: "Part",
	position: "A",
};

const nodes: ContentNode[] = [
	part,
	{
		id: "chapter",
		parentId: "part",
		contentUnitId: "chapter-unit",
		language: null,
		title: "Chapter",
		position: "A",
	},
	{
		id: "appendix",
		parentId: null,
		contentUnitId: null,
		language: null,
		title: "Appendix",
		position: "B",
	},
];

describe("content tree", () => {
	it("keeps hierarchy and excludes descendants as move targets", () => {
		const tree = buildContentTree(nodes);
		expect(flattenContentTree(tree).map(({ node, depth }) => [node.id, depth])).toEqual([
			["part", 0],
			["chapter", 1],
			["appendix", 0],
		]);
		expect(getContentMoveTargets(nodes, "part").map((node) => node.id)).toEqual(["appendix"]);
	});

	it("keeps orphaned and cyclic nodes visible without permitting a cycle move", () => {
		const malformed: ContentNode[] = [
			{ ...part, id: "orphan", parentId: "missing" },
			{ ...part, id: "self", parentId: "self" },
			{ ...part, id: "first", parentId: "second" },
			{ ...part, id: "second", parentId: "first" },
		];
		const tree = buildContentTree(malformed);

		expect(flattenContentTree(tree).map(({ node }) => node.id)).toEqual([
			"orphan",
			"self",
			"first",
			"second",
		]);
		expect(getContentMoveTargets(malformed, "first").map((node) => node.id)).toEqual([
			"orphan",
			"self",
		]);
	});
});
