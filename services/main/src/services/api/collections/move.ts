import { ValidationError } from "../errors";

export type StoredCollectionItem = {
	readonly unitId: string;
	readonly parentUnitId: string | null;
	readonly position: string;
};

/** Remove selected descendants whose selected ancestor already carries their subtree. */
export function orderedCollectionMoveRoots(
	selectedIds: ReadonlySet<string>,
	memberships: readonly StoredCollectionItem[],
): string[] {
	const byId = new Map(memberships.map((membership) => [membership.unitId, membership]));
	const roots = [...selectedIds].filter((unitId) => {
		const visited = new Set<string>();
		let parentUnitId = byId.get(unitId)?.parentUnitId;
		while (parentUnitId) {
			if (selectedIds.has(parentUnitId)) return false;
			if (visited.has(parentUnitId))
				throw new ValidationError({ targetIds: "the Collection hierarchy is cyclic" });
			visited.add(parentUnitId);
			parentUnitId = byId.get(parentUnitId)?.parentUnitId;
		}
		return true;
	});
	const childrenByParent = new Map<string | null, StoredCollectionItem[]>();
	for (const membership of memberships) {
		const siblings = childrenByParent.get(membership.parentUnitId) ?? [];
		siblings.push(membership);
		childrenByParent.set(membership.parentUnitId, siblings);
	}
	const preorder = new Map<string, number>();
	const visiting = new Set<string>();
	let ordinal = 0;
	const visit = (parentUnitId: string | null) => {
		for (const membership of childrenByParent.get(parentUnitId) ?? []) {
			if (visiting.has(membership.unitId))
				throw new ValidationError({ targetIds: "the Collection hierarchy is cyclic" });
			visiting.add(membership.unitId);
			preorder.set(membership.unitId, ordinal++);
			visit(membership.unitId);
			visiting.delete(membership.unitId);
		}
	};
	visit(null);
	if (preorder.size !== memberships.length)
		throw new ValidationError({ targetIds: "the Collection hierarchy is disconnected" });
	return roots.sort((left, right) => (preorder.get(left) ?? 0) - (preorder.get(right) ?? 0));
}

/** Resolve every member carried by the selected move roots. */
export function collectionSubtreeIds(
	rootIds: readonly string[],
	memberships: readonly StoredCollectionItem[],
): Set<string> {
	const childrenByParent = new Map<string, string[]>();
	for (const membership of memberships) {
		if (!membership.parentUnitId) continue;
		const children = childrenByParent.get(membership.parentUnitId) ?? [];
		children.push(membership.unitId);
		childrenByParent.set(membership.parentUnitId, children);
	}
	const result = new Set<string>();
	const pending = [...rootIds];
	while (pending.length) {
		const current = pending.pop()!;
		if (result.has(current)) continue;
		result.add(current);
		pending.push(...(childrenByParent.get(current) ?? []));
	}
	return result;
}
