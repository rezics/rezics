export interface EditableTreeNode {
	readonly id: string;
	readonly parentId: string | null;
	readonly order: number;
}

export type EditableTreeEntry<Node extends EditableTreeNode> = {
	readonly node: Node;
	readonly children: readonly EditableTreeEntry<Node>[];
};

export type VisibleEditableTreeEntry<Node extends EditableTreeNode> = {
	readonly entry: EditableTreeEntry<Node>;
	readonly depth: number;
	readonly positionInSet: number;
	readonly setSize: number;
};

export type EditableTreeDropTarget =
	| { readonly kind: "root" }
	| {
			readonly kind: "node";
			readonly nodeId: string;
			readonly placement: "before" | "inside" | "after";
	  };

function compareNodes(left: EditableTreeNode, right: EditableTreeNode): number {
	return left.order - right.order || left.id.localeCompare(right.id);
}

function groupSiblings<Node extends EditableTreeNode>(
	nodes: readonly Node[],
): ReadonlyMap<string | null, readonly Node[]> {
	const groups = new Map<string | null, Node[]>();
	for (const node of nodes) {
		const siblings = groups.get(node.parentId);
		if (siblings) siblings.push(node);
		else groups.set(node.parentId, [node]);
	}
	for (const siblings of groups.values()) siblings.sort(compareNodes);
	return groups;
}

export function buildEditableTree<Node extends EditableTreeNode>(
	nodes: readonly Node[],
): readonly EditableTreeEntry<Node>[] {
	const siblings = groupSiblings(nodes);
	const entries = new Map<string, { node: Node; children: EditableTreeEntry<Node>[] }>();
	for (const node of nodes) entries.set(node.id, { node, children: [] });
	for (const [parentId, children] of siblings) {
		if (parentId === null) continue;
		const parent = entries.get(parentId);
		if (!parent) continue;
		parent.children.push(
			...children.flatMap((node) => {
				const entry = entries.get(node.id);
				return entry ? [entry] : [];
			}),
		);
	}
	const roots = siblings.get(null) ?? [];
	return roots.flatMap((node) => {
		const entry = entries.get(node.id);
		return entry ? [entry] : [];
	});
}

export function flattenVisibleEditableTree<Node extends EditableTreeNode>(
	tree: readonly EditableTreeEntry<Node>[],
	expandedIds: ReadonlySet<string>,
	visibleIds?: ReadonlySet<string>,
): readonly VisibleEditableTreeEntry<Node>[] {
	const result: VisibleEditableTreeEntry<Node>[] = [];
	const stack: {
		readonly entry: EditableTreeEntry<Node>;
		readonly depth: number;
		readonly positionInSet: number;
		readonly setSize: number;
	}[] = [];
	for (let index = tree.length - 1; index >= 0; index -= 1) {
		const entry = tree[index];
		if (entry)
			stack.push({
				entry,
				depth: 0,
				positionInSet: index + 1,
				setSize: tree.length,
			});
	}
	while (stack.length) {
		const current = stack.pop();
		if (!current) break;
		if (!visibleIds || visibleIds.has(current.entry.node.id)) result.push(current);
		if (!expandedIds.has(current.entry.node.id)) continue;
		const children = current.entry.children;
		for (let index = children.length - 1; index >= 0; index -= 1) {
			const entry = children[index];
			if (entry)
				stack.push({
					entry,
					depth: current.depth + 1,
					positionInSet: index + 1,
					setSize: children.length,
				});
		}
	}
	return result;
}

export function collectEditableTreeParentIds<Node extends EditableTreeNode>(
	nodes: readonly Node[],
): ReadonlySet<string> {
	return new Set(nodes.flatMap(({ parentId }) => (parentId ? [parentId] : [])));
}

export function editableTreeSearchVisibility<Node extends EditableTreeNode>(
	nodes: readonly Node[],
	query: string,
	searchText: (node: Node) => string,
): { readonly visibleIds?: ReadonlySet<string>; readonly ancestorIds: ReadonlySet<string> } {
	const normalized = query.trim().toLocaleLowerCase();
	if (!normalized) return { ancestorIds: new Set() };
	const byId = new Map(nodes.map((node) => [node.id, node]));
	const visibleIds = new Set<string>();
	const ancestorIds = new Set<string>();
	for (const node of nodes) {
		if (!searchText(node).toLocaleLowerCase().includes(normalized)) continue;
		visibleIds.add(node.id);
		const visited = new Set<string>([node.id]);
		let parentId = node.parentId;
		while (parentId !== null && !visited.has(parentId)) {
			visited.add(parentId);
			visibleIds.add(parentId);
			ancestorIds.add(parentId);
			parentId = byId.get(parentId)?.parentId ?? null;
		}
	}
	return { visibleIds, ancestorIds };
}

export function editableTreeSelectionRoots<Node extends EditableTreeNode>(
	nodes: readonly Node[],
	selectedIds: ReadonlySet<string>,
): readonly Node[] {
	const byId = new Map(nodes.map((node) => [node.id, node]));
	return nodes.filter((node) => {
		if (!selectedIds.has(node.id)) return false;
		const visited = new Set([node.id]);
		let parentId = node.parentId;
		while (parentId !== null && !visited.has(parentId)) {
			if (selectedIds.has(parentId)) return false;
			visited.add(parentId);
			parentId = byId.get(parentId)?.parentId ?? null;
		}
		return true;
	});
}

