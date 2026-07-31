"use client";

import { ContentLanguageValues, type ContentLanguage } from "@rezics/i18n";
import { type SimpleFeedContentKind, type UnitPredicate } from "@rezics/filter";
import { postApiFeedQuery, useGetApiRealms, useGetApiTags } from "@rezics/openapi-tanstack-query";
import { useInfiniteQuery } from "@tanstack/react-query";
import { ListFilterIcon, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { Badge, Button, ChoiceSelect, Input, type ChoiceOption } from "@rezics/ui";
import { usePresentationPreferences } from "@/features/preferences/data/use-presentation-preferences";
import { useTranslation } from "@/i18n/client";
import { useLocalizationLanguageState } from "@/i18n/use-localization-languages";
import { toNonNegativeApiInteger } from "@/lib/api-number";
import { useHydratedSession } from "@/lib/use-hydrated-session";
import { FeedContentSelector } from "../components/feed-content-selector";
import { FeedFiltersDialog } from "../components/feed-filters-dialog";
import { FeedItemCard, type FeedItem } from "../components/feed-item-card";
import { FeedList } from "../components/feed-list";
import { createApiFeedFilter } from "../model/api-feed-filter";
import { resolveFeedContinuationState, type FeedPaginationMode } from "../model/feed-continuation";
import type { FeedDisplayContext } from "../model/feed-display-context";
import { collectUniqueFeedItems } from "../model/feed-items";
import { FeedSortValues, type FeedSort } from "../model/feed-sort";
import { resolveFeedFilterLanguages } from "../model/feed-language-filter";
import { FeedQueryKey } from "../query";

export interface ApiFeedSearchControl {
	readonly label: string;
	readonly onQueryChange: (query: string) => void;
	readonly placeholder: string;
	readonly query: string;
}

export interface ApiFeedListProps {
	"aria-label"?: string;
	additionalFilter?: UnitPredicate;
	contentKinds?: readonly SimpleFeedContentKind[];
	displayContext?: FeedDisplayContext;
	emptyBody?: string;
	emptyTitle?: string;
	languages?: readonly ContentLanguage[];
	limit?: number;
	onContentKindsChange?: (contentKinds: readonly SimpleFeedContentKind[]) => void;
	onLanguagesChange?: (languages: readonly ContentLanguage[]) => void;
	onRealmIdsChange?: (realmIds: readonly string[]) => void;
	onSortChange?: (sort: FeedSort) => void;
	onTagIdsChange?: (tagIds: readonly string[]) => void;
	pagination?: FeedPaginationMode;
	realmIds?: readonly string[];
	renderOverflowActions?: (item: FeedItem) => ReactNode;
	renderSummary?: (metadata: ApiFeedResultMetadata) => ReactNode;
	search?: ApiFeedSearchControl;
	sort?: FeedSort;
	tagIds?: readonly string[];
}

export interface ApiFeedResultMetadata {
	readonly displayedCount: number;
	readonly total: Readonly<{
		readonly relation: "exact" | "lower-bound";
		readonly value: number;
	}>;
}

export function ApiFeedList({
	"aria-label": ariaLabel,
	additionalFilter,
	contentKinds = [],
	displayContext,
	emptyBody,
	emptyTitle,
	languages = [],
	limit = 20,
	onContentKindsChange,
	onLanguagesChange,
	onRealmIdsChange,
	onSortChange,
	onTagIdsChange,
	pagination = "load-more",
	realmIds = [],
	renderOverflowActions,
	renderSummary,
	search,
	sort = "best",
	tagIds = [],
}: ApiFeedListProps) {
	const { t } = useTranslation(["actions", "feed", "locale", "state"]);
	const searchQuery = search?.query ?? "";
	const session = useHydratedSession();
	const preferences = usePresentationPreferences();
	const localizationState = useLocalizationLanguageState();
	const languageDefaultAccountId = session.data?.user.id ?? "anonymous";
	const initializedLanguageDefault = useRef<string | undefined>(undefined);
	const preferencesReady = localizationState.status === "ready";
	const filterLanguages = resolveFeedFilterLanguages({
		allowDefault: preferencesReady && Boolean(onLanguagesChange),
		defaultInitialized: initializedLanguageDefault.current === languageDefaultAccountId,
		filterByPreferredLanguages: preferences.data?.filterFeedByPreferredLanguages ?? false,
		preferredLanguages: preferences.data?.preferredLanguages ?? [],
		requestedLanguages: languages,
	});
	const [hidden, setHidden] = useState<ReadonlySet<string>>(() => new Set());
	useEffect(() => {
		if (initializedLanguageDefault.current === languageDefaultAccountId || !preferencesReady)
			return;
		initializedLanguageDefault.current = languageDefaultAccountId;
		if (
			onLanguagesChange &&
			languages.length === 0 &&
			preferences.data?.filterFeedByPreferredLanguages &&
			preferences.data.preferredLanguages.length
		)
			onLanguagesChange(preferences.data.preferredLanguages);
	}, [
		languageDefaultAccountId,
		languages.length,
		onLanguagesChange,
		preferences.data,
		preferencesReady,
	]);
	const baseBody = {
		limit,
		...(localizationState.status === "ready"
			? { localizationLanguages: [...localizationState.languages] }
			: {}),
		sort,
		...(() => {
			const filter = createApiFeedFilter({
				additionalFilter,
				contentKinds,
				languages: filterLanguages,
				query: searchQuery,
				realmIds,
				tagIds,
			});
			return filter ? { filter } : {};
		})(),
	};
	const query = useInfiniteQuery({
		queryKey: [...FeedQueryKey, baseBody],
		queryFn: async ({ pageParam, signal }) => {
			const { data } = await postApiFeedQuery({
				body: { ...baseBody, ...(pageParam ? { cursor: pageParam } : {}) },
				signal,
			});
			return data;
		},
		enabled: localizationState.status === "ready",
		initialPageParam: "",
		getNextPageParam: (page) => page.nextCursor ?? undefined,
	});
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
	const total = query.data?.pages[0]?.total;
	const feedSetSize = total
		? total.relation === "exact"
			? toNonNegativeApiInteger(total.value)
			: -1
		: undefined;
	const setItemHidden = (id: string, value: boolean) =>
		setHidden((current) => {
			const next = new Set(current);
			if (value) next.add(id);
			else next.delete(id);
			return next;
		});
	const showControls = Boolean(
		onSortChange ||
		onContentKindsChange ||
		onLanguagesChange ||
		onRealmIdsChange ||
		search ||
		onTagIdsChange,
	);
	const requestedRealmId = realmIds.length === 1 ? realmIds[0] : undefined;

	return (
		<div
			className="min-w-0"
			data-content={contentKinds.join(",")}
			data-languages={languages.join(",")}
			data-realms={realmIds.join(",")}
			data-search={searchQuery}
			data-sort={sort}
			data-tags={tagIds.join(",")}
		>
			{showControls ? (
				<FeedListControls
					contentKinds={contentKinds}
					languages={languages}
					onContentKindsChange={onContentKindsChange}
					onLanguagesChange={onLanguagesChange}
					onRealmIdsChange={onRealmIdsChange}
					onSortChange={onSortChange}
					onTagIdsChange={onTagIdsChange}
					realmIds={realmIds}
					search={search}
					sort={sort}
					tagIds={tagIds}
				/>
			) : null}
			{renderSummary && total ? (
				<div aria-atomic="true" aria-live="polite">
					{renderSummary({
						displayedCount: items.length,
						total: {
							relation: total.relation,
							value: toNonNegativeApiInteger(total.value),
						},
					})}
				</div>
			) : null}
			<FeedList
				aria-label={ariaLabel ?? t.feed.title}
				className={showControls ? "mt-3 sm:mt-4" : undefined}
				continuation={
					pagination === "none"
						? undefined
						: { mode: pagination, state: continuationState }
				}
				emptyBody={emptyBody ?? t.feed.emptyBody}
				emptyTitle={emptyTitle ?? t.feed.emptyTitle}
				errorLabel={t.state.error}
				getItemKey={(item) => item.id}
				renderItem={(item, metadata) => (
					<FeedItemCard
						canExclude={Boolean(session.data)}
						displayContext={displayContext}
						item={item}
						onHiddenChange={(value) => setItemHidden(item.id, value)}
						position={metadata.position}
						preserveDisplayedLanguage={filterLanguages.length > 0}
						requestedRealmId={requestedRealmId}
						overflowActions={renderOverflowActions?.(item)}
						setSize={metadata.setSize}
					/>
				)}
				retryLabel={t.actions.retry}
				setSize={feedSetSize}
				state={
					localizationState.status === "error"
						? { status: "error", retry: localizationState.retry }
						: localizationState.status === "restoring" || query.isPending
							? { status: "pending" }
							: query.isError && !query.data
								? { status: "error", retry: () => void query.refetch() }
								: { status: "ready", items }
				}
			/>
		</div>
	);
}

export function FeedListControls({
	contentKinds = [],
	languages = [],
	onContentKindsChange,
	onLanguagesChange,
	onRealmIdsChange,
	onSortChange,
	onTagIdsChange,
	realmIds = [],
	search,
	sort,
	tagIds = [],
}: Pick<
	ApiFeedListProps,
	| "contentKinds"
	| "languages"
	| "onContentKindsChange"
	| "onLanguagesChange"
	| "onRealmIdsChange"
	| "onSortChange"
	| "onTagIdsChange"
	| "realmIds"
	| "search"
	| "sort"
	| "tagIds"
>) {
	const { t } = useTranslation(["feed", "locale", "search"]);
	const localizationState = useLocalizationLanguageState();
	const searchQuery = search?.query ?? "";
	const localizationLanguages =
		localizationState.status === "ready" ? localizationState.languages : [];
	const [filtersOpen, setFiltersOpen] = useState(false);
	const [queryDraft, setQueryDraft] = useState(searchQuery);
	useEffect(() => setQueryDraft(searchQuery), [searchQuery]);
	const realms = useGetApiRealms(
		{ query: { localizationLanguages, limit: 50 } },
		{
			query: {
				enabled: Boolean(onRealmIdsChange) && localizationState.status === "ready",
			},
		},
	);
	const tags = useGetApiTags(
		{ query: { localizationLanguages, limit: 50 } },
		{
			query: {
				enabled: Boolean(onTagIdsChange) && localizationState.status === "ready",
			},
		},
	);
	const sortOptions = FeedSortValues.map((value) => ({
		value,
		label: t.feed.sort[value],
	})) satisfies readonly ChoiceOption<FeedSort>[];
	const languageOptions = ContentLanguageValues.map((value) => ({
		value,
		label: t.locale.contentLanguages[value],
	})) satisfies readonly ChoiceOption<ContentLanguage>[];
	const realmOptions =
		realms.data?.items.map((realm) => ({
			value: realm.id,
			label: realm.title ?? t.feed.filters.realms.unnamed,
		})) ?? [];
	const tagOptions =
		tags.data?.items.map((tag) => ({
			value: tag.id,
			label: tag.title ?? t.feed.filters.tags.unnamed,
		})) ?? [];
	const hasAdditionalFilters = Boolean(onLanguagesChange || onRealmIdsChange || onTagIdsChange);
	const selectedFilterCount =
		(onLanguagesChange ? languages.length : 0) +
		(onRealmIdsChange ? realmIds.length : 0) +
		(onTagIdsChange ? tagIds.length : 0);
	const filtersAriaLabel =
		selectedFilterCount > 0
			? `${t.feed.filters.title}, ${t.feed.filters.selectedCount({
					count: selectedFilterCount,
				})}`
			: t.feed.filters.title;

	return (
		<>
			<div
				aria-label={t.feed.filtersLabel}
				className="flex flex-wrap items-center justify-start gap-1 border-b border-border-weak pb-5"
				role="group"
			>
				{search ? (
					<form
						className="flex min-w-64 flex-1 items-stretch gap-2"
						onSubmit={(event) => {
							event.preventDefault();
							search.onQueryChange(queryDraft.trim());
						}}
						role="search"
					>
						<div className="relative min-w-0 flex-1">
							<Search
								aria-hidden
								className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
							/>
							<Input
								aria-label={search.label}
								className="h-12 ps-10"
								maxLength={500}
								onChange={(event) => setQueryDraft(event.currentTarget.value)}
								placeholder={search.placeholder}
								type="search"
								value={queryDraft}
							/>
						</div>
						<Button
							aria-label={t.search.submit}
							className="h-12 shrink-0"
							type="submit"
							variant="outline"
						>
							<Search aria-hidden />
						</Button>
					</form>
				) : null}
				{onSortChange ? (
					<ChoiceSelect
						ariaLabel={t.feed.sortLabel}
						className="min-w-0"
						onValueChange={([nextSort]) => {
							if (nextSort) onSortChange(nextSort);
						}}
						options={sortOptions}
						placeholder={t.feed.sortLabel}
						size="lg"
						value={[sort ?? "best"]}
					/>
				) : null}
				{onContentKindsChange ? (
					<FeedContentSelector
						onValueChange={onContentKindsChange}
						value={contentKinds}
					/>
				) : null}
				{hasAdditionalFilters ? (
					<Button
						aria-label={filtersAriaLabel}
						onClick={() => setFiltersOpen(true)}
						size="lg"
						type="button"
					>
						<ListFilterIcon aria-hidden data-icon="inline-start" />
						{t.feed.filters.title}
						{selectedFilterCount > 0 ? (
							<Badge aria-hidden size="sm" variant="secondary">
								{selectedFilterCount}
							</Badge>
						) : null}
					</Button>
				) : null}
			</div>
			{filtersOpen ? (
				<FeedFiltersDialog
					languageOptions={languageOptions}
					languages={languages}
					onClose={() => setFiltersOpen(false)}
					onLanguagesChange={onLanguagesChange}
					onRealmIdsChange={onRealmIdsChange}
					onTagIdsChange={onTagIdsChange}
					realmIds={realmIds}
					realmOptions={realmOptions}
					tagIds={tagIds}
					tagOptions={tagOptions}
				/>
			) : null}
		</>
	);
}
