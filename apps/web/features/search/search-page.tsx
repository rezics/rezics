"use client";

import {
	parseSearchFeatureDefinition,
	parseSharedSearchQueryDocument,
	SearchCategoryValues,
	type ResolvedSearchControl,
	type SearchCategory,
	type SearchFeatureContext,
	type SearchFeatureState,
	type SearchInjection,
	type SearchScalar,
	type SearchTemplateId,
	type SharedSearchQuerySelection,
	type SharedSearchQueryState,
} from "@rezics/search";
import {
	type PostApiSearchFeaturesByTemplateExecuteStatus200,
	useGetApiSearchFeaturesByTemplate,
	useGetApiSearchZonesByZoneIdFeature,
	useGetApiSearchSharedQueriesById,
	usePostApiSearchFeaturesByTemplateExecute,
	usePostApiSearchZonesByZoneIdFeatureExecute,
	usePostApiSearchSharedQueries,
} from "@rezics/openapi-tanstack-query";
import { Button, PageHeading, QueryFailure, QueryPending } from "@rezics/ui";
import { useQueryState, useQueryStates } from "nuqs";
import { useEffect, useRef, useState } from "react";

import { profileHref } from "@/features/profiles/profile-route";
import { realmHref } from "@/features/slugs/unit-route";
import { useTranslation } from "@/i18n/client";
import { RequestFailure } from "@/i18n/request-failure";
import { searchParamsParsers } from "@/lib/search-params";
import {
	SearchFeature,
	type SearchFeatureRequest,
	type SearchFeatureShareRequest,
} from "./search-feature";
import { SearchResultCard } from "./search-result-card";

type SearchResponse = PostApiSearchFeaturesByTemplateExecuteStatus200;
type SearchGroup = SearchResponse["groups"][number];
type SearchHit = SearchGroup["hits"][number];
const DisabledZoneId = "00000000-0000-7000-8000-000000000000";

export type SearchSurfaceSource =
	| Readonly<{ kind: "template"; template: SearchTemplateId }>
	| Readonly<{ kind: "zone"; zoneId: string }>;

function isSearchCategory(value: string): value is SearchCategory {
	return SearchCategoryValues.some((category) => category === value);
}

function displayCount(value: string | number): number {
	const parsed = typeof value === "number" ? value : Number(value);
	return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : 0;
}

function searchHitHref(hit: SearchHit) {
	switch (hit.category) {
		case "users":
			return profileHref(hit);
		case "realms":
			return realmHref(hit);
		case "posts":
			return `/posts/${hit.id}`;
		case "collections":
			return `/collections/${hit.id}`;
		case "reviews":
			return `/reviews/${hit.id}`;
		case "entity":
			return `/entities/${hit.id}`;
		case "tags":
			return `/tags/${hit.id}`;
		case "tag-structures":
			return `/tag-structures/${hit.id}`;
		case "polls":
			return `/polls/${hit.id}`;
		case "units":
			return hit.kind === "book" || hit.kind === "software" || hit.kind === "media"
				? `/units/${hit.kind}/${hit.id}`
				: undefined;
		default:
			return undefined;
	}
}