export function normalizeEditableTreeSelection<Node extends EditableTreeNode>(
	nodes: readonly Node[],
	selectedIds: ReadonlySet<string>,
): ReadonlySet<string> {
	return new Set(editableTreeSelectionRoots(nodes, selectedIds).map(({ id }) => id));
}

export function editableTreeSelectionCoverage<Node extends EditableTreeNode>(
	nodes: readonly Node[],
	selectedRootIds: ReadonlySet<string>,
): ReadonlyMap<string, string> {
	const childrenByParentId = groupSiblings(nodes);
	const coverage = new Map<string, string>();
	for (const rootId of normalizeEditableTreeSelection(nodes, selectedRootIds)) {
		const stack = [rootId];
		while (stack.length) {
			const nodeId = stack.pop();
			if (!nodeId || coverage.has(nodeId)) continue;
			coverage.set(nodeId, rootId);
			for (const child of childrenByParentId.get(nodeId) ?? []) stack.push(child.id);
		}
	}
	return coverage;
}

export function editableTreeMoveTargetIds<Node extends EditableTreeNode>(
	nodes: readonly Node[],
	selectedIds: ReadonlySet<string>,
): ReadonlySet<string> {
	const blocked = new Set(editableTreeSelectionCoverage(nodes, selectedIds).keys());
	return new Set(nodes.flatMap(({ id }) => (blocked.has(id) ? [] : [id])));
}

export function moveEditableTreeSelection<Node extends EditableTreeNode>(
	nodes: readonly Node[],
	selectedIds: ReadonlySet<string>,
	target: EditableTreeDropTarget,
	canAcceptChildren: (node: Node) => boolean = () => true,
): Node[] {
	const roots = editableTreeSelectionRoots(nodes, selectedIds).toSorted(compareNodes);
	if (!roots.length) return [...nodes];
	const movingIds = new Set(roots.map(({ id }) => id));
	const blocked = new Set(editableTreeSelectionCoverage(nodes, movingIds).keys());
	if (target.kind === "node" && blocked.has(target.nodeId)) return [...nodes];
	const targetNode =
		target.kind === "node" ? nodes.find(({ id }) => id === target.nodeId) : undefined;
	if (target.kind === "node" && !targetNode) return [...nodes];
	if (
		target.kind === "node" &&
		target.placement === "inside" &&
		targetNode &&
		!canAcceptChildren(targetNode)
	)
		return [...nodes];

	const siblings = new Map<string | null, Node[]>();
	for (const [parentId, entries] of groupSiblings(nodes))
		siblings.set(
			parentId,
			entries.filter(({ id }) => !movingIds.has(id)),
		);
	const destinationParentId =
		target.kind === "root"
			? null
			: target.placement === "inside"
				? target.nodeId
				: (targetNode?.parentId ?? null);
	const destination = siblings.get(destinationParentId) ?? [];
	let destinationIndex = destination.length;
	if (target.kind === "node" && target.placement !== "inside") {
		const targetIndex = destination.findIndex(({ id }) => id === target.nodeId);
		if (targetIndex < 0) return [...nodes];
		destinationIndex = targetIndex + (target.placement === "after" ? 1 : 0);
	}
	siblings.set(destinationParentId, [
		...destination.slice(0, destinationIndex),
		...roots.map((node) => ({ ...node, parentId: destinationParentId })),
		...destination.slice(destinationIndex),
	]);
	const reordered = new Map<string, Node>();
	for (const entries of siblings.values())
		entries.forEach((node, order) => reordered.set(node.id, { ...node, order }));
	return nodes.map((node) => reordered.get(node.id) ?? node);
}

export function removeEditableTreeNodes<Node extends EditableTreeNode>(
	nodes: readonly Node[],
	selectedIds: ReadonlySet<string>,
	mode: "promote-children" | "subtree",
): Node[] {
	const roots = editableTreeSelectionRoots(nodes, selectedIds);
	if (!roots.length) return [...nodes];
	const rootIds = new Set(roots.map(({ id }) => id));
	const removedIds =
		mode === "subtree"
			? new Set(editableTreeSelectionCoverage(nodes, rootIds).keys())
			: rootIds;
	const parentByRemovedId = new Map(roots.map((node) => [node.id, node.parentId]));
	const next = nodes.flatMap((node): Node[] => {
		if (removedIds.has(node.id)) return [];
		if (mode === "promote-children" && node.parentId && rootIds.has(node.parentId))
			return [{ ...node, parentId: parentByRemovedId.get(node.parentId) ?? null }];
		return [node];
	});
	const reordered = new Map<string, Node>();
	for (const entries of groupSiblings(next).values())
		entries.forEach((node, order) => reordered.set(node.id, { ...node, order }));
	return next.map((node) => reordered.get(node.id) ?? node);
}
