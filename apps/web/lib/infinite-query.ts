/**
 * Resolves a keyset cursor without allowing an automatic item list to loop.
 *
 * An empty page is terminal at the UI boundary even when a lower-level bounded
 * scan can advance again. A repeated cursor is terminal because it cannot
 * prove forward progress.
 */
export function getNextItemPageParam<Cursor extends string>(
	lastPage: Readonly<{
		items: readonly unknown[];
		nextCursor?: Cursor | null;
	}>,
	_allPages: readonly unknown[],
	lastPageParam: Cursor | null | undefined,
): Cursor | undefined {
	const nextCursor = lastPage.nextCursor;
	if (lastPage.items.length === 0 || !nextCursor || nextCursor === lastPageParam) return undefined;
	return nextCursor;
}
