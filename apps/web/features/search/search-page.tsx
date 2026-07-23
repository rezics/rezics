"use client";

import {
	parseSearchFeatureDefinition,
	type ResolvedSearchControl,
	type SearchFeatureContext,
	type SearchFeatureState,
	type SearchInjection,
	type SearchScalar,
	type SearchTemplateId,
} from "@rezics/search";
import {
	type PostApiSearchFeaturesByTemplateExecuteStatus200,
	useGetApiSearchFeaturesByTemplate,
	usePostApiSearchFeaturesByTemplateExecute,
} from "@rezics/openapi-tanstack-query";
import { Button, PageHeading, QueryFailure, QueryPending, UnitList } from "@rezics/ui";
import { useQueryStates } from "nuqs";
import { useState } from "react";

import { profileHref } from "@/features/profiles/profile-route";
import { realmHref } from "@/features/slugs/unit-route";
import { useTranslation } from "@/i18n/client";
import { RequestFailure } from "@/i18n/request-failure";
import { searchParamsParsers } from "@/lib/search-params";
import { SearchFeature, type SearchFeatureRequest } from "./search-feature";

type SearchHit = PostApiSearchFeaturesByTemplateExecuteStatus200["groups"][number]["hits"][number];

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

export function SearchSurface({
	id,
	template,
	contexts = [],
	injections = [],
	initialQuery,
	onInjectionsChange,
	onQueryChange,
	resolveOptionLabel,
}: {
	readonly id: string;
	readonly template: SearchTemplateId;
	readonly contexts?: readonly SearchFeatureContext[];
	readonly injections?: readonly SearchInjection[];
	readonly initialQuery?: string;
	readonly onInjectionsChange?: (injections: readonly SearchInjection[]) => void;
	readonly onQueryChange?: (query: string) => void;
	readonly resolveOptionLabel?: (
		control: ResolvedSearchControl,
		value: SearchScalar,
	) => string | undefined;
}) {
	const { t } = useTranslation(["actions", "search", "state"]);
	const definitionQuery = useGetApiSearchFeaturesByTemplate({ path: { template } });
	const execute = usePostApiSearchFeaturesByTemplateExecute();
	const [hits, setHits] = useState<readonly SearchHit[]>([]);
	const [facets, setFacets] =
		useState<PostApiSearchFeaturesByTemplateExecuteStatus200["facets"]>();
	const [nextCursor, setNextCursor] = useState<string>();
	const [lastRequest, setLastRequest] = useState<SearchFeatureRequest>();

	if (definitionQuery.isPending) return <QueryPending />;
	if (definitionQuery.isError)
		return (
			<QueryFailure
				error={definitionQuery.error}
				retry={() => void definitionQuery.refetch()}
			/>
		);
	const definition = parseSearchFeatureDefinition(definitionQuery.data);

	async function run(request: SearchFeatureRequest, append = false) {
		if (!append) {
			setLastRequest(request);
			onQueryChange?.(request.state.query?.trim() ?? "");
		}
		try {
			const response = await execute.mutateAsync({
				path: { template },
				body: {
					contexts: [...contexts],
					injections: request.injections,
					state: request.state,
				},
			});
			const nextHits = response.groups.flatMap((group) => group.hits);
			setHits((current) => (append ? [...current, ...nextHits] : nextHits));
			setFacets(response.facets);
			setNextCursor(response.nextCursor);
		} catch {
			// The mutation state supplies the localized visible failure.
		}
	}

	return (
		<>
			<SearchFeature
				definition={definition}
				error={execute.isError}
				facets={facets}
				id={id}
				initialQuery={initialQuery}
				injections={injections}
				onExecute={(request) => void run(request)}
				onInjectionsChange={onInjectionsChange}
				pending={execute.isPending}
				resolveOptionLabel={resolveOptionLabel}
			/>
			{execute.isError ? <RequestFailure error={execute.error} /> : null}
			{hits.length ? (
				<UnitList
					error={false}
					items={hits.map((hit) => ({
						id: hit.id,
						title: hit.titles[0] ?? null,
						summary: hit.summaries[0],
						href: searchHitHref(hit),
					}))}
					pending={false}
				/>
			) : execute.isSuccess ? (
				<p className="text-sm text-muted-foreground">{t.search.empty}</p>
			) : null}
			{nextCursor && lastRequest ? (
				<div className="flex justify-center">
					<Button
						isLoading={execute.isPending}
						onClick={() =>
							void run(
								{
									...lastRequest,
									state: {
										...lastRequest.state,
										cursor: nextCursor,
									} as SearchFeatureState,
								},
								true,
							)
						}
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

export function SearchPage() {
	const { t } = useTranslation("search");
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
		<main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-10 sm:px-6">
			<PageHeading title={t.title} />
			<SearchSurface
				contexts={[]}
				id={`${route.template}-search`}
				initialQuery={route.q}
				injections={injections}
				key={`${route.template}:${route.tag.join(",")}`}
				onInjectionsChange={(next) => {
					const tag = injectedTagIds(next);
					void setRoute({
						tag,
						tagLabel: tag.map((tagId) => labels.get(tagId) ?? tagId),
					});
				}}
				onQueryChange={(query) => void setRoute({ q: query || null }, { history: "push" })}
				resolveOptionLabel={(control, value) =>
					control.field === "tag" && typeof value === "string"
						? labels.get(value)
						: undefined
				}
				template={route.template}
			/>
		</main>
	);
}
