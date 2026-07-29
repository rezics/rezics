"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";

import type { SearchFeatureSurface, SearchTemplateId } from "@rezics/filter";
import { Alert, AlertAction, AlertDescription, Button } from "@rezics/ui";
import { useTranslation } from "@/i18n/client";
import { useHydratedSession } from "@/lib/use-hydrated-session";
import { FeedItemCard } from "../components/feed-item-card";
import { FeedList } from "../components/feed-list";
import { type FeedDisplayContext, UnscopedFeedDisplayContext } from "../model/feed-display-context";
import {
	fetchSearchFeedPage,
	type SearchFeedRequest,
	type SearchFeedSource,
} from "./search-feed-query";
import { SearchFeedQueryKey } from "./search-feed-query-key";

export type { SearchFeedRequest, SearchFeedSource } from "./search-feed-query";

export function useSearchFeedQuery({
	enabled = true,
	request,
	source,
	surface,
}: {
	readonly enabled?: boolean;
	readonly request: SearchFeedRequest;
	readonly source: SearchFeedSource;
	readonly surface: SearchFeatureSurface;
}) {
	return useInfiniteQuery({
		enabled,
		queryKey: [...SearchFeedQueryKey, surface, source, request],
		queryFn: ({ pageParam, signal }) =>
			fetchSearchFeedPage({
				...(pageParam ? { cursor: pageParam } : {}),
				request,
				signal,
				source,
				surface,
			}),
		initialPageParam: "",
		getNextPageParam: (page) => page.nextCursor ?? undefined,
	});
}

type SearchFeedQuery = ReturnType<typeof useSearchFeedQuery>;

export function SearchFeedResults({
	"aria-label": ariaLabel,
	displayContext = UnscopedFeedDisplayContext,
	emptyBody,
	emptyTitle,
	infinite = false,
	query,
	requestedRealmId,
}: {
	readonly "aria-label"?: string;
	readonly displayContext?: FeedDisplayContext;
	readonly emptyBody?: string;
	readonly emptyTitle?: string;
	readonly infinite?: boolean;
	readonly query: SearchFeedQuery;
	readonly requestedRealmId?: string;
}) {
	const { t } = useTranslation(["actions", "feed", "state"]);
	const { data: session } = useHydratedSession();
	const [hidden, setHidden] = useState<ReadonlySet<string>>(() => new Set());
	const loadMoreRef = useRef<HTMLDivElement>(null);
	useEffect(() => {
		const element = loadMoreRef.current;
		if (
			!infinite ||
			!element ||
			!query.hasNextPage ||
			query.isFetching ||
			query.isFetchNextPageError ||
			typeof IntersectionObserver === "undefined"
		)
			return;
		const observer = new IntersectionObserver(
			([entry]) => {
				if (entry?.isIntersecting && !query.isFetching) void query.fetchNextPage();
			},
			{ rootMargin: "320px 0px" },
		);
		observer.observe(element);
		return () => observer.disconnect();
	}, [
		infinite,
		query.fetchNextPage,
		query.hasNextPage,
		query.isFetching,
		query.isFetchNextPageError,
	]);
	const items = [
		...new Map(
			query.data?.pages.flatMap((page) => page.items).map((item) => [item.id, item]) ?? [],
		).values(),
	].filter(({ id }) => !hidden.has(id));
	const setItemHidden = (id: string, value: boolean) =>
		setHidden((current) => {
			const next = new Set(current);
			if (value) next.add(id);
			else next.delete(id);
			return next;
		});

	return (
		<FeedList
			aria-label={ariaLabel ?? t.feed.title}
			emptyBody={emptyBody ?? t.feed.emptyBody}
			emptyTitle={emptyTitle ?? t.feed.emptyTitle}
			errorLabel={t.state.error}
			footer={
				query.isFetchNextPageError ? (
					<Alert variant="destructive">
						<AlertDescription>{t.state.error}</AlertDescription>
						<AlertAction>
							<Button
								size="sm"
								variant="quiet"
								onClick={() => void query.fetchNextPage()}
							>
								{t.actions.retry}
							</Button>
						</AlertAction>
					</Alert>
				) : query.hasNextPage ? (
					infinite ? (
						<div
							aria-live="polite"
							className="grid min-h-10 place-items-center"
							ref={loadMoreRef}
						>
							{query.isFetchingNextPage ? (
								<span className="text-muted-foreground text-sm">
									{t.actions.loadMore}
								</span>
							) : null}
						</div>
					) : (
						<Button
							className="mx-auto mt-2 w-fit"
							isLoading={query.isFetchingNextPage}
							variant="outline"
							onClick={() => void query.fetchNextPage()}
						>
							{t.actions.loadMore}
						</Button>
					)
				) : null
			}
			getItemKey={(item) => item.id}
			renderItem={(item, metadata) => (
				<FeedItemCard
					canExclude={Boolean(session)}
					displayContext={displayContext}
					item={item}
					onHiddenChange={(value) => setItemHidden(item.id, value)}
					position={metadata.position}
					requestedRealmId={requestedRealmId}
					setSize={metadata.setSize}
				/>
			)}
			retryLabel={t.actions.retry}
			state={
				query.isPending
					? { status: "pending" }
					: query.isError && !query.data
						? { status: "error", retry: () => void query.refetch() }
						: { status: "ready", items }
			}
		/>
	);
}

export function SearchFeedList({
	displayContext = UnscopedFeedDisplayContext,
	infinite = false,
	request,
	requestedRealmId,
	source,
	template,
}: {
	readonly displayContext?: FeedDisplayContext;
	readonly infinite?: boolean;
	readonly request: SearchFeedRequest;
	readonly requestedRealmId?: string;
} & (
	| Readonly<{ source: SearchFeedSource; template?: never }>
	| Readonly<{ source?: never; template: SearchTemplateId }>
)) {
	const resolvedSource: SearchFeedSource = source ?? { kind: "template", template };
	const query = useSearchFeedQuery({
		request,
		source: resolvedSource,
		surface: "feed",
	});
	return (
		<SearchFeedResults
			displayContext={displayContext}
			infinite={infinite}
			query={query}
			requestedRealmId={requestedRealmId}
		/>
	);
}