function appendGroups(
	current: readonly SearchGroup[],
	next: readonly SearchGroup[],
): SearchGroup[] {
	const groups = new Map(current.map((group) => [group.index, group]));
	for (const group of next) {
		const previous = groups.get(group.index);
		if (!previous) {
			groups.set(group.index, group);
			continue;
		}
		const hits = new Map(previous.hits.map((hit) => [hit.id, hit]));
		for (const hit of group.hits) hits.set(hit.id, hit);
		groups.set(group.index, { ...group, hits: [...hits.values()] });
	}
	return [...groups.values()];
}

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
	const { t } = useTranslation(["actions", "search", "state"]);
	const template = source.kind === "template" ? source.template : "global";
	const templateDefinition = useGetApiSearchFeaturesByTemplate(
		{ path: { template } },
		{ query: { enabled: source.kind === "template" } },
	);
	const zoneDefinition = useGetApiSearchZonesByZoneIdFeature(
		{ path: { zoneId: source.kind === "zone" ? source.zoneId : DisabledZoneId } },
		{ query: { enabled: source.kind === "zone" } },
	);
	const executeTemplate = usePostApiSearchFeaturesByTemplateExecute();
	const executeZone = usePostApiSearchZonesByZoneIdFeatureExecute();
	const shareMutation = usePostApiSearchSharedQueries();
	const [groups, setGroups] = useState<readonly SearchGroup[]>([]);
	const [facets, setFacets] = useState<SearchResponse["facets"]>();
	const [nextCursor, setNextCursor] = useState<string>();
	const [lastRequest, setLastRequest] = useState<SearchFeatureRequest>();
	const initialExecuted = useRef(false);
	const rawDefinition =
		source.kind === "template" ? templateDefinition.data : zoneDefinition.data?.definition;

	async function run(request: SearchFeatureRequest, append = false) {
		if (!append) {
			setLastRequest(request);
			onQueryChange?.(request.state.query?.trim() ?? "");
		}
		try {
			const response =
				source.kind === "template"
					? await executeTemplate.mutateAsync({
							path: { template: source.template },
							body: {
								contexts: [...contexts],
								injections: request.injections,
								state: request.state,
							},
						})
					: await executeZone.mutateAsync({
							path: { zoneId: source.zoneId },
							body: {
								injections: request.injections,
								state: request.state,
							},
						});
			setGroups((current) =>
				append ? appendGroups(current, response.groups) : response.groups,
			);
			setFacets(response.facets);
			setNextCursor(response.nextCursor);
		} catch {
			// The mutation state supplies the localized visible failure.
		}
	}

	useEffect(() => {
		if ((!initialState && !initialQuery?.trim()) || !rawDefinition || initialExecuted.current)
			return;
		const definition = parseSearchFeatureDefinition(rawDefinition);
		const state =
			initialState ??
			(definition.document.modes.default === "basic"
				? { mode: "basic" as const, query: initialQuery, values: [] }
				: { mode: "advanced" as const, query: initialQuery });
		initialExecuted.current = true;
		void run({ injections: [...injections], state });
	}, [initialQuery, initialState, injections, rawDefinition]);

	const definitionPending =
		source.kind === "template" ? templateDefinition.isPending : zoneDefinition.isPending;
	const definitionError =
		source.kind === "template" ? templateDefinition.error : zoneDefinition.error;
	const executionPending = executeTemplate.isPending || executeZone.isPending;
	const executionError = executeTemplate.error ?? executeZone.error;
	const executionIsError = executeTemplate.isError || executeZone.isError;
	const executionIsSuccess = executeTemplate.isSuccess || executeZone.isSuccess;
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
	const hasHits = groups.some((group) => group.hits.length > 0);

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
		<>
			<SearchFeature
				definition={definition}
				error={executionIsError}
				facets={facets}
				id={id}
				initialQuery={initialQuery}
				initialSelections={initialSelections}
				initialState={initialState}
				injections={injections}
				onExecute={(request) => void run(request)}
				onInjectionsChange={onInjectionsChange}
				onShare={source.kind === "template" ? share : undefined}
				pending={executionPending}
				resolveOptionLabel={resolveOptionLabel}
			/>
			{executionError ? <RequestFailure error={executionError} /> : null}
			{hasHits ? (
				<section aria-label={t.search.results} className="grid gap-8">
					<h2 className="font-heading font-semibold text-xl">{t.search.results}</h2>
					{groups.flatMap((group) => {
						if (!group.hits.length) return [];
						const category = isSearchCategory(group.index) ? group.index : undefined;
						const categoryLabel = category
							? t.search.resultGroups[category]
							: group.index;
						return [
							<section className="grid gap-3" key={group.index}>
								<header className="flex items-baseline justify-between gap-3 border-b border-border-weak pb-2">
									<h3 className="font-semibold">{categoryLabel}</h3>
									<span className="text-muted-foreground text-sm">
										{group.total.relation === "lower-bound"
											? t.search.atLeastResultCount({
													count: displayCount(group.total.value),
												})
											: t.search.resultCount({
													count: displayCount(group.total.value),
												})}
									</span>
								</header>
								<ul className="grid gap-3 sm:gap-4">
									{group.hits.map((hit) => (
										<li key={hit.id}>
											<SearchResultCard
												categoryLabel={categoryLabel}
												result={{
													title: hit.titles[0] ?? hit.name,
													summary: hit.summaries[0] ?? hit.summary,
													href: searchHitHref(hit),
													avatar: hit.avatar,
												}}
											/>
										</li>
									))}
								</ul>
							</section>,
						];
					})}
				</section>
			) : executionIsSuccess ? (
				<p className="text-sm text-muted-foreground">{t.search.empty}</p>
			) : null}
			{nextCursor && lastRequest ? (
				<div className="flex justify-center">
					<Button
						isLoading={executionPending}
						onClick={() => {
							const state: SearchFeatureState = {
								...lastRequest.state,
								cursor: nextCursor,
							};
							void run({ ...lastRequest, state }, true);
						}}
						variant="outline"
					>
						{t.actions.loadMore}
					</Button>
				</div>
			) : null}
		</>
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
			initialQuery={document.state.query}
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
