"use client";

import { ContentLanguageValues, type ContentLanguage } from "@rezics/i18n";
import {
	postApiSearchByIndex,
	type PostApiSearchByIndexIndex as SearchCategory,
	type PostApiSearchByIndexStatus200,
} from "@rezics/openapi-tanstack-query";
import { useInfiniteQuery } from "@tanstack/react-query";
import { Search, SlidersHorizontal } from "lucide-react";
import { useQueryStates } from "nuqs";
import { useEffect, useMemo, useRef, useState } from "react";

import {
	Badge,
	buttonVariants,
	Button,
	Checkbox,
	CheckboxGroup,
	Combobox,
	ComboboxContent,
	ComboboxEmpty,
	ComboboxGroup,
	ComboboxInput,
	ComboboxItem,
	ComboboxList,
	Collapsible,
	CollapsibleContent,
	CollapsibleIndicator,
	CollapsibleTrigger,
	createListCollection,
	Field,
	FieldGroup,
	FieldLabel,
	FieldLegend,
	FieldSet,
	InputGroup,
	InputGroupAddon,
	InputGroupInput,
	PageHeading,
	Spinner,
	UnitList,
} from "@rezics/ui";
import { useTranslation } from "@/i18n/client";
import { RequestFailure } from "@/i18n/request-failure";
import { profileHref } from "@/features/profiles/profile-route";
import { realmHref } from "@/features/slugs/unit-route";
import { searchParamsParsers, SearchScopes } from "@/lib/search-params";

type SearchHit = PostApiSearchByIndexStatus200["hits"][number];

const SearchCategories = SearchScopes;
const SearchPageSize = 8;
const AllLanguagesValue = "all";

type SearchLanguage = ContentLanguage | "";
type ComboboxOption = { label: string; value: string };
type SearchPageParam = { category: SearchCategory; cursor?: string };

function readSearchLanguage(value: string | null): SearchLanguage {
	return ContentLanguageValues.find((language) => language === value) ?? "";
}

function searchHitHref(index: string, hit: SearchHit) {
	switch (index) {
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
			return hit.type === "book" || hit.type === "software" || hit.type === "media"
				? `/units/${hit.type}/${hit.id}`
				: undefined;
		default:
			return undefined;
	}
}

