"use client";

import { ContentLanguageValues, type ContentLanguage } from "@rezics/i18n";
import { createSimpleFeedFilter, type SimpleFeedContentKind } from "@rezics/filter";
import {
	postApiFeedQuery,
	useGetApiRealms,
	useGetApiTags,
	useGetApiUsersMePreferences,
} from "@rezics/openapi-tanstack-query";
import { useInfiniteQuery } from "@tanstack/react-query";
import { ListFilterIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import {
	Alert,
	AlertAction,
	AlertDescription,
	Badge,
	Button,
	ChoiceSelect,
	type ChoiceOption,
} from "@rezics/ui";
import { useTranslation } from "@/i18n/client";
import { useLocalizationLanguages } from "@/i18n/use-localization-languages";
import { useHydratedSession } from "@/lib/use-hydrated-session";
import { FeedContentSelector } from "../components/feed-content-selector";
import { FeedFiltersDialog } from "../components/feed-filters-dialog";
import { FeedItemCard } from "../components/feed-item-card";
import { FeedList } from "../components/feed-list";
import { FeedSortValues, type FeedSort } from "../model/feed-sort";
import { resolveFeedFilterLanguages } from "../model/feed-language-filter";
import { FeedQueryKey } from "../query";

export interface ApiFeedListProps {
	contentKinds?: readonly SimpleFeedContentKind[];
	infinite?: boolean;
	languages?: readonly ContentLanguage[];
	onContentKindsChange?: (contentKinds: readonly SimpleFeedContentKind[]) => void;
	onLanguagesChange?: (languages: readonly ContentLanguage[]) => void;
	onRealmIdsChange?: (realmIds: readonly string[]) => void;
	onSortChange?: (sort: FeedSort) => void;
	onTagIdsChange?: (tagIds: readonly string[]) => void;
	realmIds?: readonly string[];
	sort?: FeedSort;
	tagIds?: readonly string[];
}

export function ApiFeedList({
	contentKinds = [],
	infinite = false,
	languages = [],
	onContentKindsChange,
	onLanguagesChange,
	onRealmIdsChange,
	onSortChange,
	onTagIdsChange,
	realmIds = [],
	sort = "best",
	tagIds = [],
}: ApiFeedListProps) {
	const { t } = useTranslation(["actions", "feed", "locale", "state"]);
	const session = useHydratedSession();
	const preferences = useGetApiUsersMePreferences({
		query: { enabled: Boolean(session.data) },
	});
	const localizationLanguages = useLocalizationLanguages();
	const languageDefaultProfileId = session.data?.user.id ?? "anonymous";
	const initializedLanguageDefault = useRef<string | undefined>(undefined);
	const preferencesReady = !session.isPending && (!session.data || !preferences.isPending);
	const filterLanguages = resolveFeedFilterLanguages({
		allowDefault: preferencesReady && Boolean(onLanguagesChange),
		defaultInitialized: initializedLanguageDefault.current === languageDefaultProfileId,
		filterByPreferredLanguages: preferences.data?.filterFeedByPreferredLanguages ?? false,
		preferredLanguages: preferences.data?.preferredLanguages ?? [],
		requestedLanguages: languages,
	});
	const [hidden, setHidden] = useState<ReadonlySet<string>>(() => new Set());
	useEffect(() => {
		if (
			initializedLanguageDefault.current === languageDefaultProfileId ||
			session.isPending ||
			(session.data && preferences.isPending)
		)
			return;
		initializedLanguageDefault.current = languageDefaultProfileId;
		if (
			onLanguagesChange &&
			languages.length === 0 &&
			preferences.data?.filterFeedByPreferredLanguages &&
			preferences.data.preferredLanguages.length
		)
			onLanguagesChange(preferences.data.preferredLanguages);
	}, [
		languageDefaultProfileId,
		languages.length,
		onLanguagesChange,
		preferences.data,
		preferences.isPending,
		session.data,
		session.isPending,
	]);
	const baseBody = {
		limit: 20,
		localizationLanguages,
		sort,
		...(() => {
			const filter = createSimpleFeedFilter({
				contentKinds,
				languages: filterLanguages,
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
		enabled: preferencesReady,
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
	const showControls = Boolean(
		onSortChange ||
		onContentKindsChange ||
		onLanguagesChange ||
		onRealmIdsChange ||
		onTagIdsChange,
	);
	const requestedRealmId = realmIds.length === 1 ? realmIds[0] : undefined;

	return (
		<div
			className="min-w-0"
			data-content={contentKinds.join(",")}
			data-languages={languages.join(",")}
			data-realms={realmIds.join(",")}
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
					sort={sort}
					tagIds={tagIds}
				/>
			) : null}
			<FeedList
				aria-label={t.feed.title}
				className={showControls ? "mt-3 sm:mt-4" : undefined}
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
						canExclude={Boolean(session.data)}
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
	| "sort"
	| "tagIds"
>) {
	const { t } = useTranslation(["feed", "locale"]);
	const localizationLanguages = useLocalizationLanguages();
	const [filtersOpen, setFiltersOpen] = useState(false);
	const realms = useGetApiRealms(
		{ query: { localizationLanguages, limit: 50 } },
		{ query: { enabled: Boolean(onRealmIdsChange) } },
	);
	const tags = useGetApiTags(
		{ query: { localizationLanguages, limit: 50 } },
		{ query: { enabled: Boolean(onTagIdsChange) } },
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
