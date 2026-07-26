"use client";

import {
	postApiSearchFeaturesByTemplateFeed,
	type PostApiSearchFeaturesByTemplateExecuteBody,
	type PostApiSearchFeaturesByTemplateFeedTemplate,
} from "@rezics/openapi-tanstack-query";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";

import { Alert, AlertAction, AlertDescription, Button } from "@rezics/ui";
import { useTranslation } from "@/i18n/client";
import { useHydratedSession } from "@/lib/use-hydrated-session";
import { FeedItemCard } from "../components/feed-item-card";
import { FeedList } from "../components/feed-list";
import { type FeedDisplayContext, UnscopedFeedDisplayContext } from "../model/feed-display-context";

type SearchFeedRequest = Pick<
	PostApiSearchFeaturesByTemplateExecuteBody,
	"contexts" | "injections" | "state"
>;

export function SearchFeedList({
	displayContext = UnscopedFeedDisplayContext,
	infinite = false,
	request,
	requestedRealmId,
	template,
}: {
	displayContext?: FeedDisplayContext;
	infinite?: boolean;
	request: SearchFeedRequest;
	requestedRealmId?: string;
	template: PostApiSearchFeaturesByTemplateFeedTemplate;
}) {
	const { t } = useTranslation(["actions", "feed", "state"]);
	const { data: session } = useHydratedSession();
	const [hidden, setHidden] = useState<ReadonlySet<string>>(() => new Set());
	const query = useInfiniteQuery({
		queryKey: ["search-feature-feed", template, request],
		queryFn: async ({ pageParam, signal }) => {
			const { data } = await postApiSearchFeaturesByTemplateFeed({
				path: { template },
				body: {
					...request,
					state: {
						...request.state,
						...(pageParam ? { cursor: pageParam } : {}),
					},
				},
				signal,
			});
			return data;
		},
		initialPageParam: "",
		getNextPageParam: (page) => page.nextCursor ?? undefined,
	});
	const loadMoreRef = useRef<HTMLDivElement>(null);
	useEffect(() => {
		const element = loadMoreRef.current;
		if (
			!infinite ||
			!element ||
			!query.hasNextPage ||
			query.isFetchingNextPage ||
			query.isFetchNextPageError ||
			typeof IntersectionObserver === "undefined"
		)
			return;
		const observer = new IntersectionObserver(
			([entry]) => {
				if (entry?.isIntersecting) void query.fetchNextPage();
			},
			{ rootMargin: "320px 0px" },
		);
		observer.observe(element);
		return () => observer.disconnect();
	}, [
		infinite,
		query.fetchNextPage,
		query.hasNextPage,
		query.isFetchingNextPage,
		query.isFetchNextPageError,
	]);
	const items = query.data?.pages
		.flatMap((page) => page.items)
		.filter(({ id }) => !hidden.has(id));
	const setItemHidden = (id: string, value: boolean) =>
		setHidden((current) => {
			const next = new Set(current);
			if (value) next.add(id);
			else next.delete(id);
			return next;
		});

	return (
		<FeedList
			aria-label={t.feed.title}
			emptyBody={t.feed.emptyBody}
			emptyTitle={t.feed.emptyTitle}
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
						: { status: "ready", items: items ?? [] }
			}
		/>
	);
}
