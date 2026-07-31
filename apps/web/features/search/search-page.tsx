"use client";

import {
	parseSearchFeatureDefinition,
	parseSharedSearchQueryDocument,
	type ResolvedSearchControl,
	type SearchFeatureContext,
	type SearchFeatureState,
	type SearchInjection,
	type SearchScalar,
	type SharedSearchQuerySelection,
	type SharedSearchQueryState,
	unitFilterSearchQuery,
	withUnitFilterSearch,
} from "@rezics/filter";
import {
	useGetApiSearchFeaturesByTemplate,
	useGetApiSearchZonesByZoneIdFeature,
	useGetApiSearchSharedQueriesById,
	usePostApiSearchSharedQueries,
} from "@rezics/openapi-tanstack-query";
import { PageHeading, QueryFailure, QueryPending } from "@rezics/ui";
import { useQueryState, useQueryStates } from "nuqs";
import { useCallback, useEffect, useRef, useState } from "react";

import {
	SearchFeedResults,
	type SearchFeedRequest,
	type SearchFeedSource,
	useSearchFeedQuery,
	withoutSearchFeedCursor,
} from "@/features/content-feed/data/search-feed-list";
import { useTranslation } from "@/i18n/client";
import { searchParamsParsers } from "@/lib/search-params";
import {
	SearchFeature,
	type SearchFeatureRequest,
	type SearchFeatureShareRequest,
} from "./search-feature";

const DisabledZoneId = "00000000-0000-7000-8000-000000000000";
const EmptySearchFeedRequest = {
	contexts: [],
	injections: [],
	state: {},
} satisfies SearchFeedRequest;

export type SearchSurfaceSource = SearchFeedSource;

export function SearchSurface({
	id,
	source,
	contexts = [],
	injections = [],
	initialQuery,
	initialState,
	initialSelections = [],
	onInjectionsChange,
	onQueryChange,
	resolveOptionLabel,
}: {
	readonly id: string;
	readonly source: SearchSurfaceSource;
	readonly contexts?: readonly SearchFeatureContext[];
	readonly injections?: readonly SearchInjection[];
	readonly initialQuery?: string;
	readonly initialState?: SharedSearchQueryState;
	readonly initialSelections?: readonly SharedSearchQuerySelection[];
	readonly onInjectionsChange?: (injections: readonly SearchInjection[]) => void;
	readonly onQueryChange?: (query: string) => void;
	readonly resolveOptionLabel?: (
		control: ResolvedSearchControl,
		value: SearchScalar,
	) => string | undefined;
}) {
	const { t } = useTranslation("search");
	const template = source.kind === "template" ? source.template : "global";
	const templateDefinition = useGetApiSearchFeaturesByTemplate(
		{ path: { template } },
		{ query: { enabled: source.kind === "template" } },
	);
	const zoneDefinition = useGetApiSearchZonesByZoneIdFeature(
		{ path: { zoneId: source.kind === "zone" ? source.zoneId : DisabledZoneId } },
		{ query: { enabled: source.kind === "zone" } },
	);
	const shareMutation = usePostApiSearchSharedQueries();
	const [lastRequest, setLastRequest] = useState<SearchFeatureRequest>();
	const initialExecuted = useRef(false);
	const feedRequest: SearchFeedRequest = lastRequest
		? {
				contexts: [...contexts],
				injections: lastRequest.injections,
				state: withoutSearchFeedCursor(lastRequest.state),
			}
		: EmptySearchFeedRequest;
	const results = useSearchFeedQuery({
		enabled: Boolean(lastRequest),
		request: feedRequest,
		source,
		surface: "search",
	});
	const rawDefinition =
		source.kind === "template" ? templateDefinition.data : zoneDefinition.data?.definition;

	const run = useCallback(
		(request: SearchFeatureRequest) => {
			setLastRequest(request);
			onQueryChange?.(unitFilterSearchQuery(request.state.filter));
		},
		[onQueryChange],
	);

	useEffect(() => {
		if (
			(!initialState && !initialQuery?.trim() && injections.length === 0) ||
			!rawDefinition ||
			initialExecuted.current
		)
			return;
		const initialFilter = withUnitFilterSearch(undefined, initialQuery ?? "");
		const state: SearchFeatureState =
			initialState ?? (initialFilter ? { filter: initialFilter } : {});
		initialExecuted.current = true;
		run({ injections: [...injections], state });
	}, [initialQuery, initialState, injections, rawDefinition, run]);

	const definitionPending =
		source.kind === "template" ? templateDefinition.isPending : zoneDefinition.isPending;
	const definitionError =
		source.kind === "template" ? templateDefinition.error : zoneDefinition.error;
	const executionPending = Boolean(lastRequest) && results.isFetching;
	if (definitionPending) return <QueryPending />;
	if (definitionError || !rawDefinition)
		return (
			<QueryFailure
				error={definitionError}
				retry={() =>
					void (source.kind === "template"
						? templateDefinition.refetch()
						: zoneDefinition.refetch())
				}
			/>
		);
	const definition = parseSearchFeatureDefinition(rawDefinition);
	const facets = results.data?.pages[0]?.facets;

	async function share(request: SearchFeatureShareRequest) {
		const response = await shareMutation.mutateAsync({
			body: {
				version: 1,
				template,
				state: request.state,
				selections: [...request.selections],
			},
		});
		const url = new URL(`/search/shared/${response.id}`, window.location.origin);
		await navigator.clipboard.writeText(url.toString());
	}

	return (
		<SearchFeature
			appearance="feed"
			definition={definition}
			error={results.isError}
			facets={facets}
			id={id}
			initialQuery={initialQuery}
			initialSelections={initialSelections}
			initialState={initialState}
			injections={injections}
			onExecute={run}
			onInjectionsChange={onInjectionsChange}
			onShare={source.kind === "template" ? share : undefined}
			pending={executionPending}
			resolveOptionLabel={resolveOptionLabel}
			surface="search"
		>
			{lastRequest ? (
				<section className="grid gap-4">
					<h2 className="font-heading font-semibold text-xl">{t.results}</h2>
					<SearchFeedResults
						aria-label={t.results}
						emptyBody={t.emptyBody}
						emptyTitle={t.empty}
						pagination="infinite"
						query={results}
					/>
				</section>
			) : null}
		</SearchFeature>
	);
}

