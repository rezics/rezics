import type { ContentLanguage } from "@rezics/i18n";

import { ContentStructureInvalid } from "./errors";
import { planDraftSiblingPositions } from "./draft-batch";

export type ExistingBookDraftNode = {
	readonly state: "existing";
	readonly id: string;
	readonly parentId: string | null;
	readonly order: number;
	readonly title: string;
};

type NewBookDraftNodeBase = {
	readonly state: "new";
	readonly id: string;
	readonly parentId: string | null;
	readonly order: number;
	readonly title: string;
	readonly language: ContentLanguage;
};

export type NewBookDraftNode =
	| (NewBookDraftNodeBase & {
			readonly contentKind: "chapter";
			readonly content: unknown;
			readonly status: "draft" | "published";
	  })
	| (NewBookDraftNodeBase & {
			readonly contentKind: "label";
			readonly content?: never;
			readonly status?: never;
	  });

export type AttachedBookDraftNode = {
	readonly state: "attached";
	readonly id: string;
	readonly parentId: string | null;
	readonly order: number;
	readonly title: string;
	readonly contentUnitId: string;
};

export type BookDraftNode = ExistingBookDraftNode | NewBookDraftNode | AttachedBookDraftNode;

export type CurrentBookDraftNode = {
	readonly id: string;
	readonly parentId: string | null;
	readonly position: string;
	readonly title: string;
};

export type PlannedBookDraftNode = BookDraftNode & {
	readonly title: string;
	readonly position: string;
};

export type BookDraftPlan = {
	readonly nodes: readonly PlannedBookDraftNode[];
	readonly deletedNodeIds: ReadonlySet<string>;
	readonly hasChanges: boolean;
	readonly hasStructuralChanges: boolean;
	readonly renamedExistingNodeIds: ReadonlySet<string>;
};

export type ContentStructureDraftNodeBase = {
	readonly state: "existing" | "new" | "attached";
	readonly id: string;
	readonly parentId: string | null;
	readonly order: number;
	readonly title: string;
};

export type ContentStructureDraftPlan<Node extends ContentStructureDraftNodeBase> = {
	readonly nodes: readonly (Node & { readonly position: string })[];
	readonly deletedNodeIds: ReadonlySet<string>;
	readonly hasChanges: boolean;
	readonly hasStructuralChanges: boolean;
	readonly renamedExistingNodeIds: ReadonlySet<string>;
};

function invalid(message: string): never {
	throw new ContentStructureInvalid(message);
}

/**
 * Proves that a complete Book Content Structure draft is a closed, acyclic tree
 * and derives the minimal sibling lists that need new fractional positions.
 */
export function planContentStructureDraft<Node extends ContentStructureDraftNodeBase>(
	currentNodes: readonly CurrentBookDraftNode[],
	draftNodes: readonly Node[],
): ContentStructureDraftPlan<Node> {
	const currentById = new Map(currentNodes.map((node) => [node.id, node]));
	const draftById = new Map<string, Node>();
	for (const draft of draftNodes) {
		if (draftById.has(draft.id)) invalid(`Duplicate draft node ${draft.id}`);
		if (
			!Number.isSafeInteger(draft.order) ||
			draft.order < 0 ||
			draft.order >= draftNodes.length
		)
			invalid(`Draft node ${draft.id} has an invalid sibling order`);
		const title = draft.title.trim();
		if (!title) invalid(`Draft node ${draft.id} has a blank title`);
		if (draft.state === "existing" && !currentById.has(draft.id))
			invalid(`Existing draft node ${draft.id} does not belong to this structure`);
		if (draft.state !== "existing" && currentById.has(draft.id))
			invalid(`New draft node ${draft.id} already exists`);
		draftById.set(draft.id, { ...draft, title });
	}

	const visitState = new Map<string, "visiting" | "visited">();
	for (const startId of draftById.keys()) {
		if (visitState.get(startId) === "visited") continue;
		const path: string[] = [];
		let nodeId: string | null = startId;
		while (nodeId !== null) {
			const state = visitState.get(nodeId);
			if (state === "visiting") invalid(`Draft node ${nodeId} creates a cycle`);
			if (state === "visited") break;
			const node = draftById.get(nodeId);
			if (!node) invalid(`Draft node ${nodeId} does not exist`);
			visitState.set(nodeId, "visiting");
			path.push(nodeId);
			if (node.parentId === node.id) invalid(`Draft node ${node.id} cannot parent itself`);
			if (node.parentId !== null && !draftById.has(node.parentId))
				invalid(`Draft node ${node.id} has a missing parent`);
			nodeId = node.parentId;
		}
		for (const pathNodeId of path) visitState.set(pathNodeId, "visited");
	}

	const draftSiblingIds = new Map<string | null, string[]>();
	for (const node of draftById.values()) {
		const siblings = draftSiblingIds.get(node.parentId) ?? [];
		if (siblings[node.order] !== undefined)
			invalid(`Draft siblings under ${node.parentId ?? "root"} repeat order ${node.order}`);
		siblings[node.order] = node.id;
		draftSiblingIds.set(node.parentId, siblings);
	}
	for (const [parentId, siblingIds] of draftSiblingIds) {
		if (
			Array.from({ length: siblingIds.length }, (_, index) => siblingIds[index]).some(
				(id) => id === undefined,
			)
		)
			invalid(`Draft siblings under ${parentId ?? "root"} must use contiguous orders`);
	}

	const retainedIds = new Set(draftById.keys());
	const deletedNodeIds = new Set(
		currentNodes.filter(({ id }) => !retainedIds.has(id)).map(({ id }) => id),
	);
	const positionById = planDraftSiblingPositions({
		currentNodes,
		desiredNodes: [...draftById.values()],
	});

	const renamedExistingNodeIds = new Set<string>();
	const nodes = [...draftById.values()]
		.toSorted((left, right) => {
			if (left.parentId !== right.parentId)
				return (left.parentId ?? "").localeCompare(right.parentId ?? "");
			return left.order - right.order;
		})
		.map((node): Node & { readonly position: string } => {
			const current = currentById.get(node.id);
			if (node.state === "existing" && current && current.title !== node.title)
				renamedExistingNodeIds.add(node.id);
			const position = positionById.get(node.id);
			if (!position) throw new Error("Draft node has no planned position");
			return {
				...node,
				position,
			};
		});
	const hasStructuralChanges =
		nodes.some((node) => node.state !== "existing") ||
		deletedNodeIds.size > 0 ||
		nodes.some((node) => {
			const current = currentById.get(node.id);
			return current
				? current.parentId !== node.parentId || current.position !== node.position
				: false;
		});
	return {
		nodes,
		deletedNodeIds,
		hasChanges: hasStructuralChanges || renamedExistingNodeIds.size > 0,
		hasStructuralChanges,
		renamedExistingNodeIds,
	};
}

/**
 * Proves that a complete Book Content Structure draft is a closed, acyclic tree
 * and derives the minimal sibling lists that need new fractional positions.
 */
export function planBookContentStructureDraft(
	currentNodes: readonly CurrentBookDraftNode[],
	draftNodes: readonly BookDraftNode[],
): BookDraftPlan {
	return planContentStructureDraft(currentNodes, draftNodes);
}
