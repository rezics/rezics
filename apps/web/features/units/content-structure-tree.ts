import type { GetApiUnitsBookByUnitIdContentStructureNodesStatus200 } from "@rezics/openapi-tanstack-query";
import { generateKeyBetween } from "fractional-indexing";

type RemoteContentStructureNode =
	GetApiUnitsBookByUnitIdContentStructureNodesStatus200["items"][number];

export type ContentStructureNode = Omit<RemoteContentStructureNode, "contentMetrics">;

type PositionedContentStructureNode = {
	readonly id: string;
	readonly parentId: string | null;
	readonly position: string;
};

export interface ContentStructureTreeNode<
	Node extends PositionedContentStructureNode = ContentStructureNode,
> {
	node: Node;
	children: ContentStructureTreeNode<Node>[];
}

export interface FlattenedContentStructureTreeNode<
	Node extends PositionedContentStructureNode = ContentStructureNode,
> {
	node: Node;
	depth: number;
}

function comparePosition(
	left: PositionedContentStructureNode,
	right: PositionedContentStructureNode,
) {
	return left.position < right.position ? -1 : left.position > right.position ? 1 : 0;
}

/**
 * Builds a display tree without trusting malformed parent links. Orphaned and
 * cyclic nodes remain visible at the root rather than disappearing from the editor.
 */
export function buildContentStructureTree<Node extends PositionedContentStructureNode>(
	nodes: readonly Node[],
): ContentStructureTreeNode<Node>[] {
	const knownIds = new Set(nodes.map((node) => node.id));
	const children = new Map<string | null, Node[]>();

	for (const node of nodes) {
		const parentId =
			node.parentId && node.parentId !== node.id && knownIds.has(node.parentId)
				? node.parentId
				: null;
		const siblings = children.get(parentId);
		if (siblings) siblings.push(node);
		else children.set(parentId, [node]);
	}
	for (const siblings of children.values()) siblings.sort(comparePosition);

	const seen = new Set<string>();
	const roots: ContentStructureTreeNode<Node>[] = [];
	function appendRoot(node: Node): void {
		if (seen.has(node.id)) return;
		const root: ContentStructureTreeNode<Node> = { node, children: [] };
		seen.add(node.id);
		roots.push(root);
		const stack = [root];
		while (stack.length) {
			const entry = stack.pop();
			if (!entry) continue;
			const childEntries: ContentStructureTreeNode<Node>[] = [];
			for (const child of children.get(entry.node.id) ?? []) {
				if (seen.has(child.id)) continue;
				seen.add(child.id);
				childEntries.push({ node: child, children: [] });
			}
			entry.children.push(...childEntries);
			for (let index = childEntries.length - 1; index >= 0; index -= 1) {
				const childEntry = childEntries[index];
				if (childEntry) stack.push(childEntry);
			}
		}
	}

	for (const node of children.get(null) ?? []) appendRoot(node);
	for (const node of nodes) {
		appendRoot(node);
	}
	return roots;
}

export function flattenContentStructureTree<Node extends PositionedContentStructureNode>(
	nodes: readonly ContentStructureTreeNode<Node>[],
	depth = 0,
): FlattenedContentStructureTreeNode<Node>[] {
	const result: FlattenedContentStructureTreeNode<Node>[] = [];
	const stack = nodes.map((entry) => ({ entry, depth })).reverse();
	while (stack.length) {
		const item = stack.pop();
		if (!item) continue;
		result.push({ node: item.entry.node, depth: item.depth });
		for (let index = item.entry.children.length - 1; index >= 0; index -= 1) {
			const child = item.entry.children[index];
			if (child) stack.push({ entry: child, depth: item.depth + 1 });
		}
	}
	return result;
}

export function getContentStructureMoveTargets(
	nodes: readonly ContentStructureNode[],
	movingNodeId: string,
): ContentStructureNode[] {
	const children = new Map<string, string[]>();
	for (const node of nodes) {
		if (!node.parentId) continue;
		const childIds = children.get(node.parentId);
		if (childIds) childIds.push(node.id);
		else children.set(node.parentId, [node.id]);
	}
	const blocked = new Set<string>();
	const stack = [movingNodeId];
	while (stack.length) {
		const nodeId = stack.pop();
		if (!nodeId || blocked.has(nodeId)) continue;
		blocked.add(nodeId);
		stack.push(...(children.get(nodeId) ?? []));
	}
	return nodes.filter((node) => !blocked.has(node.id));
}

export function getContentStructureDepthMove(
	nodes: readonly ContentStructureNode[],
	nodeId: string,
	direction: "indent" | "outdent",
): { parentId: string | null; position: string } | undefined {
	const node = nodes.find((candidate) => candidate.id === nodeId);
	if (!node) return undefined;
	const siblings = nodes
		.filter((candidate) => candidate.parentId === node.parentId)
		.toSorted(comparePosition);
	const index = siblings.findIndex((candidate) => candidate.id === nodeId);
	if (direction === "indent") {
		const parent = siblings[index - 1];
		if (!parent) return undefined;
		const children = nodes
			.filter((candidate) => candidate.parentId === parent.id)
			.toSorted(comparePosition);
		return {
			parentId: parent.id,
			position: generateKeyBetween(children.at(-1)?.position ?? null, null),
		};
	}
	if (!node.parentId) return undefined;
	const parent = nodes.find((candidate) => candidate.id === node.parentId);
	if (!parent) return undefined;
	const destinationSiblings = nodes
		.filter((candidate) => candidate.parentId === parent.parentId)
		.toSorted(comparePosition);
	const parentIndex = destinationSiblings.findIndex((candidate) => candidate.id === parent.id);
	if (parentIndex < 0) return undefined;
	return {
		parentId: parent.parentId,
		position: generateKeyBetween(
			parent.position,
			destinationSiblings[parentIndex + 1]?.position ?? null,
		),
	};
}
