import {
	compareFractionalPositions,
	fractionalPositionBetween,
	rebalanceFractionalPositionSequence,
} from "../ordering/position";
import { peekActiveObservability } from "@rezics/observability";
import { RevisionedBatchCommandLimit } from "../history/revisioned-batch";
import {
	ContentStructureSnapshotSchema,
	diffContentStructureSnapshots,
	type ContentStructureDelta,
	type ContentStructureNodeState,
	type ContentStructureSnapshot,
	type ContentStructureTarget,
} from "./contracts";
import { ContentStructureInvalid } from "./errors";

export type ContentStructurePlacement =
	| { readonly kind: "start" | "end" }
	| { readonly kind: "before" | "after"; readonly nodeId: string };

type ContentStructureBatchCommandBase = {
	readonly opId: string;
};

export type ContentStructureBatchCommand =
	| (ContentStructureBatchCommandBase & {
			readonly type: "node.create";
			readonly nodeId: string;
			readonly parentId: string | null;
			readonly contentUnitId: string;
			readonly documentKey?: string | null;
			readonly target?: ContentStructureTarget;
			readonly contentRating?: ContentStructureNodeState["contentRating"];
			readonly realmTagQueryStrategy?: ContentStructureNodeState["realmTagQueryStrategy"];
			readonly placement?: ContentStructurePlacement;
			/** Exact position accepted only from compatibility adapters. */
			readonly position?: string;
	  })
	| (ContentStructureBatchCommandBase & {
			readonly type: "node.update";
			readonly nodeId: string;
			readonly contentUnitId?: string;
			readonly documentKey?: string | null;
			readonly target?: ContentStructureTarget;
			readonly contentRating?: ContentStructureNodeState["contentRating"];
			readonly realmTagQueryStrategy?: ContentStructureNodeState["realmTagQueryStrategy"];
	  })
	| (ContentStructureBatchCommandBase & {
			readonly type: "node.move";
			readonly nodeId: string;
			readonly parentId?: string | null;
			readonly placement?: ContentStructurePlacement;
			/** Exact position accepted only from compatibility adapters. */
			readonly position?: string;
	  })
	| (ContentStructureBatchCommandBase & {
			readonly type: "nodes.swap";
			readonly leftNodeId: string;
			readonly rightNodeId: string;
	  })
	| (ContentStructureBatchCommandBase & {
			readonly type: "node.deleteSubtree";
			readonly nodeId: string;
	  })
	| (ContentStructureBatchCommandBase & {
			readonly type: "structure.update";
			readonly documentKey: string | null;
	  });

export type ContentStructureBatchPlan = {
	readonly after: ContentStructureSnapshot;
	readonly delta: ContentStructureDelta | null;
	readonly results: readonly { readonly opId: string; readonly applied: true }[];
};

function invalid(command: ContentStructureBatchCommand, message: string): never {
	throw new ContentStructureInvalid(`Content Structure batch ${command.opId}: ${message}`);
}

function targetColumns(target: ContentStructureTarget) {
	switch (target.kind) {
		case "content":
		case "none":
			return { targetKind: target.kind, targetUnitId: null, targetUrl: null } as const;
		case "unit":
			return {
				targetKind: target.kind,
				targetUnitId: target.unitId,
				targetUrl: null,
			} as const;
		case "external":
			return { targetKind: target.kind, targetUnitId: null, targetUrl: target.url } as const;
	}
}

function orderedSiblings(nodes: ReadonlyMap<string, ContentStructureNodeState>) {
	const siblings = new Map<string | null, string[]>();
	for (const node of nodes.values()) {
		const ids = siblings.get(node.parentId) ?? [];
		ids.push(node.id);
		siblings.set(node.parentId, ids);
	}
	for (const ids of siblings.values())
		ids.sort((leftId, rightId) => {
			const left = nodes.get(leftId);
			const right = nodes.get(rightId);
			if (!left || !right) throw new Error("Content Structure sibling index is invalid");
			return (
				compareFractionalPositions(left.position, right.position) || left.id.localeCompare(right.id)
			);
		});
	return siblings;
}

function rebalanceDenseSiblingPositions(
	nodes: Map<string, ContentStructureNodeState>,
	siblings: ReadonlyMap<string | null, readonly string[]>,
	rebalancedNodeIds: Set<string>,
): void {
	for (const ids of siblings.values()) {
		const plan = rebalanceFractionalPositionSequence(
			ids.map((id) => {
				const node = nodes.get(id);
				if (!node) throw new Error("Content Structure sibling order references a missing node");
				return node.position;
			}),
		);
		for (const index of plan.changedIndexes) {
			const id = ids[index];
			const node = id ? nodes.get(id) : undefined;
			const position = plan.positions[index];
			if (!id || !node || !position)
				throw new Error("Content Structure sibling rebalance lost a node");
			nodes.set(id, { ...node, position });
			rebalancedNodeIds.add(id);
		}
	}
}

