export function collectUniqueFeedItems<Item, ItemKey>(
	pages: readonly Readonly<{ items: readonly Item[] }>[],
	getItemKey: (item: Item) => ItemKey,
): Item[] {
	const items = new Map<ItemKey, Item>();
	for (const page of pages) for (const item of page.items) items.set(getItemKey(item), item);
	return [...items.values()];
}
