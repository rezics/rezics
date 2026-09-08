import { describe, expect, it } from "vitest";

import {
	collectBookStructureExpandableIds,
	countBookStructureDisplayedKinds,
	flattenVisibleBookStructureTree,
	isBookStructureDisplayLabel,
	type BookStructureViewTreeNode,
} from "./book-content-structure-view";

type TestNode = {
	readonly id: string;
	readonly title: string;
	readonly language: "en";
	readonly contentKind: "text_version" | "chapter" | "label";
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
			isBookStructureDisplayLabel(entry("parent-label", "label", [entry("child", "chapter")])),
		).toBe(true);
	});

	it("does not infer a label from a chapter having children", () => {
		const chapter = entry("chapter", "chapter", [entry("nested", "chapter")]);

		expect(isBookStructureDisplayLabel(chapter)).toBe(false);
		expect(collectBookStructureExpandableIds([chapter])).toEqual(["chapter"]);
		expect(countBookStructureDisplayedKinds([chapter])).toEqual({
			bookCount: 0,
			chapterCount: 2,
			labelCount: 0,
		});
	});

	it("counts Book occurrences separately from chapters", () => {
		const book = entry("text_version", "text_version", [entry("explicit-child", "chapter")]);
		expect(countBookStructureDisplayedKinds([book])).toEqual({
			bookCount: 1,
			chapterCount: 1,
			labelCount: 0,
		});
		expect(collectBookStructureExpandableIds([book])).toEqual(["text_version"]);
		expect(
			flattenVisibleBookStructureTree([book], new Set()).map(({ entry }) => entry.node.id),
		).toEqual(["text_version"]);
		expect(
			flattenVisibleBookStructureTree([book], new Set(["text_version"])).map(
				({ entry }) => entry.node.id,
			),
		).toEqual(["text_version", "explicit-child"]);
	});
});