function insertAtPlacement(
	command: ContentStructureBatchCommand,
	nodes: ReadonlyMap<string, ContentStructureNodeState>,
	siblings: Map<string | null, string[]>,
	parentId: string | null,
	nodeId: string,
	placement: ContentStructurePlacement | undefined,
): string {
	const ids = siblings.get(parentId) ?? [];
	let index: number;
	if (!placement || placement.kind === "end") index = ids.length;
	else if (placement.kind === "start") index = 0;
	else if ("nodeId" in placement) {
		if (placement.nodeId === nodeId) invalid(command, "placement cannot reference the moved node");
		const anchor = nodes.get(placement.nodeId);
		if (!anchor || anchor.parentId !== parentId)
			invalid(command, "placement anchor is not a sibling at the destination");
		const anchorIndex = ids.indexOf(anchor.id);
		if (anchorIndex < 0) throw new Error("Content Structure sibling index lost its anchor");
		index = placement.kind === "before" ? anchorIndex : anchorIndex + 1;
	} else throw new Error("Unsupported Content Structure placement");
	const before = index > 0 ? nodes.get(ids[index - 1]!)?.position : null;
	const after = index < ids.length ? nodes.get(ids[index]!)?.position : null;
	ids.splice(index, 0, nodeId);
	siblings.set(parentId, ids);
	return fractionalPositionBetween(before, after);
}

function insertAtExactPosition(
	command: ContentStructureBatchCommand,
	nodes: ReadonlyMap<string, ContentStructureNodeState>,
	siblings: Map<string | null, string[]>,
	parentId: string | null,
	nodeId: string,
	position: string,
): void {
	const ids = siblings.get(parentId) ?? [];
	if (ids.some((id) => nodes.get(id)?.position === position))
		invalid(command, "position is already used by a destination sibling");
	ids.push(nodeId);
	ids.sort((leftId, rightId) => {
		const left = nodes.get(leftId);
		const right = nodes.get(rightId);
		if (!left || !right) throw new Error("Content Structure sibling index is invalid");
		return (
			compareFractionalPositions(left.position, right.position) || left.id.localeCompare(right.id)
		);
	});
	siblings.set(parentId, ids);
}

function removeFromSiblings(
	siblings: Map<string | null, string[]>,
	parentId: string | null,
	nodeId: string,
): void {
	const ids = siblings.get(parentId);
	if (!ids) throw new Error("Content Structure sibling index is missing a parent");
	const index = ids.indexOf(nodeId);
	if (index < 0) throw new Error("Content Structure sibling index is missing a node");
	ids.splice(index, 1);
}

function nodeMeaning(node: ContentStructureNodeState) {
	const { updatedAt: _updatedAt, ...meaning } = node;
	return meaning;
}

/**
 * Applies an ordered command batch to an in-memory snapshot and proves the
 * complete resulting tree before any database write is allowed.
 */