function injectedTagIds(injections: readonly SearchInjection[]): string[] {
	return injections.flatMap((injection) => {
		if (injection.source !== "tag" || injection.value.filter.field !== "tag") return [];
		const filter = injection.value.filter;
		if ("value" in filter && typeof filter.value === "string") return [filter.value];
		if ("values" in filter)
			return filter.values.filter((value): value is string => typeof value === "string");
		return [];
	});
}

function SearchLayout({
	id,
	source,
	contexts = [],
	initialQuery,
	initialState,
	initialSelections,
	injections,
	onInjectionsChange,
	onQueryChange,
	resolveOptionLabel,
	embedded = false,
}: {
	readonly id: string;
	readonly source: SearchSurfaceSource;
	readonly contexts?: readonly SearchFeatureContext[];
	readonly initialQuery?: string;
	readonly initialState?: SharedSearchQueryState;
	readonly initialSelections?: readonly SharedSearchQuerySelection[];
	readonly injections?: readonly SearchInjection[];
	readonly onInjectionsChange?: (injections: readonly SearchInjection[]) => void;
	readonly onQueryChange?: (query: string) => void;
	readonly resolveOptionLabel?: (
		control: ResolvedSearchControl,
		value: SearchScalar,
	) => string | undefined;
	readonly embedded?: boolean;
}) {
	const { t } = useTranslation("search");
	const content = (
		<>
			{embedded ? (
				<h2 className="font-heading font-semibold text-2xl tracking-tight">{t.title}</h2>
			) : (
				<PageHeading title={t.title} />
			)}
			<SearchSurface
				contexts={contexts}
				id={id}
				initialQuery={initialQuery}
				initialSelections={initialSelections}
				initialState={initialState}
				injections={injections}
				onInjectionsChange={onInjectionsChange}
				onQueryChange={onQueryChange}
				resolveOptionLabel={resolveOptionLabel}
				source={source}
			/>
		</>
	);
	if (embedded) return <section className="flex flex-col gap-8">{content}</section>;
	return (
		<main className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-10 sm:px-6">
			{content}
		</main>
	);
}

function RouteSearchPage() {
	const [route, setRoute] = useQueryStates(searchParamsParsers);
	const labels = new Map(
		route.tag.map((tagId, index) => [tagId, route.tagLabel[index]] as const),
	);
	const injections: SearchInjection[] = route.tag.map((tagId) => ({
		source: "tag",
		removable: true,
		value: {
			controlKey: "tag",
			filter: { field: "tag", operator: "equals", value: tagId },
		},
	}));
	return (
		<SearchLayout
			id={`${route.template}-search`}
			initialQuery={route.q}
			injections={injections}
			key={`${route.template}:${route.q}:${route.tag.join(",")}`}
			onInjectionsChange={(next) => {
				const tag = injectedTagIds(next);
				void setRoute({
					tag,
					tagLabel: tag.map((tagId) => labels.get(tagId) ?? tagId),
				});
			}}
			onQueryChange={(query) => void setRoute({ q: query || null }, { history: "push" })}
			resolveOptionLabel={(control, value) =>
				control.field === "tag" && typeof value === "string" ? labels.get(value) : undefined
			}
			source={{ kind: "template", template: route.template }}
		/>
	);
}

function SharedSearchPage({ id }: { readonly id: string }) {
	const query = useGetApiSearchSharedQueriesById({ path: { id } });
	if (query.isPending) return <QueryPending />;
	if (query.isError)
		return <QueryFailure error={query.error} retry={() => void query.refetch()} />;
	const document = parseSharedSearchQueryDocument(query.data.document);
	return (
		<SearchLayout
			id={`shared-search-${id}`}
			initialQuery={unitFilterSearchQuery(document.state.filter)}
			initialSelections={document.selections}
			initialState={document.state}
			key={id}
			source={{ kind: "template", template: document.template }}
		/>
	);
}

export function SearchPage({ sharedQueryId }: { readonly sharedQueryId?: string } = {}) {
	return sharedQueryId ? <SharedSearchPage id={sharedQueryId} /> : <RouteSearchPage />;
}

export function ScopedSearchPage({
	contexts = [],
	embedded = false,
	id,
	source,
}: {
	readonly contexts?: readonly SearchFeatureContext[];
	readonly embedded?: boolean;
	readonly id: string;
	readonly source: SearchSurfaceSource;
}) {
	const [query, setQuery] = useQueryState("q", searchParamsParsers.q);
	return (
		<SearchLayout
			contexts={contexts}
			embedded={embedded}
			id={id}
			initialQuery={query}
			key={`${id}:${query}`}
			onQueryChange={(next) => void setQuery(next || null, { history: "push" })}
			source={source}
		/>
	);
}
