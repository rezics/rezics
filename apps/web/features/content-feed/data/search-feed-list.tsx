"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import type { EmbeddableSearchTemplateId, SearchFeatureSurface } from "@rezics/filter";
import { useTranslation } from "@/i18n/client";
import { useLocalizationLanguages } from "@/i18n/use-localization-languages";
import { useHydratedSession } from "@/lib/use-hydrated-session";
import { FeedItemCard } from "../components/feed-item-card";
import { FeedList } from "../components/feed-list";
import { resolveFeedContinuationState, type FeedPaginationMode } from "../model/feed-continuation";
import { type FeedDisplayContext, UnscopedFeedDisplayContext } from "../model/feed-display-context";
import { collectUniqueFeedItems } from "../model/feed-items";
import { hasSearchLanguagePresentationBoundary } from "../model/search-language-boundary";
import type { SearchFeedContinuationToken } from "../model/search-feed-continuation-token";
import {
	fetchSearchFeedPage,
	type SearchFeedRequest,
	type SearchFeedSource,
} from "./search-feed-query";
import { SearchFeedQueryKey } from "./search-feed-query-key";

const InitialSearchFeedContinuationToken: SearchFeedContinuationToken | null = null;

export {
	type SearchFeedRequest,
	type SearchFeedSource,
	withoutSearchFeedCursor,
} from "./search-feed-query";

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
	const localizationLanguages = useLocalizationLanguages();
	return useInfiniteQuery({
		enabled,
		queryKey: [...SearchFeedQueryKey, surface, source, request, localizationLanguages],
		queryFn: ({ pageParam, signal }) =>
			fetchSearchFeedPage({
				...(pageParam ? { cursor: pageParam } : {}),
				localizationLanguages,
				request,
				signal,
				source,
				surface,
			}),
		initialPageParam: InitialSearchFeedContinuationToken,
		getNextPageParam: (page) => page.nextCursor,
	});
}

type SearchFeedQuery = ReturnType<typeof useSearchFeedQuery>;

export function SearchFeedResults({
	"aria-label": ariaLabel,
	displayContext = UnscopedFeedDisplayContext,
	emptyBody,
	emptyTitle,
	pagination = "load-more",
	preserveDisplayedLanguage = false,
	query,
	requestedRealmId,
}: {
	readonly "aria-label"?: string;
	readonly displayContext?: FeedDisplayContext;
	readonly emptyBody?: string;
	readonly emptyTitle?: string;
	readonly pagination?: FeedPaginationMode;
	readonly preserveDisplayedLanguage?: boolean;
	readonly query: SearchFeedQuery;
	readonly requestedRealmId?: string;
}) {
	const { t } = useTranslation(["actions", "feed", "state"]);
	const { data: session } = useHydratedSession();
	const [hidden, setHidden] = useState<ReadonlySet<string>>(() => new Set());
	const pageItems = useMemo(
		() => collectUniqueFeedItems(query.data?.pages ?? [], (item) => item.id),
		[query.data?.pages],
	);
	const items = pageItems.filter(({ id }) => !hidden.has(id));
	const continuationState = resolveFeedContinuationState({
		fetchNextPage: () => query.fetchNextPage({ cancelRefetch: false }),
		hasNextPage: query.hasNextPage,
		isFetchNextPageError: query.isFetchNextPageError,
		isFetching: query.isFetching,
		isFetchingNextPage: query.isFetchingNextPage,
	});
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
			continuation={
				pagination === "none" ? undefined : { mode: pagination, state: continuationState }
			}
			emptyBody={emptyBody ?? t.feed.emptyBody}
			emptyTitle={emptyTitle ?? t.feed.emptyTitle}
			errorLabel={t.state.error}
			getItemKey={(item) => item.id}
			renderItem={(item, metadata) => (
				<FeedItemCard
					canExclude={Boolean(session)}
					displayContext={displayContext}
					item={item}
					onHiddenChange={(value) => setItemHidden(item.id, value)}
					position={metadata.position}
					preserveDisplayedLanguage={preserveDisplayedLanguage}
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
	"aria-label": ariaLabel,
	displayContext = UnscopedFeedDisplayContext,
	emptyBody,
	emptyTitle,
	pagination = "load-more",
	request,
	requestedRealmId,
	source,
	template,
}: {
	readonly "aria-label"?: string;
	readonly displayContext?: FeedDisplayContext;
	readonly emptyBody?: string;
	readonly emptyTitle?: string;
	readonly pagination?: FeedPaginationMode;
	readonly request: SearchFeedRequest;
	readonly requestedRealmId?: string;
} & (
	| Readonly<{ source: SearchFeedSource; template?: never }>
	| Readonly<{ source?: never; template: EmbeddableSearchTemplateId }>
)) {
	const resolvedSource: SearchFeedSource = source ?? { kind: "template", template };
	const query = useSearchFeedQuery({
		request,
		source: resolvedSource,
		surface: "feed",
	});
	return (
		<SearchFeedResults
			aria-label={ariaLabel}
			displayContext={displayContext}
			emptyBody={emptyBody}
			emptyTitle={emptyTitle}
			pagination={pagination}
			preserveDisplayedLanguage={hasSearchLanguagePresentationBoundary(request.state)}
			query={query}
			requestedRealmId={requestedRealmId}
		/>
	);
}
