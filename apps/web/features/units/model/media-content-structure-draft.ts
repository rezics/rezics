import type { ContentLanguage } from "@rezics/i18n";
import type {
	GetApiUnitsMediaByUnitIdContentStructureNodesStatus200,
	PutApiUnitsMediaByUnitIdContentStructureBody,
} from "@rezics/openapi-tanstack-query";

type RemoteMediaNode = GetApiUnitsMediaByUnitIdContentStructureNodesStatus200["items"][number];
export type MediaContentStructureSaveNode =
	PutApiUnitsMediaByUnitIdContentStructureBody["nodes"][number];

type MediaDraftNodeBase = {
	readonly id: string;
	readonly parentId: string | null;
	readonly order: number;
	readonly title: string;
	readonly contentKind: "video" | "audio" | "label";
	readonly language: ContentLanguage;
	readonly durationSeconds: string | number | null;
};

export type ExistingMediaDraftNode = MediaDraftNodeBase & {
	readonly state: "existing";
	readonly contentUnitId: string;
};

export type NewMediaDraftNode = MediaDraftNodeBase & {
	readonly state: "new";
};

export type AttachedMediaDraftNode = MediaDraftNodeBase & {
	readonly state: "attached";
	readonly contentUnitId: string;
};

export type MediaDraftNode = ExistingMediaDraftNode | NewMediaDraftNode | AttachedMediaDraftNode;

export type InsertedMediaDraftNodeInput =
	| Omit<NewMediaDraftNode, "order">
	| Omit<AttachedMediaDraftNode, "order">;

export type MediaDraftTreeNode = {
	readonly node: MediaDraftNode;
	readonly children: readonly MediaDraftTreeNode[];
};

export type MediaDraftDropTarget =
	| { readonly kind: "root" }
	| {
			readonly kind: "node";
			readonly nodeId: string;
			readonly placement: "before" | "inside" | "after";
	  };

export function isMediaDraftParentTarget(node: MediaDraftNode): boolean {
	return node.contentKind === "label";
}

function compareRemoteNodes(left: RemoteMediaNode, right: RemoteMediaNode): number {
	return left.position < right.position ? -1 : left.position > right.position ? 1 : 0;
}

function compareDraftNodes(left: MediaDraftNode, right: MediaDraftNode): number {
	return left.order - right.order || left.id.localeCompare(right.id);
}

function normalizeParentId(
	nodeId: string,
	parentId: string | null,
	knownIds: ReadonlySet<string>,
): string | null {
	return parentId && parentId !== nodeId && knownIds.has(parentId) ? parentId : null;
}

export function createMediaContentStructureDraft(
	remoteNodes: readonly RemoteMediaNode[],
): MediaDraftNode[] {
	const knownIds = new Set(remoteNodes.map(({ id }) => id));
	const children = new Map<string | null, RemoteMediaNode[]>();
	for (const node of remoteNodes) {
		const parentId = normalizeParentId(node.id, node.parentId, knownIds);
		const siblings = children.get(parentId);
		if (siblings) siblings.push(node);
		else children.set(parentId, [node]);
	}
	for (const siblings of children.values()) siblings.sort(compareRemoteNodes);
	const orderByNodeId = new Map<string, number>();
	for (const siblings of children.values())
		siblings.forEach((node, order) => orderByNodeId.set(node.id, order));
	return remoteNodes.map((node) => ({
		state: "existing",
		id: node.id,
		parentId: normalizeParentId(node.id, node.parentId, knownIds),
		order: orderByNodeId.get(node.id) ?? 0,
		title: node.title,
		contentUnitId: node.contentUnitId,
		contentKind: node.contentKind,
		language: node.language,
		durationSeconds: node.durationSeconds,
	}));
}

