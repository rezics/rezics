import type { ContentLanguage } from "@rezics/i18n";

export type BookStructureViewNode = {
	readonly id: string;
	readonly title: string;
	readonly language: ContentLanguage;
	readonly contentKind: "chapter" | "video" | "audio" | "label";
};

export type BookStructureViewTreeNode<Node extends BookStructureViewNode> = {
	readonly node: Node;
	readonly children: readonly BookStructureViewTreeNode<Node>[];
};

export type VisibleBookStructureTreeNode<Node extends BookStructureViewNode> = {
	readonly entry: BookStructureViewTreeNode<Node>;
	readonly depth: number;
	readonly positionInSet: number;
	readonly setSize: number;
};

export type BookStructureContentMetrics = {
	readonly wordCount: number;
	readonly characterCount: number;
};

export const EmptyBookStructureContentMetrics: BookStructureContentMetrics = {
	wordCount: 0,
	characterCount: 0,
};

export function isBookStructureDisplayLabel<Node extends BookStructureViewNode>(
	entry: BookStructureViewTreeNode<Node>,
): boolean {
	return entry.node.contentKind === "label";
}

export function collectBookStructureLabelIds<Node extends BookStructureViewNode>(
	nodes: readonly BookStructureViewTreeNode<Node>[],
): string[] {
	const result: string[] = [];
	const stack = [...nodes].reverse();
	while (stack.length) {
		const entry = stack.pop();
		if (!entry) continue;
		if (isBookStructureDisplayLabel(entry)) result.push(entry.node.id);
		for (let index = entry.children.length - 1; index >= 0; index -= 1) {
			const child = entry.children[index];
			if (child) stack.push(child);
		}
	}
	return result;
}

export function flattenVisibleBookStructureTree<Node extends BookStructureViewNode>(
	nodes: readonly BookStructureViewTreeNode<Node>[],
	expandedIds: ReadonlySet<string>,
): VisibleBookStructureTreeNode<Node>[] {
	const result: VisibleBookStructureTreeNode<Node>[] = [];
	const stack: VisibleBookStructureTreeNode<Node>[] = [];
	for (let index = nodes.length - 1; index >= 0; index -= 1) {
		const entry = nodes[index];
		if (!entry) continue;
		stack.push({
			entry,
			depth: 0,
			positionInSet: index + 1,
			setSize: nodes.length,
		});
	}
	while (stack.length) {
		const visibleEntry = stack.pop();
		if (!visibleEntry) continue;
		result.push(visibleEntry);
		const { entry, depth } = visibleEntry;
		if (
			!entry.children.length ||
			!isBookStructureDisplayLabel(entry) ||
			!expandedIds.has(entry.node.id)
		)
			continue;
		for (let index = entry.children.length - 1; index >= 0; index -= 1) {
			const child = entry.children[index];
			if (!child) continue;
			stack.push({
				entry: child,
				depth: depth + 1,
				positionInSet: index + 1,
				setSize: entry.children.length,
			});
		}
	}
	return result;
}

export function countBookStructureDisplayedKinds<Node extends BookStructureViewNode>(
	nodes: readonly BookStructureViewTreeNode<Node>[],
): {
	readonly chapterCount: number;
	readonly labelCount: number;
} {
	let chapterCount = 0;
	let labelCount = 0;
	const stack = [...nodes];
	while (stack.length) {
		const entry = stack.pop();
		if (!entry) continue;
		if (isBookStructureDisplayLabel(entry)) labelCount += 1;
		else chapterCount += 1;
		stack.push(...entry.children);
	}
	return { chapterCount, labelCount };
}

export function indexBookStructureSubtreeContentMetrics<Node extends BookStructureViewNode>(
	nodes: readonly BookStructureViewTreeNode<Node>[],
	ownContentMetricsByNodeId: ReadonlyMap<string, BookStructureContentMetrics>,
): ReadonlyMap<string, BookStructureContentMetrics> {
	const contentMetricsByNodeId = new Map<string, BookStructureContentMetrics>();
	const stack: {
		readonly entry: BookStructureViewTreeNode<Node>;
		readonly visited: boolean;
	}[] = nodes.map((entry) => ({ entry, visited: false })).reverse();
	while (stack.length) {
		const item = stack.pop();
		if (!item) continue;
		const { entry, visited } = item;
		if (!visited) {
			stack.push({ entry, visited: true });
			for (let index = entry.children.length - 1; index >= 0; index -= 1) {
				const child = entry.children[index];
				if (child) stack.push({ entry: child, visited: false });
			}
			continue;
		}
		const own =
			ownContentMetricsByNodeId.get(entry.node.id) ?? EmptyBookStructureContentMetrics;
		let wordCount = own.wordCount;
		let characterCount = own.characterCount;
		for (const child of entry.children) {
			const childMetrics =
				contentMetricsByNodeId.get(child.node.id) ?? EmptyBookStructureContentMetrics;
			wordCount += childMetrics.wordCount;
			characterCount += childMetrics.characterCount;
		}
		contentMetricsByNodeId.set(entry.node.id, { wordCount, characterCount });
	}
	return contentMetricsByNodeId;
}