export function planContentStructureBatch(
	before: ContentStructureSnapshot,
	commands: readonly ContentStructureBatchCommand[],
	now = new Date(),
): ContentStructureBatchPlan {
	if (!commands.length) throw new ContentStructureInvalid("Content Structure batch is empty");
	if (commands.length > RevisionedBatchCommandLimit)
		throw new ContentStructureInvalid(
			`Content Structure batch exceeds ${RevisionedBatchCommandLimit} commands`,
		);
	const opIds = new Set<string>();
	for (const command of commands) {
		if (opIds.has(command.opId)) invalid(command, "opId must be unique within the batch");
		opIds.add(command.opId);
	}

	const originalById = new Map(before.nodes.map((node) => [node.id, node] as const));
	const reservedNodeIds = new Set(originalById.keys());
	const nodes = new Map(before.nodes.map((node) => [node.id, { ...node }] as const));
	const siblings = orderedSiblings(nodes);
	const rebalancedNodeIds = new Set<string>();
	rebalanceDenseSiblingPositions(nodes, siblings, rebalancedNodeIds);
	let structure = { ...before.structure };

	for (const command of commands) {
		switch (command.type) {
			case "node.create": {
				if (command.position !== undefined && command.placement !== undefined)
					invalid(command, "position and placement are mutually exclusive");
				if (reservedNodeIds.has(command.nodeId))
					invalid(command, "node id already exists or was already used in this batch");
				reservedNodeIds.add(command.nodeId);
				if (command.parentId !== null && !nodes.has(command.parentId))
					invalid(command, "parent node does not exist at this point in the batch");
				const target = targetColumns(command.target ?? { kind: "content" });
				const node: ContentStructureNodeState = {
					id: command.nodeId,
					structureId: before.structure.id,
					ownerUnitId: before.structure.ownerUnitId,
					parentId: command.parentId,
					contentUnitId: command.contentUnitId,
					documentKey: command.documentKey ?? null,
					...target,
					position: "a0",
					contentRating: command.contentRating ?? null,
					realmTagQueryStrategy: command.realmTagQueryStrategy ?? null,
					deletedAt: null,
					createdAt: now,
					updatedAt: now,
				};
				nodes.set(node.id, node);
				if (command.position === undefined)
					node.position = insertAtPlacement(
						command,
						nodes,
						siblings,
						node.parentId,
						node.id,
						command.placement,
					);
				else {
					node.position = command.position;
					insertAtExactPosition(command, nodes, siblings, node.parentId, node.id, node.position);
				}
				break;
			}
			case "node.update": {
				const current = nodes.get(command.nodeId);
				if (!current) invalid(command, "node does not exist at this point in the batch");
				const target = command.target ? targetColumns(command.target) : undefined;
				nodes.set(command.nodeId, {
					...current,
					...(command.contentUnitId === undefined ? {} : { contentUnitId: command.contentUnitId }),
					...(command.documentKey === undefined ? {} : { documentKey: command.documentKey }),
					...(target ?? {}),
					...(command.contentRating === undefined ? {} : { contentRating: command.contentRating }),
					...(command.realmTagQueryStrategy === undefined
						? {}
						: { realmTagQueryStrategy: command.realmTagQueryStrategy }),
				});
				break;
			}
			case "node.move": {
				if (command.position !== undefined && command.placement !== undefined)
					invalid(command, "position and placement are mutually exclusive");
				const current = nodes.get(command.nodeId);
				if (!current) invalid(command, "node does not exist at this point in the batch");
				const parentId = command.parentId === undefined ? current.parentId : command.parentId;
				if (parentId === command.nodeId) invalid(command, "node cannot parent itself");
				if (parentId !== null && !nodes.has(parentId))
					invalid(command, "parent node does not exist at this point in the batch");
				removeFromSiblings(siblings, current.parentId, current.id);
				const next = { ...current, parentId };
				nodes.set(next.id, next);
				if (command.position === undefined)
					next.position = insertAtPlacement(
						command,
						nodes,
						siblings,
						next.parentId,
						next.id,
						command.placement,
					);
				else {
					next.position = command.position;
					insertAtExactPosition(command, nodes, siblings, next.parentId, next.id, next.position);
				}
				break;
			}
			case "nodes.swap": {
				if (command.leftNodeId === command.rightNodeId)
					invalid(command, "swap requires two different nodes");
				const left = nodes.get(command.leftNodeId);
				const right = nodes.get(command.rightNodeId);
				if (!left || !right) invalid(command, "both swapped nodes must exist");
				const leftIds = siblings.get(left.parentId);
				const rightIds = siblings.get(right.parentId);
				if (!leftIds || !rightIds) throw new Error("Content Structure swap lost sibling state");
				const leftIndex = leftIds.indexOf(left.id);
				const rightIndex = rightIds.indexOf(right.id);
				if (leftIndex < 0 || rightIndex < 0) throw new Error("Content Structure swap lost a node");
				if (left.parentId === right.parentId) {
					leftIds[leftIndex] = right.id;
					leftIds[rightIndex] = left.id;
				} else {
					leftIds[leftIndex] = right.id;
					rightIds[rightIndex] = left.id;
				}
				nodes.set(left.id, {
					...left,
					parentId: right.parentId,
					position: right.position,
				});
				nodes.set(right.id, {
					...right,
					parentId: left.parentId,
					position: left.position,
				});
				break;
			}
			case "node.deleteSubtree": {
				const root = nodes.get(command.nodeId);
				if (!root) invalid(command, "node does not exist at this point in the batch");
				removeFromSiblings(siblings, root.parentId, root.id);
				const pending = [root.id];
				for (let index = 0; index < pending.length; index += 1) {
					const nodeId = pending[index]!;
					pending.push(...(siblings.get(nodeId) ?? []));
					nodes.delete(nodeId);
					siblings.delete(nodeId);
				}
				break;
			}
			case "structure.update":
				structure = { ...structure, documentKey: command.documentKey };
				break;
		}
	}
	rebalanceDenseSiblingPositions(nodes, siblings, rebalancedNodeIds);
	if (rebalancedNodeIds.size)
		peekActiveObservability()?.metrics.fractionalPositionRebalanced(
			"content-structure",
			rebalancedNodeIds.size,
		);

	for (const [id, node] of nodes) {
		const original = originalById.get(id);
		if (original && JSON.stringify(nodeMeaning(original)) !== JSON.stringify(nodeMeaning(node)))
			nodes.set(id, { ...node, updatedAt: now });
	}
	const candidate = ContentStructureSnapshotSchema.parse({
		version: 1,
		structure,
		nodes: [...nodes.values()],
	});
	const semanticDelta = diffContentStructureSnapshots(before, candidate);
	const after = semanticDelta
		? ContentStructureSnapshotSchema.parse({
				...candidate,
				structure: { ...candidate.structure, updatedAt: now },
			})
		: candidate;
	return {
		after,
		delta: diffContentStructureSnapshots(before, after),
		results: commands.map(({ opId }) => ({ opId, applied: true as const })),
	};
}
