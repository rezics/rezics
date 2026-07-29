interface CollectionMembershipItem {
	readonly membership: {
		readonly targetId: string;
		readonly parentTargetId: string | null;
	};
}

export interface CollectionContentGroup<Item extends CollectionMembershipItem> {
	readonly root: Item;
	readonly children: readonly CollectionContentGroup<Item>[];
}

export function toCollectionContentGroups<Item extends CollectionMembershipItem>(
	items: readonly Item[],
): CollectionContentGroup<Item>[] {
	const itemById = new Map(items.map((item) => [item.membership.targetId, item] as const));
	const childrenByParent = new Map<string, Item[]>();
	for (const item of items) {
		const parentId = item.membership.parentTargetId;
		if (!parentId || !itemById.has(parentId)) continue;
		const children = childrenByParent.get(parentId) ?? [];
		children.push(item);
		childrenByParent.set(parentId, children);
	}
	const build = (item: Item, ancestors: ReadonlySet<string>): CollectionContentGroup<Item> => {
		const id = item.membership.targetId;
		if (ancestors.has(id)) return { root: item, children: [] };
		const nextAncestors = new Set(ancestors).add(id);
		return {
			root: item,
			children: (childrenByParent.get(id) ?? []).map((child) => build(child, nextAncestors)),
		};
	};
	return items
		.filter(({ membership }) => {
			const parentId = membership.parentTargetId;
			return !parentId || !itemById.has(parentId);
		})
		.map((item) => build(item, new Set()));
}

/** Return every loaded item carried by one of the selected subtree roots. */
export function collectionSelectionSubtreeIds(
	items: readonly CollectionMembershipItem[],
	selectedIds: ReadonlySet<string>,
): ReadonlySet<string> {
	const parentById = new Map(
		items.map(({ membership }) => [membership.targetId, membership.parentTargetId] as const),
	);
	const subtreeIds = new Set<string>();
	for (const { membership } of items) {
		let currentId: string | null = membership.targetId;
		const visited = new Set<string>();
		while (currentId) {
			if (selectedIds.has(currentId)) {
				subtreeIds.add(membership.targetId);
				break;
			}
			if (visited.has(currentId)) break;
			visited.add(currentId);
			currentId = parentById.get(currentId) ?? null;
		}
	}
	return subtreeIds;
}