export function buildMediaDraftTree(nodes: readonly MediaDraftNode[]): MediaDraftTreeNode[] {
	const knownIds = new Set(nodes.map(({ id }) => id));
	const children = new Map<string | null, MediaDraftNode[]>();
	for (const node of nodes) {
		const parentId = normalizeParentId(node.id, node.parentId, knownIds);
		const siblings = children.get(parentId);
		if (siblings) siblings.push(node);
		else children.set(parentId, [node]);
	}
	for (const siblings of children.values()) siblings.sort(compareDraftNodes);
	const seen = new Set<string>();
	function visit(node: MediaDraftNode, ancestors: ReadonlySet<string>): MediaDraftTreeNode {
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
	for (const node of nodes.toSorted(compareDraftNodes))
		if (!seen.has(node.id)) roots.push(visit(node, new Set()));
	return roots;
}

export function flattenMediaDraftTree(
	nodes: readonly MediaDraftTreeNode[],
	depth = 0,
): readonly { readonly node: MediaDraftNode; readonly depth: number }[] {
	return nodes.flatMap((entry) => [
		{ node: entry.node, depth },
		...flattenMediaDraftTree(entry.children, depth + 1),
	]);
}

export function addMediaDraftNode(
	nodes: readonly MediaDraftNode[],
	node: InsertedMediaDraftNodeInput,
): MediaDraftNode[] {
	const order = nodes.filter(({ parentId }) => parentId === node.parentId).length;
	return [...nodes, { ...node, order }];
}

export function addMediaDraftNodeAfter(
	nodes: readonly MediaDraftNode[],
	node: InsertedMediaDraftNodeInput,
	siblingId: string,
): MediaDraftNode[] {
	const sibling = nodes.find(({ id }) => id === siblingId);
	if (!sibling || sibling.parentId !== node.parentId) return addMediaDraftNode(nodes, node);
	const siblings = nodes
		.filter(({ parentId }) => parentId === node.parentId)
		.toSorted(compareDraftNodes);
	const siblingIndex = siblings.findIndex(({ id }) => id === siblingId);
	if (siblingIndex < 0) return addMediaDraftNode(nodes, node);
	const inserted = [
		...siblings.slice(0, siblingIndex + 1),
		{ ...node, order: siblingIndex + 1 },
		...siblings.slice(siblingIndex + 1),
	];
	const reordered = new Map(
		inserted.map((entry, order) => [entry.id, { ...entry, order }] as const),
	);
	const insertedNode = reordered.get(node.id);
	return insertedNode
		? [...nodes.map((entry) => reordered.get(entry.id) ?? entry), insertedNode]
		: addMediaDraftNode(nodes, node);
}

export function findLastMediaDraftLabelId(nodes: readonly MediaDraftNode[]): string | null {
	let lastLabelId: string | null = null;
	for (const { node } of flattenMediaDraftTree(buildMediaDraftTree(nodes)))
		if (isMediaDraftParentTarget(node)) lastLabelId = node.id;
	return lastLabelId;
}

export function renameMediaDraftNode(
	nodes: readonly MediaDraftNode[],
	nodeId: string,
	title: string,
): MediaDraftNode[] {
	const normalizedTitle = title.trim();
	if (!normalizedTitle) return [...nodes];
	return nodes.map((node) => (node.id === nodeId ? { ...node, title: normalizedTitle } : node));
}

function descendantIds(
	nodes: readonly MediaDraftNode[],
	parentIds: ReadonlySet<string>,
): ReadonlySet<string> {
	const childrenByParentId = new Map<string, string[]>();
	for (const node of nodes) {
		if (!node.parentId) continue;
		const children = childrenByParentId.get(node.parentId);
		if (children) children.push(node.id);
		else childrenByParentId.set(node.parentId, [node.id]);
	}
	const descendants = new Set<string>();
	const stack = [...parentIds];
	while (stack.length) {
		const parentId = stack.pop();
		if (!parentId) continue;
		for (const childId of childrenByParentId.get(parentId) ?? []) {
			if (descendants.has(childId) || parentIds.has(childId)) continue;
			descendants.add(childId);
			stack.push(childId);
		}
	}
	return descendants;
}

export function getMediaDraftSelectionRoots(
	nodes: readonly MediaDraftNode[],
	selectedIds: ReadonlySet<string>,
): MediaDraftNode[] {
	const selected = new Set(nodes.filter(({ id }) => selectedIds.has(id)).map(({ id }) => id));
	const roots: MediaDraftNode[] = [];
	function visit(entries: readonly MediaDraftTreeNode[], ancestorSelected: boolean): void {
		for (const entry of entries) {
			const nodeSelected = selected.has(entry.node.id);
			if (nodeSelected && !ancestorSelected) roots.push(entry.node);
			visit(entry.children, ancestorSelected || nodeSelected);
		}
	}
	visit(buildMediaDraftTree(nodes), false);
	return roots;
}

export function normalizeMediaDraftSelectionIds(
	nodes: readonly MediaDraftNode[],
	selectedIds: ReadonlySet<string>,
): ReadonlySet<string> {
	return new Set(getMediaDraftSelectionRoots(nodes, selectedIds).map(({ id }) => id));
}

export function indexMediaDraftSelectionCoverage(
	nodes: readonly MediaDraftNode[],
	selectedIds: ReadonlySet<string>,
): ReadonlyMap<string, string> {
	const roots = getMediaDraftSelectionRoots(nodes, selectedIds);
	const coverage = new Map(roots.map(({ id }) => [id, id] as const));
	const childrenByParentId = new Map<string, string[]>();
	for (const node of nodes) {
		if (!node.parentId) continue;
		const children = childrenByParentId.get(node.parentId);
		if (children) children.push(node.id);
		else childrenByParentId.set(node.parentId, [node.id]);
	}
	for (const root of roots) {
		const stack = [...(childrenByParentId.get(root.id) ?? [])];
		while (stack.length) {
			const nodeId = stack.pop();
			if (!nodeId || coverage.has(nodeId)) continue;
			coverage.set(nodeId, root.id);
			stack.push(...(childrenByParentId.get(nodeId) ?? []));
		}
	}
	return coverage;
}

export function getMediaDraftMoveTargetIds(
	nodes: readonly MediaDraftNode[],
	selectedIds: ReadonlySet<string>,
): ReadonlySet<string> {
	const roots = getMediaDraftSelectionRoots(nodes, selectedIds);
	const blocked = new Set(roots.map(({ id }) => id));
	for (const id of descendantIds(nodes, blocked)) blocked.add(id);
	return new Set(nodes.filter(({ id }) => !blocked.has(id)).map(({ id }) => id));
}

function siblingMap(nodes: readonly MediaDraftNode[]): Map<string | null, MediaDraftNode[]> {
	const result = new Map<string | null, MediaDraftNode[]>();
	for (const node of nodes.toSorted(compareDraftNodes)) {
		const siblings = result.get(node.parentId);
		if (siblings) siblings.push(node);
		else result.set(node.parentId, [node]);
	}
	return result;
}

export function moveMediaDraftSelection(
	nodes: readonly MediaDraftNode[],
	selectedIds: ReadonlySet<string>,
	target: MediaDraftDropTarget,
): MediaDraftNode[] {
	const roots = getMediaDraftSelectionRoots(nodes, selectedIds);
	if (!roots.length) return [...nodes];
	const movingIds = new Set(roots.map(({ id }) => id));
	const validTargetIds = getMediaDraftMoveTargetIds(nodes, selectedIds);
	const targetNode =
		target.kind === "node" ? nodes.find(({ id }) => id === target.nodeId) : undefined;
	if (target.kind === "node") {
		if (!targetNode || !validTargetIds.has(target.nodeId)) return [...nodes];
		if (target.placement === "inside" && !isMediaDraftParentTarget(targetNode)) return [...nodes];
	}
	const siblings = siblingMap(nodes);
	for (const [parentId, entries] of siblings)
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
	const reordered = new Map<string, MediaDraftNode>();
	for (const entries of siblings.values())
		entries.forEach((node, order) => reordered.set(node.id, { ...node, order }));
	return nodes.map((node) => reordered.get(node.id) ?? node);
}

export function moveMediaDraftSelectionToSiblingEdge(
	nodes: readonly MediaDraftNode[],
	selectedIds: ReadonlySet<string>,
	edge: "first" | "last",
): MediaDraftNode[] {
	const movingIds = new Set(getMediaDraftSelectionRoots(nodes, selectedIds).map(({ id }) => id));
	if (!movingIds.size) return [...nodes];
	const reordered = new Map<string, MediaDraftNode>();
	for (const siblings of siblingMap(nodes).values()) {
		const moving = siblings.filter(({ id }) => movingIds.has(id));
		if (!moving.length) continue;
		const stationary = siblings.filter(({ id }) => !movingIds.has(id));
		const ordered = edge === "first" ? [...moving, ...stationary] : [...stationary, ...moving];
		ordered.forEach((node, order) => reordered.set(node.id, { ...node, order }));
	}
	return nodes.map((node) => reordered.get(node.id) ?? node);
}

export function moveMediaDraftNode(
	nodes: readonly MediaDraftNode[],
	nodeId: string,
	edge: "first" | "last",
): MediaDraftNode[] {
	return moveMediaDraftSelectionToSiblingEdge(nodes, new Set([nodeId]), edge);
}

export function toMediaContentStructureSaveNodes(
	nodes: readonly MediaDraftNode[],
): MediaContentStructureSaveNode[] {
	return nodes
		.toSorted((left, right) => {
			if (left.parentId !== right.parentId)
				return (left.parentId ?? "").localeCompare(right.parentId ?? "");
			return compareDraftNodes(left, right);
		})
		.map((node) => {
			if (node.state === "existing")
				return {
					state: "existing",
					id: node.id,
					parentId: node.parentId,
					order: node.order,
					title: node.title,
				};
			if (node.state === "attached")
				return {
					state: "attached",
					id: node.id,
					parentId: node.parentId,
					order: node.order,
					contentUnitId: node.contentUnitId,
				};
			return {
				state: "new",
				id: node.id,
				parentId: node.parentId,
				order: node.order,
				title: node.title,
				language: node.language,
				contentKind: node.contentKind,
			};
		});
}

export function mediaContentStructureDraftFingerprint(nodes: readonly MediaDraftNode[]): string {
	return JSON.stringify(toMediaContentStructureSaveNodes(nodes));
}
