"use client";

import {
	parseSearchFeatureDefinition,
	type EmbeddableSearchTemplateId,
} from "@rezics/filter";
import { useGetApiSearchFeaturesByTemplate } from "@rezics/openapi-tanstack-query";
import { QueryFailure, QueryPending } from "@rezics/ui";
import { useId, useState } from "react";

import {
	SearchFeedResults,
	useSearchFeedQuery,
} from "@/features/content-feed/data/search-feed-list";
import type { FeedDisplayContext } from "@/features/content-feed/model/feed-display-context";
import { SearchFeature, type SearchFeatureRequest } from "@/features/search/search-feature";

type SearchFeatureFeedRequest = Readonly<{
	contexts: Parameters<typeof useSearchFeedQuery>[0]["request"]["contexts"];
	injections: SearchFeatureRequest["injections"];
	state: SearchFeatureRequest["state"];
}>;

export function SearchFeatureFeed({
	displayContext,
	infinite = false,
	initialRequest,
	requestedRealmId,
	template,
}: {
	readonly displayContext?: FeedDisplayContext;
	readonly infinite?: boolean;
	readonly initialRequest: SearchFeatureFeedRequest;
	readonly requestedRealmId?: string;
	readonly template: EmbeddableSearchTemplateId;
}) {
	const id = useId();
	const definitionQuery = useGetApiSearchFeaturesByTemplate({
		path: { template },
	});
	const [activeRequest, setActiveRequest] = useState(initialRequest);
	const results = useSearchFeedQuery({
		request: activeRequest,
		source: { kind: "template", template },
		surface: "feed",
	});

	if (definitionQuery.isPending) return <QueryPending />;
	if (definitionQuery.isError || !definitionQuery.data)
		return (
			<QueryFailure
				error={definitionQuery.error}
				retry={() => void definitionQuery.refetch()}
			/>
		);

	const definition = parseSearchFeatureDefinition(definitionQuery.data);
	const execute = (nextRequest: SearchFeatureRequest) =>
		setActiveRequest({
			contexts: initialRequest.contexts,
			injections: nextRequest.injections,
			state: nextRequest.state,
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
				displayContext={displayContext}
				infinite={infinite}
				query={results}
				requestedRealmId={requestedRealmId}
			/>
		</SearchFeature>
	);
}
