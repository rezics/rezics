"use client";

import {
	getApiFeed,
	getApiFeedQueryKey,
	type GetApiFeedSort,
} from "@rezics/openapi-tanstack-query";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";

import { Alert, AlertAction, AlertDescription, Button, ChoiceSelect } from "@rezics/ui";
import { useTranslation } from "@/i18n/client";
import { useHydratedSession } from "@/lib/use-hydrated-session";
import { FeedContentSelector, type FeedContentOption } from "../components/feed-content-selector";
import { FeedItemCard } from "../components/feed-item-card";
import { FeedList } from "../components/feed-list";
import type { FeedContentKind } from "../model/feed-kind";
import { filterSelectionFromValues, filterSelectionValues } from "../model/filter-selection";

const FeedSorts = [
	"best",
	"hot",
	"new",
	"top",
	"rising",
] as const satisfies readonly GetApiFeedSort[];

export interface ApiFeedListProps<ContentKind extends FeedContentKind = FeedContentKind> {
	contentKinds: readonly ContentKind[];
	contentOptions: readonly ContentKind[];
	infinite?: boolean;
	onContentKindsChange?: (contentKinds: readonly ContentKind[]) => void;
	onSortChange?: (sort: GetApiFeedSort) => void;
	personalized?: boolean;
	realmId?: string;
	showBulkActions?: boolean;
	sort?: GetApiFeedSort;
	subjectId?: string;
}

export function ApiFeedList<ContentKind extends FeedContentKind>({
	contentKinds,
	contentOptions,
	infinite = false,
	onContentKindsChange,
	onSortChange,
	personalized,
	realmId,
	showBulkActions = false,
	sort = "new",
	subjectId,
}: ApiFeedListProps<ContentKind>) {
	const { t } = useTranslation(["actions", "feed", "state"]);
	const { data: session } = useHydratedSession();
	const [hidden, setHidden] = useState<ReadonlySet<string>>(() => new Set());
	const selectedContent = filterSelectionValues(
		filterSelectionFromValues(contentKinds),
		contentOptions,
	);
	const baseQuery = {
		content: [...selectedContent],
		limit: 20,
		sort,
		...(realmId ? { realmId } : {}),
		...(subjectId ? { subjectId } : {}),
		...(personalized === undefined ? {} : { personalized }),
	};
	const query = useInfiniteQuery({
		queryKey: getApiFeedQueryKey({ query: baseQuery }),
		queryFn: async ({ pageParam, signal }) => {
			const { data } = await getApiFeed({
				query: { ...baseQuery, ...(pageParam ? { cursor: pageParam } : {}) },
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
	const showControls = Boolean(onSortChange || onContentKindsChange);

	return (
		<div className="min-w-0" data-content={contentKinds.join(",")} data-sort={sort}>
			{showControls ? (
				<FeedListControls
					contentKinds={contentKinds}
					contentOptions={contentOptions}
					onContentKindsChange={onContentKindsChange}
					onSortChange={onSortChange}
					showBulkActions={showBulkActions}
					sort={sort}
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
						requestedRealmId={realmId}
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

export function FeedListControls<ContentKind extends FeedContentKind>({
	contentKinds,
	contentOptions,
	onContentKindsChange,
	onSortChange,
	showBulkActions = false,
	sort,
}: Pick<
	ApiFeedListProps<ContentKind>,
	| "contentKinds"
	| "contentOptions"
	| "onContentKindsChange"
	| "onSortChange"
	| "showBulkActions"
	| "sort"
>) {
	const { t } = useTranslation(["feed"]);
	const sortOptions = FeedSorts.map((value) => ({
		value,
		label: t.feed.sort[value],
	})) satisfies readonly FeedContentOption<GetApiFeedSort>[];
	const localizedContentOptions = contentOptions.map((value): FeedContentOption<ContentKind> => ({
		value,
		label: t.feed.content.kinds[value],
		...(value === "post:post"
			? { description: t.feed.content.postDescription }
			: value === "post:reply"
				? { description: t.feed.content.replyDescription }
				: {}),
	}));

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
					value={[sort ?? "new"]}
				/>
			) : null}
			{onContentKindsChange && contentOptions.length > 1 ? (
				<FeedContentSelector
					onValueChange={onContentKindsChange}
					options={localizedContentOptions}
					showBulkActions={showBulkActions}
					value={contentKinds}
				/>
			) : null}
		</div>
	);
}
