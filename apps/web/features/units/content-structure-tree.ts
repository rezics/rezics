import type { GetApiUnitsBookByUnitIdContentStructureNodesStatus200 } from "@rezics/openapi-tanstack-query";
import { generateKeyBetween } from "fractional-indexing";

export type ContentStructureNode =
	GetApiUnitsBookByUnitIdContentStructureNodesStatus200["items"][number];

export interface ContentStructureTreeNode {
	node: ContentStructureNode;
	children: ContentStructureTreeNode[];
}

export interface FlattenedContentStructureTreeNode {
	node: ContentStructureNode;
	depth: number;
}

function comparePosition(left: ContentStructureNode, right: ContentStructureNode) {
	return left.position < right.position ? -1 : left.position > right.position ? 1 : 0;
}

/**
 * Builds a display tree without trusting malformed parent links. Orphaned and
 * cyclic nodes remain visible at the root rather than disappearing from the editor.
 */
export function buildContentStructureTree(
	nodes: readonly ContentStructureNode[],
): ContentStructureTreeNode[] {
	const knownIds = new Set(nodes.map((node) => node.id));
	const children = new Map<string | null, ContentStructureNode[]>();

	for (const node of nodes) {
		const parentId =
			node.parentId && node.parentId !== node.id && knownIds.has(node.parentId)
				? node.parentId
				: null;
		children.set(parentId, [...(children.get(parentId) ?? []), node]);
	}
	for (const siblings of children.values()) siblings.sort(comparePosition);

	const seen = new Set<string>();
	function visit(
		node: ContentStructureNode,
		ancestors: ReadonlySet<string>,
	): ContentStructureTreeNode {
		seen.add(node.id);
		const nextAncestors = new Set(ancestors);
		nextAncestors.add(node.id);
		return {
			node,
			children: (children.get(node.id) ?? [])
				.filter((child) => !nextAncestors.has(child.id))
				.map((child) => visit(child, nextAncestors)),
		};
	}

	const roots = (children.get(null) ?? []).map((node) => visit(node, new Set()));
	for (const node of nodes) {
		if (!seen.has(node.id)) roots.push(visit(node, new Set()));
	}
	return roots;
}

export function flattenContentStructureTree(
	nodes: readonly ContentStructureTreeNode[],
	depth = 0,
): FlattenedContentStructureTreeNode[] {
	return nodes.flatMap((entry) => [
		{ node: entry.node, depth },
		...flattenContentStructureTree(entry.children, depth + 1),
	]);
}

export function getContentStructureMoveTargets(
	nodes: readonly ContentStructureNode[],
	movingNodeId: string,
): ContentStructureNode[] {
	const children = new Map<string, string[]>();
	for (const node of nodes) {
		if (!node.parentId) continue;
		children.set(node.parentId, [...(children.get(node.parentId) ?? []), node.id]);
	}
	const blocked = new Set<string>();
	function visit(nodeId: string) {
		if (blocked.has(nodeId)) return;
		blocked.add(nodeId);
		for (const childId of children.get(nodeId) ?? []) visit(childId);
	}
	visit(movingNodeId);
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
