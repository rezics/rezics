import type {
	GetApiUnitsBookByUnitIdContentStructureNodesStatus200,
	PutApiUnitsBookByUnitIdContentStructureBody,
} from "@rezics/openapi-tanstack-query";

type RemoteBookNode = GetApiUnitsBookByUnitIdContentStructureNodesStatus200["items"][number];
export type BookContentStructureSaveNode =
	PutApiUnitsBookByUnitIdContentStructureBody["nodes"][number];
type NewBookContentStructureSaveNode = Extract<BookContentStructureSaveNode, { state: "new" }>;

type BookDraftNodeBase = {
	readonly id: string;
	readonly parentId: string | null;
	readonly order: number;
	readonly title: string;
};

export type ExistingBookDraftNode = BookDraftNodeBase & {
	readonly state: "existing";
	readonly contentUnitId: string;
	readonly contentKind: "chapter" | "chapter_group";
	readonly language: "zh" | "en";
};

export type NewBookDraftNode = BookDraftNodeBase &
	(
		| (Extract<NewBookContentStructureSaveNode, { contentKind: "chapter" }> & {
				readonly state: "new";
		  })
		| (Extract<NewBookContentStructureSaveNode, { contentKind: "chapter_group" }> & {
				readonly state: "new";
		  })
	);

export type BookDraftNode = ExistingBookDraftNode | NewBookDraftNode;
export type NewBookDraftNodeInput = NewBookDraftNode extends infer Node
	? Node extends NewBookDraftNode
		? Omit<Node, "order">
		: never
	: never;

export type BookDraftTreeNode = {
	readonly node: BookDraftNode;
	readonly children: readonly BookDraftTreeNode[];
};

export type BookDraftDropTarget =
	| { readonly kind: "root" }
	| {
			readonly kind: "node";
			readonly nodeId: string;
			readonly placement: "before" | "inside" | "after";
	  };

/**
 * Identifies nodes that may receive children through the book structure editor.
 *
 * @remarks
 * This is intentionally a frontend authoring rule: chapters created or moved by
 * the editor remain leaves, while labels may contain chapters or other labels.
 * The backend does not need to enforce this experience-only convention because
 * bypassing it affects only the bypassing author's own structure. Existing
 * non-leaf chapters are still accepted and rendered as labels by the frontend.
 */
export function isBookDraftParentTarget(node: BookDraftNode): boolean {
	return node.contentKind === "chapter_group";
}

function compareRemoteNodes(left: RemoteBookNode, right: RemoteBookNode): number {
	return left.position < right.position ? -1 : left.position > right.position ? 1 : 0;
}

function compareDraftNodes(left: BookDraftNode, right: BookDraftNode): number {
	return left.order - right.order || left.id.localeCompare(right.id);
}

export function createBookContentStructureDraft(
	remoteNodes: readonly RemoteBookNode[],
): BookDraftNode[] {
	const knownIds = new Set(remoteNodes.map(({ id }) => id));
	const children = new Map<string | null, RemoteBookNode[]>();
	for (const node of remoteNodes) {
		const parentId =
			node.parentId && node.parentId !== node.id && knownIds.has(node.parentId)
				? node.parentId
				: null;
		children.set(parentId, [...(children.get(parentId) ?? []), node]);
	}
	for (const siblings of children.values()) siblings.sort(compareRemoteNodes);
	return remoteNodes.map((node) => {
		const parentId =
			node.parentId && node.parentId !== node.id && knownIds.has(node.parentId)
				? node.parentId
				: null;
		const order = (children.get(parentId) ?? []).findIndex(({ id }) => id === node.id);
		return {
			state: "existing",
			id: node.id,
			parentId,
			order,
			title: node.title,
			contentUnitId: node.contentUnitId,
			contentKind: node.contentKind,
			language: node.language,
		};
	});
}

