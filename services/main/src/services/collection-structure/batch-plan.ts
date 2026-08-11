import {
	compareFractionalPositions,
	fractionalPositionBetween,
	fractionalPositionsBetween,
	rebalanceFractionalPositionSequence,
} from "../ordering/position";
import { peekActiveObservability } from "@rezics/observability";
import { RevisionedBatchCommandLimit } from "../history/revisioned-batch";
import {
	diffCollectionStructureSnapshots,
	parseCollectionStructureSnapshot,
	type CollectionStructureDelta,
	type CollectionStructureItemState,
	type CollectionStructureSnapshot,
} from "./contracts";

export type CollectionBatchPlacement =
	| { readonly kind: "start" | "end" }
	| { readonly kind: "before" | "after"; readonly targetId: string };

type CollectionBatchCommandBase = { readonly opId: string };

export type CollectionBatchCommand =
	| (CollectionBatchCommandBase & {
			readonly type: "item.add";
			readonly targetId: string;
	  })
	| (CollectionBatchCommandBase & {
			readonly type: "item.remove";
			readonly targetId: string;
	  })
	| (CollectionBatchCommandBase & {
			readonly type: "items.move";
			readonly targetIds: readonly string[];
			readonly placement: CollectionBatchPlacement;
	  })
	| (CollectionBatchCommandBase & {
			readonly type: "items.swap";
			readonly leftTargetId: string;
			readonly rightTargetId: string;
	  });

export type CollectionBatchPlan = {
	readonly after: CollectionStructureSnapshot;
	readonly delta: CollectionStructureDelta | null;
	readonly results: readonly {
		readonly opId: string;
		readonly applied: true;
		readonly itemState?: "created" | "existing";
	}[];
};

function invalid(command: CollectionBatchCommand, message: string): never {
	throw new TypeError(`Collection batch ${command.opId}: ${message}`);
}

function orderedIds(items: ReadonlyMap<string, CollectionStructureItemState>): string[] {
	return [...items.values()]
		.sort(
			(left, right) =>
				compareFractionalPositions(left.position, right.position) ||
				left.targetUnitId.localeCompare(right.targetUnitId),
		)
		.map(({ targetUnitId }) => targetUnitId);
}

function insertionIndex(
	command: CollectionBatchCommand,
	ids: readonly string[],
	placement: CollectionBatchPlacement,
): number {
	if (placement.kind === "start") return 0;
	if (placement.kind === "end") return ids.length;
	if (!("targetId" in placement)) throw new Error("Unsupported Collection placement");
	const anchorIndex = ids.indexOf(placement.targetId);
	if (anchorIndex < 0) invalid(command, "placement target is not in the Collection");
	return placement.kind === "before" ? anchorIndex : anchorIndex + 1;
}

