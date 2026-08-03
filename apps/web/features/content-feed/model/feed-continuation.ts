export type FeedPaginationMode = "none" | "load-more" | "infinite";

export type FeedContinuationState =
	| Readonly<{ status: "exhausted" }>
	| Readonly<{ status: "ready"; loadNext: () => void | Promise<unknown> }>
	| Readonly<{ status: "loading" }>
	| Readonly<{ status: "refreshing" }>
	| Readonly<{ status: "error"; retry: () => void | Promise<unknown> }>;

export function resolveFeedContinuationState({
	fetchNextPage,
	hasNextPage,
	isFetchNextPageError,
	isFetching,
	isFetchingNextPage,
}: {
	readonly fetchNextPage: () => void | Promise<unknown>;
	readonly hasNextPage: boolean;
	readonly isFetchNextPageError: boolean;
	readonly isFetching: boolean;
	readonly isFetchingNextPage: boolean;
}): FeedContinuationState {
	if (!hasNextPage) return { status: "exhausted" };
	if (isFetchingNextPage) return { status: "loading" };
	if (isFetchNextPageError) return { status: "error", retry: fetchNextPage };
	if (isFetching) return { status: "refreshing" };
	return { status: "ready", loadNext: fetchNextPage };
}
