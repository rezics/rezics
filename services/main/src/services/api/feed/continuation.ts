export type FeedPageContinuation =
	| Readonly<{ status: "available"; cursor: string }>
	| Readonly<{ status: "exhausted"; cursor: null }>;

/**
 * A presented Feed page can continue only after it exposed at least one item.
 *
 * Search execution may advance through a bounded candidate window without a
 * hit. Exposing that internal cursor to an automatic Feed consumer would let
 * one viewport turn bounded requests into an unbounded request chain.
 */
export function resolveFeedPageContinuation(
	items: readonly unknown[],
	cursor: string | null | undefined,
): FeedPageContinuation {
	if (items.length === 0 || !cursor) return { status: "exhausted", cursor: null };
	return { status: "available", cursor };
}