/** Plans a mixed Collection membership batch without mutating persistence. */
export function planCollectionBatch(input: {
	readonly before: CollectionStructureSnapshot;
	readonly commands: readonly CollectionBatchCommand[];
	readonly actorProfileId: string;
	readonly reviewSubjectByTargetId: ReadonlyMap<string, string>;
	readonly now?: Date;
}): CollectionBatchPlan {
	if (!input.commands.length) throw new TypeError("Collection batch is empty");
	if (input.commands.length > RevisionedBatchCommandLimit)
		throw new TypeError(`Collection batch exceeds ${RevisionedBatchCommandLimit} commands`);
	const opIds = new Set<string>();
	for (const command of input.commands) {
		if (opIds.has(command.opId)) invalid(command, "opId must be unique within the batch");
		opIds.add(command.opId);
	}
	const now = input.now ?? new Date();
	const items = new Map(
		input.before.items.map((item) => [item.targetUnitId, { ...item }] as const),
	);
	const ids = orderedIds(items);
	const rebalancedIds = new Set<string>();
	const rebalanceIfNeeded = () => {
		const plan = rebalanceFractionalPositionSequence(
			ids.map((id) => {
				const item = items.get(id);
				if (!item) throw new Error("Collection order references a missing item");
				return item.position;
			}),
		);
		for (const index of plan.changedIndexes) {
			const targetId = ids[index];
			const current = targetId ? items.get(targetId) : undefined;
			const position = plan.positions[index];
			if (!targetId || !current || !position) throw new Error("Collection rebalance lost an item");
			items.set(targetId, { ...current, position });
			rebalancedIds.add(targetId);
		}
	};
	rebalanceIfNeeded();
	const results: Array<{
		opId: string;
		applied: true;
		itemState?: "created" | "existing";
	}> = [];

	const insertAt = (targetId: string, index: number) => {
		const before = index > 0 ? items.get(ids[index - 1]!)?.position : null;
		const after = index < ids.length ? items.get(ids[index]!)?.position : null;
		items.set(targetId, {
			targetUnitId: targetId,
			position: fractionalPositionBetween(before, after),
			addedByProfileId: input.actorProfileId,
			addedAt: now,
		});
		ids.splice(index, 0, targetId);
	};

	for (const command of input.commands) {
		switch (command.type) {
			case "item.add": {
				const targetExists = items.has(command.targetId);
				const subjectId = input.reviewSubjectByTargetId.get(command.targetId);
				if (subjectId && !items.has(subjectId)) {
					const existingReviewIndex = ids.indexOf(command.targetId);
					insertAt(subjectId, existingReviewIndex < 0 ? ids.length : existingReviewIndex);
				}
				if (!targetExists) insertAt(command.targetId, ids.length);
				results.push({
					opId: command.opId,
					applied: true,
					itemState: targetExists ? "existing" : "created",
				});
				break;
			}
			case "item.remove": {
				if (!items.delete(command.targetId)) {
					results.push({ opId: command.opId, applied: true });
					break;
				}
				const index = ids.indexOf(command.targetId);
				if (index < 0) throw new Error("Collection order lost a removed item");
				ids.splice(index, 1);
				results.push({ opId: command.opId, applied: true });
				break;
			}
			case "items.move": {
				if (!command.targetIds.length) invalid(command, "move requires at least one item");
				const selected = new Set(command.targetIds);
				if (selected.size !== command.targetIds.length)
					invalid(command, "moved target ids must be unique");
				if (command.targetIds.some((targetId) => !items.has(targetId)))
					invalid(command, "every moved item must belong to the Collection");
				if (
					(command.placement.kind === "before" || command.placement.kind === "after") &&
					selected.has(command.placement.targetId)
				)
					invalid(command, "placement target cannot be a moved item");
				const movingIds = ids.filter((targetId) => selected.has(targetId));
				const remainingIds = ids.filter((targetId) => !selected.has(targetId));
				const index = insertionIndex(command, remainingIds, command.placement);
				const before = index > 0 ? items.get(remainingIds[index - 1]!)?.position : null;
				const after =
					index < remainingIds.length ? items.get(remainingIds[index]!)?.position : null;
				const positions = fractionalPositionsBetween(before, after, movingIds.length);
				for (const [movingIndex, targetId] of movingIds.entries()) {
					const current = items.get(targetId);
					const position = positions[movingIndex];
					if (!current || !position) throw new Error("Collection move plan is incomplete");
					items.set(targetId, { ...current, position });
				}
				ids.splice(0, ids.length, ...remainingIds);
				ids.splice(index, 0, ...movingIds);
				results.push({ opId: command.opId, applied: true });
				break;
			}
			case "items.swap": {
				if (command.leftTargetId === command.rightTargetId)
					invalid(command, "swap requires two different items");
				const left = items.get(command.leftTargetId);
				const right = items.get(command.rightTargetId);
				if (!left || !right) invalid(command, "both swapped items must belong to the Collection");
				items.set(left.targetUnitId, { ...left, position: right.position });
				items.set(right.targetUnitId, { ...right, position: left.position });
				const leftIndex = ids.indexOf(left.targetUnitId);
				const rightIndex = ids.indexOf(right.targetUnitId);
				ids[leftIndex] = right.targetUnitId;
				ids[rightIndex] = left.targetUnitId;
				results.push({ opId: command.opId, applied: true });
				break;
			}
		}
	}
	rebalanceIfNeeded();
	if (rebalancedIds.size)
		peekActiveObservability()?.metrics.fractionalPositionRebalanced(
			"collection",
			rebalancedIds.size,
		);

	const after = parseCollectionStructureSnapshot({
		version: 1,
		collectionId: input.before.collectionId,
		items: [...items.values()],
	});
	return {
		after,
		delta: diffCollectionStructureSnapshots(input.before, after),
		results,
	};
}
