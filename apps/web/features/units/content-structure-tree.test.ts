import { describe, expect, it } from "vitest";

import {
	buildContentStructureTree,
	getContentStructureMoveTargets,
	flattenContentStructureTree,
	type ContentStructureNode,
} from "./content-structure-tree";

const part: ContentStructureNode = {
	id: "part",
	parentId: null,
	contentUnitId: "part-unit",
	language: "en",
	title: "Part",
	contentKind: "chapter_group",
	position: "a0",
};

const nodes: ContentStructureNode[] = [
	part,
	{
		id: "chapter",
		parentId: "part",
		contentUnitId: "chapter-unit",
		language: "en",
		title: "Chapter",
		contentKind: "chapter",
		position: "a0",
	},
	{
		id: "appendix",
		parentId: null,
		contentUnitId: "appendix-unit",
		language: "en",
		title: "Appendix",
		contentKind: "chapter_group",
		position: "a1",
	},
];

describe("content tree", () => {
	it("keeps hierarchy and excludes descendants as move targets", () => {
		const tree = buildContentStructureTree(nodes);
		expect(
			flattenContentStructureTree(tree).map(({ node, depth }) => [node.id, depth]),
		).toEqual([
			["part", 0],
			["chapter", 1],
			["appendix", 0],
		]);
		expect(getContentStructureMoveTargets(nodes, "part").map((node) => node.id)).toEqual([
			"appendix",
		]);
	});

	it("keeps orphaned and cyclic nodes visible without permitting a cycle move", () => {
		const malformed: ContentStructureNode[] = [
			{ ...part, id: "orphan", parentId: "missing" },
			{ ...part, id: "self", parentId: "self" },
			{ ...part, id: "first", parentId: "second" },
			{ ...part, id: "second", parentId: "first" },
		];
		const tree = buildContentStructureTree(malformed);

		expect(flattenContentStructureTree(tree).map(({ node }) => node.id)).toEqual([
			"orphan",
			"self",
			"first",
			"second",
		]);
		expect(getContentStructureMoveTargets(malformed, "first").map((node) => node.id)).toEqual([
			"orphan",
			"self",
		]);
	});
});
