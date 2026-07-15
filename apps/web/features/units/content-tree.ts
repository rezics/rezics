import type { GetApiUnitsBookByUnitIdContentNodesStatus200 } from "@rezics/openapi-tanstack-query";

export type ContentNode = GetApiUnitsBookByUnitIdContentNodesStatus200["items"][number];

export interface ContentTreeNode {
	node: ContentNode;
	children: ContentTreeNode[];
}

export interface FlattenedContentTreeNode {
	node: ContentNode;
	depth: number;
}

/**
 * Builds a display tree without trusting malformed parent links. Orphaned and
 * cyclic nodes remain visible at the root rather than disappearing from the editor.
 */
export function buildContentTree(nodes: readonly ContentNode[]): ContentTreeNode[] {
	const knownIds = new Set(nodes.map((node) => node.id));
	const children = new Map<string | null, ContentNode[]>();

	for (const node of nodes) {
		const parentId =
			node.parentId && node.parentId !== node.id && knownIds.has(node.parentId)
				? node.parentId
				: null;
		children.set(parentId, [...(children.get(parentId) ?? []), node]);
	}

	const seen = new Set<string>();
	function visit(node: ContentNode, ancestors: ReadonlySet<string>): ContentTreeNode {
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

export function flattenContentTree(
	nodes: readonly ContentTreeNode[],
	depth = 0,
): FlattenedContentTreeNode[] {
	return nodes.flatMap((entry) => [
		{ node: entry.node, depth },
		...flattenContentTree(entry.children, depth + 1),
	]);
}

export function getContentMoveTargets(
	nodes: readonly ContentNode[],
	movingNodeId: string,
): ContentNode[] {
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
