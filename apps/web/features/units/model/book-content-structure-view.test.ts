import { describe, expect, it } from "vitest";

import {
	collectBookStructureLabelIds,
	countBookStructureDisplayedKinds,
	isBookStructureDisplayLabel,
	type BookStructureViewTreeNode,
} from "./book-content-structure-view";

type TestNode = {
	readonly id: string;
	readonly title: string;
	readonly language: "en";
	readonly contentKind: "chapter" | "label";
};

function entry(
	id: string,
	contentKind: TestNode["contentKind"],
	children: readonly BookStructureViewTreeNode<TestNode>[] = [],
): BookStructureViewTreeNode<TestNode> {
	return {
		node: { id, title: id, language: "en", contentKind },
		children,
	};
}

describe("book content structure presentation kinds", () => {
	it("renders labels as labels whether or not they have children", () => {
		expect(isBookStructureDisplayLabel(entry("empty-label", "label"))).toBe(true);
		expect(
			isBookStructureDisplayLabel(
				entry("parent-label", "label", [entry("child", "chapter")]),
			),
		).toBe(true);
	});

	it("does not infer a label from a chapter having children", () => {
		const chapter = entry("chapter", "chapter", [entry("nested", "chapter")]);

		expect(isBookStructureDisplayLabel(chapter)).toBe(false);
		expect(collectBookStructureLabelIds([chapter])).toEqual([]);
		expect(countBookStructureDisplayedKinds([chapter])).toEqual({
			chapterCount: 2,
			labelCount: 0,
		});
	});
});
