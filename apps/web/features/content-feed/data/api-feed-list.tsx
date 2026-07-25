"use client";

import { ContentLanguageValues, type ContentLanguage } from "@rezics/i18n";
import { createSimpleFeedFilter, type SimpleFeedContentKind } from "@rezics/filter";
import { postApiFeedQuery, useGetApiRealms, useGetApiTags } from "@rezics/openapi-tanstack-query";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";

import { Alert, AlertAction, AlertDescription, Button, ChoiceSelect } from "@rezics/ui";
import { useTranslation } from "@/i18n/client";
import { useHydratedSession } from "@/lib/use-hydrated-session";
import { FeedContentSelector } from "../components/feed-content-selector";
import { FeedFilterSelector, type FeedFilterOption } from "../components/feed-filter-selector";
import { FeedItemCard } from "../components/feed-item-card";
import { FeedList } from "../components/feed-list";
import { FeedSortValues, type FeedSort } from "../model/feed-sort";
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
	const { t } = useTranslation(["actions", "feed", "state"]);
	const { data: session } = useHydratedSession();
	const [hidden, setHidden] = useState<ReadonlySet<string>>(() => new Set());
	const baseBody = {
		limit: 20,
		sort,
		...(() => {
			const filter = createSimpleFeedFilter({
				contentKinds,
				languages,
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
						canExclude={Boolean(session)}
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
	const { t } = useTranslation(["feed"]);
	const realms = useGetApiRealms(
		{ query: { limit: 50 } },
		{ query: { enabled: Boolean(onRealmIdsChange) } },
	);
	const tags = useGetApiTags(
		{ query: { limit: 50 } },
		{ query: { enabled: Boolean(onTagIdsChange) } },
	);
	const sortOptions = FeedSortValues.map((value) => ({
		value,
		label: t.feed.sort[value],
	})) satisfies readonly FeedFilterOption<FeedSort>[];
	const languageOptions = ContentLanguageValues.map((value) => ({
		value,
		label: t.feed.filters.languages.options[value],
	})) satisfies readonly FeedFilterOption<ContentLanguage>[];
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

	return (
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
				<FeedContentSelector onValueChange={onContentKindsChange} value={contentKinds} />
			) : null}
			{onLanguagesChange ? (
				<FeedFilterSelector
					ariaLabel={t.feed.filters.languages.label}
					clearLabel={t.feed.filters.clear}
					groupLabel={t.feed.filters.languages.label}
					onValueChange={onLanguagesChange}
					options={languageOptions}
					selectedCountLabel={(count) => t.feed.filters.selectedCount({ count })}
					unfilteredLabel={t.feed.filters.languages.all}
					value={languages}
				/>
			) : null}
			{onRealmIdsChange && realmOptions.length ? (
				<FeedFilterSelector
					ariaLabel={t.feed.filters.realms.label}
					clearLabel={t.feed.filters.clear}
					groupLabel={t.feed.filters.realms.label}
					onValueChange={onRealmIdsChange}
					options={realmOptions}
					selectedCountLabel={(count) => t.feed.filters.selectedCount({ count })}
					unfilteredLabel={t.feed.filters.realms.all}
					value={realmIds}
				/>
			) : null}
			{onTagIdsChange && tagOptions.length ? (
				<FeedFilterSelector
					ariaLabel={t.feed.filters.tags.label}
					clearLabel={t.feed.filters.clear}
					groupLabel={t.feed.filters.tags.label}
					onValueChange={onTagIdsChange}
					options={tagOptions}
					selectedCountLabel={(count) => t.feed.filters.selectedCount({ count })}
					unfilteredLabel={t.feed.filters.tags.all}
					value={tagIds}
				/>
			) : null}
		</div>
	);
}
