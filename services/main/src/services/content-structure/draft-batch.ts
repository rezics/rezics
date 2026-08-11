import { RevisionedBatchCommandLimit } from "../history/revisioned-batch";
import { peekActiveObservability } from "@rezics/observability";
import {
	compareBytewisePositions,
	fractionalPositionsBetween,
	rebalanceFractionalPositionSequence,
} from "../ordering/position";
import { ContentStructureInvalid } from "./errors";

type CurrentDraftMember = {
	readonly id: string;
	readonly parentId: string | null;
};

type PositionedCurrentDraftMember = CurrentDraftMember & { readonly position: string };
type OrderedDesiredDraftMember = CurrentDraftMember & { readonly order: number };

function longestIncreasingMemberIds(
	members: readonly { readonly id: string; readonly currentIndex: number }[],
): ReadonlySet<string> {
	if (!members.length) return new Set();
	const tailMemberIndexes: number[] = [];
	const previousMemberIndexes = Array.from({ length: members.length }, () => -1);
	for (const [memberIndex, member] of members.entries()) {
		let lower = 0;
		let upper = tailMemberIndexes.length;
		while (lower < upper) {
			const middle = Math.floor((lower + upper) / 2);
			const tail = members[tailMemberIndexes[middle] ?? -1];
			if (!tail) throw new Error("Draft sibling subsequence lost its tail");
			if (tail.currentIndex < member.currentIndex) lower = middle + 1;
			else upper = middle;
		}
		previousMemberIndexes[memberIndex] = lower > 0 ? (tailMemberIndexes[lower - 1] ?? -1) : -1;
		tailMemberIndexes[lower] = memberIndex;
	}
	const result = new Set<string>();
	let memberIndex = tailMemberIndexes.at(-1) ?? -1;
	while (memberIndex >= 0) {
		const member = members[memberIndex];
		if (!member) throw new Error("Draft sibling subsequence lost a member");
		result.add(member.id);
		memberIndex = previousMemberIndexes[memberIndex] ?? -1;
	}
	return result;
}

/**
 * Compiles a desired sibling order into minimal positional changes. Existing
 * members in a longest ordered subsequence retain their position; only new,
 * reparented, or genuinely reordered members receive new fractional keys.
 */
export function planDraftSiblingPositions(input: {
	readonly currentNodes: readonly PositionedCurrentDraftMember[];
	readonly desiredNodes: readonly OrderedDesiredDraftMember[];
}): ReadonlyMap<string, string> {
	const currentById = new Map(input.currentNodes.map((node) => [node.id, node] as const));
	const desiredByParent = new Map<string | null, OrderedDesiredDraftMember[]>();
	for (const node of input.desiredNodes) {
		const siblings = desiredByParent.get(node.parentId) ?? [];
		siblings.push(node);
		desiredByParent.set(node.parentId, siblings);
	}
	const positions = new Map<string, string>();
	const rebalancedIds = new Set<string>();
	for (const [parentId, desiredSiblings] of desiredByParent) {
		desiredSiblings.sort((left, right) => left.order - right.order);
		const desiredIds = new Set(desiredSiblings.map(({ id }) => id));
		const currentSiblings = input.currentNodes
			.filter((node) => node.parentId === parentId && desiredIds.has(node.id))
			.toSorted(
				(left, right) =>
					compareBytewisePositions(left.position, right.position) ||
					left.id.localeCompare(right.id),
			);
		const currentRebalance = rebalanceFractionalPositionSequence(
			currentSiblings.map(({ position }) => position),
		);
		for (const index of currentRebalance.changedIndexes) {
			const member = currentSiblings[index];
			const position = currentRebalance.positions[index];
			if (!member || !position) throw new Error("Draft sibling rebalance lost a member");
			const compacted = { ...member, position };
			currentSiblings[index] = compacted;
			currentById.set(member.id, compacted);
			rebalancedIds.add(member.id);
		}
		const currentIndexById = new Map(currentSiblings.map(({ id }, index) => [id, index] as const));
		const anchoredMembers = desiredSiblings.flatMap(({ id }) => {
			const current = currentById.get(id);
			const currentIndex = currentIndexById.get(id);
			return current && current.parentId === parentId && currentIndex !== undefined
				? [{ id, currentIndex }]
				: [];
		});
		const retainedPositionIds = longestIncreasingMemberIds(anchoredMembers);
		let index = 0;
		let before: string | null = null;
		while (index < desiredSiblings.length) {
			const desired = desiredSiblings[index];
			if (!desired) throw new Error("Draft sibling plan lost a desired member");
			if (retainedPositionIds.has(desired.id)) {
				const current = currentById.get(desired.id);
				if (!current) throw new Error("Draft sibling plan lost a retained member");
				positions.set(desired.id, current.position);
				before = current.position;
				index += 1;
				continue;
			}
			const runStart = index;
			while (
				index < desiredSiblings.length &&
				!retainedPositionIds.has(desiredSiblings[index]?.id ?? "")
			)
				index += 1;
			const nextRetained = desiredSiblings[index];
			const after = nextRetained ? (currentById.get(nextRetained.id)?.position ?? null) : null;
			const generated = fractionalPositionsBetween(before, after, index - runStart);
			for (let offset = 0; offset < generated.length; offset += 1) {
				const member = desiredSiblings[runStart + offset];
				const position = generated[offset];
				if (!member || !position)
					throw new Error("Draft sibling position generation was incomplete");
				positions.set(member.id, position);
				before = position;
			}
		}
		const desiredRebalance = rebalanceFractionalPositionSequence(
			desiredSiblings.map(({ id }) => {
				const position = positions.get(id);
				if (!position) throw new Error("Draft sibling plan lost a desired position");
				return position;
			}),
		);
		for (const memberIndex of desiredRebalance.changedIndexes) {
			const member = desiredSiblings[memberIndex];
			const position = desiredRebalance.positions[memberIndex];
			if (!member || !position) throw new Error("Draft sibling rebalance lost a member");
			positions.set(member.id, position);
			rebalancedIds.add(member.id);
		}
	}
	if (positions.size !== input.desiredNodes.length)
		throw new Error("Draft sibling planning did not position every desired member");
	if (rebalancedIds.size)
		peekActiveObservability()?.metrics.fractionalPositionRebalanced(
			"content-structure-draft",
			rebalancedIds.size,
		);
	return positions;
}

/**
 * Returns the omitted roots represented by subtree-delete commands.
 * Descendants affected by those commands do not consume additional batch slots.
 */
export function deletedDraftSubtreeRootIds(
	currentNodes: readonly CurrentDraftMember[],
	deletedNodeIds: ReadonlySet<string>,
): readonly string[] {
	return currentNodes.flatMap((node) =>
		deletedNodeIds.has(node.id) && (node.parentId === null || !deletedNodeIds.has(node.parentId))
			? [node.id]
			: [],
	);
}

/**
 * Enforces the shared limit on compiled logical commands, never on aggregate
 * members or on the number of members affected by one command.
 */
export function assertContentStructureDraftCommandLimit(input: {
	readonly currentNodes: readonly CurrentDraftMember[];
	readonly deletedNodeIds: ReadonlySet<string>;
	readonly changedDesiredNodeCount: number;
}): void {
	const commandCount =
		input.changedDesiredNodeCount +
		deletedDraftSubtreeRootIds(input.currentNodes, input.deletedNodeIds).length;
	if (commandCount > RevisionedBatchCommandLimit)
		throw new ContentStructureInvalid(
			`Content Structure draft compiles to more than ${RevisionedBatchCommandLimit} commands`,
		);
}