export function SearchPage() {
	const { t } = useTranslation([
		"actions",
		"catalog",
		"engagement",
		"locale",
		"nav",
		"posts",
		"realms",
		"search",
		"state",
		"ui",
	]);
	const [route, setRoute] = useQueryStates(searchParamsParsers);
	const routeQuery = route.q.trim();
	const routeCategories = route.scope;
	const routeLanguage = route.language ?? "";
	const hasSearch =
		Boolean(routeQuery) ||
		routeCategories.length < SearchCategories.length ||
		Boolean(routeLanguage);
	const [input, setInput] = useState(routeQuery);
	const [filtersOpen, setFiltersOpen] = useState(
		routeCategories.length < SearchCategories.length || Boolean(routeLanguage),
	);
	const loadMoreRef = useRef<HTMLDivElement>(null);
	const languageOptions = useMemo<ComboboxOption[]>(
		() => [
			{ label: t.search.allLanguages, value: AllLanguagesValue },
			{ label: t.locale.zh, value: "zh" },
			{ label: t.locale.en, value: "en" },
		],
		[t.locale.en, t.locale.zh, t.search.allLanguages],
	);
	const languageCollection = useMemo(
		() =>
			createListCollection<ComboboxOption>({
				items: languageOptions,
				itemToString: (item) => item.label,
				itemToValue: (item) => item.value,
			}),
		[languageOptions],
	);
	useEffect(() => {
		setInput(routeQuery);
	}, [routeQuery]);
	const search = useInfiniteQuery({
		queryKey: ["search", routeQuery, routeCategories, routeLanguage],
		queryFn: async ({ pageParam, signal }) => {
			const groups = await Promise.all(
				pageParam.map(async ({ category, cursor }) => {
					const { data } = await postApiSearchByIndex({
						path: { index: category },
						body: {
							query: routeQuery,
							...(cursor ? { cursor } : {}),
							limit: SearchPageSize,
							...(routeLanguage ? { Languages: [routeLanguage] } : {}),
						},
						signal,
					});
					return {
						index: category,
						hits: data.hits,
						nextCursor: data.nextCursor,
					};
				}),
			);
			return { groups };
		},
		initialPageParam: routeCategories.map((category): SearchPageParam => ({ category })),
		getNextPageParam: (page) => {
			const nextPage: SearchPageParam[] = page.groups.flatMap(({ index, nextCursor }) =>
				nextCursor === undefined ? [] : [{ category: index, cursor: nextCursor }],
			);
			return nextPage.length ? nextPage : undefined;
		},
		enabled: hasSearch,
	});
	useEffect(() => {
		const element = loadMoreRef.current;
		if (
			!element ||
			!search.hasNextPage ||
			search.isFetchingNextPage ||
			search.isFetchNextPageError ||
			typeof IntersectionObserver === "undefined"
		)
			return;
		const observer = new IntersectionObserver(
			([entry]) => {
				if (entry?.isIntersecting) void search.fetchNextPage();
			},
			{ rootMargin: "320px 0px" },
		);
		observer.observe(element);
		return () => observer.disconnect();
	}, [
		search.fetchNextPage,
		search.hasNextPage,
		search.isFetchingNextPage,
		search.isFetchNextPageError,
	]);
	const categoryLabels: Record<SearchCategory, string> = {
		units: t.nav.units,
		users: t.ui.profile,
		entity: t.catalog.entities,
		tags: t.catalog.tags,
		posts: t.posts.title,
		realms: t.realms.title,
		collections: t.engagement.collections,
		reviews: t.engagement.reviews,
		polls: t.engagement.polls,
	};
	const activeFilterCount =
		Number(routeCategories.length < SearchCategories.length) + Number(Boolean(routeLanguage));
	const resultItems = search.data?.pages.flatMap((page) =>
		page.groups.flatMap((group) =>
			group.hits.map((hit) => ({
				id: hit.id,
				title: hit.titles[0] ?? null,
				summary: hit.summaries[0],
				href: searchHitHref(group.index, hit),
			})),
		),
	);
	return (
		<main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-10 sm:px-6">
			<PageHeading title={t.search.title} />
			<form
				className="flex flex-col gap-3"
				onSubmit={(event) => {
					event.preventDefault();
					void setRoute({ q: input.trim() }, { history: "push" });
				}}
			>
				<FieldGroup>
					<Field>
						<FieldLabel className="sr-only">{t.search.placeholder}</FieldLabel>
						<div className="flex flex-col gap-3 sm:flex-row">
							<InputGroup className="h-14 min-w-0 sm:flex-1" size="lg">
								<InputGroupAddon align="inline-start">
									<Search aria-hidden />
								</InputGroupAddon>
								<InputGroupInput
									aria-label={t.search.placeholder}
									className="h-full"
									maxLength={500}
									value={input}
									onChange={(event) => setInput(event.currentTarget.value)}
									placeholder={t.search.placeholder}
									type="search"
								/>
							</InputGroup>
							<Button
								variant="solid"
								className="h-14"
								type="submit"
								isLoading={search.isFetching && !search.isFetchingNextPage}
								size="xl"
							>
								{t.actions.search}
							</Button>
						</div>
					</Field>
					<Collapsible
						onOpenChange={({ open }) => setFiltersOpen(open)}
						open={filtersOpen}
					>
						<CollapsibleTrigger
							className={buttonVariants({ size: "sm" })}
							type="button"
						>
							<SlidersHorizontal data-icon="inline-start" />
							{t.search.advancedFilters}
							{activeFilterCount > 0 && (
								<Badge pill size="sm" variant="secondary">
									{activeFilterCount}
								</Badge>
							)}
							<CollapsibleIndicator />
						</CollapsibleTrigger>
						<CollapsibleContent className="pt-3">
							<FieldGroup className="rounded-xl border bg-card p-4 sm:p-5">
								<FieldSet>
									<FieldLegend variant="label">{t.search.scope}</FieldLegend>
									<CheckboxGroup className="grid grid-cols-2 gap-3 sm:grid-cols-3">
										{SearchCategories.map((category) => {
											const checked = routeCategories.includes(category);
											const disabled =
												checked && routeCategories.length === 1;
											return (
												<Field
													disabled={disabled}
													key={category}
													orientation="horizontal"
												>
													<Checkbox
														checked={checked}
														disabled={disabled}
														onCheckedChange={({
															checked: nextChecked,
														}) => {
															const scope = nextChecked
																? SearchCategories.filter(
																		(candidate) =>
																			candidate ===
																				category ||
																			routeCategories.includes(
																				candidate,
																			),
																	)
																: routeCategories.filter(
																		(candidate) =>
																			candidate !== category,
																	);
															void setRoute({ scope });
														}}
													/>
													<FieldLabel className="font-normal">
														{categoryLabels[category]}
													</FieldLabel>
												</Field>
											);
										})}
									</CheckboxGroup>
								</FieldSet>
								<Field className="max-w-md">
									<FieldLabel>{t.search.language}</FieldLabel>
									<Combobox
										collection={languageCollection}
										onValueChange={({ value }) => {
											const language = readSearchLanguage(value[0] ?? null);
											void setRoute({ language: language || null });
										}}
										value={[routeLanguage || AllLanguagesValue]}
									>
										<ComboboxInput aria-label={t.search.language} />
										<ComboboxContent>
											<ComboboxEmpty>{t.search.empty}</ComboboxEmpty>
											<ComboboxList>
												<ComboboxGroup>
													{languageOptions.map((option) => (
														<ComboboxItem
															item={option}
															key={option.value}
														>
															{option.label}
														</ComboboxItem>
													))}
												</ComboboxGroup>
											</ComboboxList>
										</ComboboxContent>
									</Combobox>
								</Field>
								<div className="flex justify-end">
									<Button
										onClick={() => {
											void setRoute({
												language: null,
												scope: [...SearchCategories],
											});
										}}
										size="sm"
										type="button"
										variant="quiet"
									>
										{t.search.resetFilters}
									</Button>
								</div>
							</FieldGroup>
						</CollapsibleContent>
					</Collapsible>
				</FieldGroup>
			</form>
			{search.isError && !search.data ? (
				<RequestFailure error={search.error} />
			) : hasSearch ? (
				<>
					{search.data && resultItems?.length === 0 && !search.isFetching ? (
						<p className="text-muted-foreground text-sm">{t.search.empty}</p>
					) : (
						<UnitList items={resultItems} pending={search.isPending} error={false} />
					)}
					{search.hasNextPage && !search.isFetchNextPageError && (
						<div
							aria-live="polite"
							className="grid min-h-10 place-items-center"
							ref={loadMoreRef}
						>
							{search.isFetchingNextPage && <Spinner aria-label={t.state.loading} />}
						</div>
					)}
					{search.isFetchNextPageError && (
						<div className="flex flex-col items-start gap-3">
							<RequestFailure error={search.error} />
							<Button
								onClick={() => void search.fetchNextPage()}
								size="sm"
								variant="outline"
							>
								{t.actions.retry}
							</Button>
						</div>
					)}
				</>
			) : null}
		</main>
	);
}
