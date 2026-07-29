import type { NavigationDocument, NavigationItem } from "@rezics/block";

import { buildEditableTree } from "@/features/content-structure/model/editable-tree";

export type WikiNavigationDraftNode = {
	readonly id: string;
	readonly parentId: string | null;
	readonly order: number;
	readonly labelUnitId: string;
	readonly kind: "group" | "link";
	readonly targetUnitId?: string;
};

function flattenItems(
	items: readonly NavigationItem[],
	parentId: string | null,
	result: WikiNavigationDraftNode[],
): void {
	items.forEach((item, order) => {
		const node: WikiNavigationDraftNode =
			"children" in item
				? {
						id: item._key,
						parentId,
						order,
						labelUnitId: item.labelUnitId,
						kind: "group",
					}
				: {
						id: item._key,
						parentId,
						order,
						labelUnitId: item.labelUnitId,
						kind: "link",
						targetUnitId: item.target.kind === "unit" ? item.target.unitId : undefined,
					};
		result.push(node);
		if ("children" in item) flattenItems(item.children, item._key, result);
	});
}

export function createWikiNavigationDraft(document: NavigationDocument): WikiNavigationDraftNode[] {
	const result: WikiNavigationDraftNode[] = [];
	flattenItems(document.items, null, result);
	return result;
}

export function createWikiNavigationDraftNode(input: {
	readonly id: string;
	readonly kind: "group" | "link";
	readonly order: number;
	readonly parentId: string | null;
}): WikiNavigationDraftNode {
	return {
		id: input.id,
		parentId: input.parentId,
		order: input.order,
		labelUnitId: "",
		kind: input.kind,
		...(input.kind === "link" ? { targetUnitId: "" } : {}),
	};
}

export function updateWikiNavigationDraftNode(
	nodes: readonly WikiNavigationDraftNode[],
	nodeId: string,
	change: Partial<Pick<WikiNavigationDraftNode, "labelUnitId" | "targetUnitId">>,
): WikiNavigationDraftNode[] {
	return nodes.map((node) => (node.id === nodeId ? { ...node, ...change } : node));
}

function toItems(
	entries: ReturnType<typeof buildEditableTree<WikiNavigationDraftNode>>,
): NavigationItem[] {
	return entries.map(({ node, children }) =>
		node.kind === "group"
			? {
					_key: node.id,
					labelUnitId: node.labelUnitId,
					children: toItems(children),
				}
			: {
					_key: node.id,
					labelUnitId: node.labelUnitId,
					target: { kind: "unit", unitId: node.targetUnitId ?? "" },
				},
	);
}

export function toWikiNavigationDocument(
	nodes: readonly WikiNavigationDraftNode[],
	documentKey: string,
): NavigationDocument {
	return {
		_type: "navigation-document",
		_key: documentKey,
		items: toItems(buildEditableTree(nodes)),
	};
}

function subtreeDepth(
	nodeId: string,
	childrenByParentId: ReadonlyMap<string, readonly WikiNavigationDraftNode[]>,
): number {
	let maximum = 1;
	const stack = [{ id: nodeId, depth: 1 }];
	while (stack.length) {
		const current = stack.pop();
		if (!current) break;
		maximum = Math.max(maximum, current.depth);
		for (const child of childrenByParentId.get(current.id) ?? [])
			stack.push({ id: child.id, depth: current.depth + 1 });
	}
	return maximum;
}

export function wikiNavigationDraftIsValid(nodes: readonly WikiNavigationDraftNode[]): boolean {
	if (!nodes.length || nodes.length > 200) return false;
	if (!wikiNavigationDraftTreeIsValid(nodes)) return false;
	const childrenByParentId = new Map<string, WikiNavigationDraftNode[]>();
	let rootCount = 0;
	for (const node of nodes) {
		if (!node.labelUnitId) return false;
		if (node.kind === "link" && !node.targetUnitId) return false;
		if (node.parentId === null) rootCount += 1;
		else {
			const children = childrenByParentId.get(node.parentId);
			if (children) children.push(node);
			else childrenByParentId.set(node.parentId, [node]);
		}
	}
	if (rootCount < 1 || rootCount > 100) return false;
	for (const node of nodes) {
		if (node.kind === "group" && !(childrenByParentId.get(node.id)?.length ?? 0)) return false;
		if (node.parentId === null && subtreeDepth(node.id, childrenByParentId) > 3) return false;
	}
	return true;
}

export function wikiNavigationDraftTreeIsValid(nodes: readonly WikiNavigationDraftNode[]): boolean {
	const byId = new Map(nodes.map((node) => [node.id, node]));
	if (byId.size !== nodes.length) return false;
	const childrenByParentId = new Map<string, WikiNavigationDraftNode[]>();
	let rootCount = 0;
	for (const node of nodes) {
		if (node.parentId === null) rootCount += 1;
		else {
			const parent = byId.get(node.parentId);
			if (!parent || parent.kind !== "group") return false;
			const children = childrenByParentId.get(node.parentId);
			if (children) children.push(node);
			else childrenByParentId.set(node.parentId, [node]);
		}
	}
	if (rootCount > 100) return false;
	for (const node of nodes)
		if (node.parentId === null && subtreeDepth(node.id, childrenByParentId) > 3) return false;
	return true;
}

export function wikiNavigationDraftFingerprint(
	nodes: readonly WikiNavigationDraftNode[],
	documentKey: string,
): string {
	return JSON.stringify(toWikiNavigationDocument(nodes, documentKey));
}
