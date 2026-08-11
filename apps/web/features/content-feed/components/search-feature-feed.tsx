"use client";

import { parseSearchFeatureDefinition, type FilterDocument } from "@rezics/filter";
import { postApiSearchFilterDefinition } from "@rezics/openapi-tanstack-query";
import { QueryFailure, QueryPending } from "@rezics/ui";
import { useQuery } from "@tanstack/react-query";
import { useId, useState } from "react";

import {
	SearchFeedResults,
	type SearchFeedRequest,
	useSearchFeedQuery,
	withoutSearchFeedCursor,
} from "@/features/content-feed/data/search-feed-list";
import type { FeedDisplayContext } from "@/features/content-feed/model/feed-display-context";
import type { FeedPaginationMode } from "@/features/content-feed/model/feed-continuation";
import { SearchFeature, type SearchFeatureRequest } from "@/features/search/search-feature";

const EmptyFilterDocument = {} satisfies FilterDocument;

export function SearchFeatureFeed({
	"aria-label": ariaLabel,
	displayContext,
	emptyBody,
	emptyTitle,
	initialRequest,
	pagination = "load-more",
	requestedRealmId,
	filterDocument = EmptyFilterDocument,
}: {
	readonly "aria-label"?: string;
	readonly displayContext?: FeedDisplayContext;
	readonly emptyBody?: string;
	readonly emptyTitle?: string;
	readonly initialRequest: SearchFeedRequest;
	readonly pagination?: FeedPaginationMode;
	readonly requestedRealmId?: string;
	readonly filterDocument?: FilterDocument;
}) {
	const id = useId();
	const definitionQuery = useQuery({
		queryKey: ["filter-definition", filterDocument],
		queryFn: async () => (await postApiSearchFilterDefinition({ body: filterDocument })).data,
	});
	const [activeRequest, setActiveRequest] = useState(initialRequest);
	const results = useSearchFeedQuery({
		request: activeRequest,
		source: { kind: "filter", filterDocument },
		surface: "feed",
	});

	if (definitionQuery.isPending) return <QueryPending />;
	if (definitionQuery.isError || !definitionQuery.data)
		return (
			<QueryFailure error={definitionQuery.error} retry={() => void definitionQuery.refetch()} />
		);

	const definition = parseSearchFeatureDefinition(definitionQuery.data);
	const execute = (nextRequest: SearchFeatureRequest) =>
		setActiveRequest({
			contexts: initialRequest.contexts,
			injections: nextRequest.injections,
			state: withoutSearchFeedCursor(nextRequest.state),
		});

	return (
		<SearchFeature
			appearance="feed"
			definition={definition}
			error={results.isError}
			facets={results.data?.pages[0]?.facets}
			id={`${id}-search-feature-feed`}
			initialState={initialRequest.state}
			injections={initialRequest.injections}
			onExecute={execute}
			pending={results.isFetching}
			surface="feed"
		>
			<SearchFeedResults
				aria-label={ariaLabel}
				displayContext={displayContext}
				emptyBody={emptyBody}
				emptyTitle={emptyTitle}
				pagination={pagination}
				query={results}
				requestedRealmId={requestedRealmId}
			/>
		</SearchFeature>
	);
}