export function buildBookDraftTree(nodes: readonly BookDraftNode[]): BookDraftTreeNode[] {
	const knownIds = new Set(nodes.map(({ id }) => id));
	const children = new Map<string | null, BookDraftNode[]>();
	for (const node of nodes) {
		const parentId =
			node.parentId && node.parentId !== node.id && knownIds.has(node.parentId)
				? node.parentId
				: null;
		children.set(parentId, [...(children.get(parentId) ?? []), node]);
	}
	for (const siblings of children.values()) siblings.sort(compareDraftNodes);
	const seen = new Set<string>();
	function visit(node: BookDraftNode, ancestors: ReadonlySet<string>): BookDraftTreeNode {
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
	for (const node of nodes.toSorted(compareDraftNodes)) {
		if (!seen.has(node.id)) roots.push(visit(node, new Set()));
	}
	return roots;
}

export function flattenBookDraftTree(nodes: readonly BookDraftTreeNode[]): BookDraftNode[] {
	return nodes.flatMap((entry) => [entry.node, ...flattenBookDraftTree(entry.children)]);
}

export function addBookDraftNode(
	nodes: readonly BookDraftNode[],
	node: NewBookDraftNodeInput,
): BookDraftNode[] {
	const order = nodes.filter(({ parentId }) => parentId === node.parentId).length;
	return [...nodes, { ...node, order }];
}

export function addBookDraftNodeAfter(
	nodes: readonly BookDraftNode[],
	node: NewBookDraftNodeInput,
	siblingId: string,
): BookDraftNode[] {
	const sibling = nodes.find(({ id }) => id === siblingId);
	if (!sibling || sibling.parentId !== node.parentId) return addBookDraftNode(nodes, node);

	const siblings = nodes
		.filter(({ parentId }) => parentId === node.parentId)
		.toSorted(compareDraftNodes);
	const siblingIndex = siblings.findIndex(({ id }) => id === siblingId);
	if (siblingIndex < 0) return addBookDraftNode(nodes, node);
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
		: addBookDraftNode(nodes, node);
}

export function findLastBookDraftLabelId(nodes: readonly BookDraftNode[]): string | null {
	let lastLabelId: string | null = null;
	for (const node of flattenBookDraftTree(buildBookDraftTree(nodes))) {
		if (isBookDraftParentTarget(node)) lastLabelId = node.id;
	}
	return lastLabelId;
}

export function renameBookDraftNode(
	nodes: readonly BookDraftNode[],
	nodeId: string,
	title: string,
): BookDraftNode[] {
	const normalizedTitle = title.trim();
	if (!normalizedTitle) return [...nodes];
	return nodes.map((node) => (node.id === nodeId ? { ...node, title: normalizedTitle } : node));
}

function descendantIds(nodes: readonly BookDraftNode[], parentIds: ReadonlySet<string>) {
	const descendants = new Set<string>();
	let frontier = new Set(parentIds);
	while (frontier.size) {
		const next = new Set<string>();
		for (const node of nodes) {
			if (node.parentId && frontier.has(node.parentId) && !descendants.has(node.id)) {
				descendants.add(node.id);
				next.add(node.id);
			}
		}
		frontier = next;
	}
	return descendants;
}

export function getBookDraftSelectionRoots(
	nodes: readonly BookDraftNode[],
	selectedIds: ReadonlySet<string>,
): BookDraftNode[] {
	const selected = new Set(nodes.filter(({ id }) => selectedIds.has(id)).map(({ id }) => id));
	const selectedDescendants = descendantIds(nodes, selected);
	return flattenBookDraftTree(buildBookDraftTree(nodes)).filter(
		(node) => selected.has(node.id) && !selectedDescendants.has(node.id),
	);
}

export function getBookDraftMoveTargetIds(
	nodes: readonly BookDraftNode[],
	selectedIds: ReadonlySet<string>,
): ReadonlySet<string> {
	const roots = getBookDraftSelectionRoots(nodes, selectedIds);
	const blocked = new Set(roots.map(({ id }) => id));
	for (const id of descendantIds(nodes, blocked)) blocked.add(id);
	return new Set(nodes.filter(({ id }) => !blocked.has(id)).map(({ id }) => id));
}

function siblingMap(nodes: readonly BookDraftNode[]): Map<string | null, BookDraftNode[]> {
	const result = new Map<string | null, BookDraftNode[]>();
	for (const node of nodes.toSorted(compareDraftNodes))
		result.set(node.parentId, [...(result.get(node.parentId) ?? []), node]);
	return result;
}

export function moveBookDraftSelection(
	nodes: readonly BookDraftNode[],
	selectedIds: ReadonlySet<string>,
	target: BookDraftDropTarget,
): BookDraftNode[] {
	const roots = getBookDraftSelectionRoots(nodes, selectedIds);
	if (!roots.length) return [...nodes];
	const movingIds = new Set(roots.map(({ id }) => id));
	const validTargetIds = getBookDraftMoveTargetIds(nodes, selectedIds);
	const targetNode =
		target.kind === "node" ? nodes.find(({ id }) => id === target.nodeId) : undefined;
	if (target.kind === "node") {
		if (!targetNode || !validTargetIds.has(target.nodeId)) return [...nodes];
		if (target.placement === "inside" && !isBookDraftParentTarget(targetNode))
			return [...nodes];
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

	const reordered = new Map<string, BookDraftNode>();
	for (const entries of siblings.values())
		entries.forEach((node, order) => reordered.set(node.id, { ...node, order }));
	return nodes.map((node) => reordered.get(node.id) ?? node);
}

export function moveBookDraftSelectionToSiblingEdge(
	nodes: readonly BookDraftNode[],
	selectedIds: ReadonlySet<string>,
	edge: "first" | "last",
): BookDraftNode[] {
	const movingIds = new Set(getBookDraftSelectionRoots(nodes, selectedIds).map(({ id }) => id));
	if (!movingIds.size) return [...nodes];

	const reordered = new Map<string, BookDraftNode>();
	for (const siblings of siblingMap(nodes).values()) {
		const moving = siblings.filter(({ id }) => movingIds.has(id));
		if (!moving.length) continue;
		const stationary = siblings.filter(({ id }) => !movingIds.has(id));
		const ordered = edge === "first" ? [...moving, ...stationary] : [...stationary, ...moving];
		ordered.forEach((node, order) => reordered.set(node.id, { ...node, order }));
	}
	return nodes.map((node) => reordered.get(node.id) ?? node);
}

export function toBookContentStructureSaveNodes(
	nodes: readonly BookDraftNode[],
): BookContentStructureSaveNode[] {
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
			if (node.contentKind === "chapter")
				return {
					state: "new",
					id: node.id,
					parentId: node.parentId,
					order: node.order,
					title: node.title,
					language: node.language,
					contentKind: "chapter",
					content: node.content,
					status: node.status,
				};
			return {
				state: "new",
				id: node.id,
				parentId: node.parentId,
				order: node.order,
				title: node.title,
				language: node.language,
				contentKind: "chapter_group",
			};
		});
}

export function bookContentStructureDraftFingerprint(nodes: readonly BookDraftNode[]): string {
	return JSON.stringify(toBookContentStructureSaveNodes(nodes));
}
