"use client";

import {
	getApiFeed,
	getApiFeedQueryKey,
	type GetApiFeedSort,
} from "@rezics/openapi-tanstack-query";
import { useInfiniteQuery } from "@tanstack/react-query";
import { Children, Fragment, useEffect, useRef, useState, type ComponentProps } from "react";

import {
	Alert,
	AlertAction,
	AlertDescription,
	Button,
	CardContent,
	ChoiceSelect,
	Separator,
	Skeleton,
	cn,
} from "@rezics/ui";
import { useTranslation } from "@/i18n/client";
import { useHydratedSession } from "@/lib/use-hydrated-session";
import { FeedContentSelector, type FeedContentOption } from "./feed-content-selector";
import { FeedCard } from "./feed-card";
import { FeedItemCard } from "./feed-item-card";
import type { FeedContentKind } from "./feed-kind";

const FeedSorts = [
	"best",
	"hot",
	"new",
	"top",
	"rising",
] as const satisfies readonly GetApiFeedSort[];

export interface FeedListProps<ContentKind extends FeedContentKind = FeedContentKind> {
	contentKinds: readonly ContentKind[];
	contentOptions: readonly ContentKind[];
	infinite?: boolean;
	onContentKindsChange?: (contentKinds: readonly ContentKind[]) => void;
	onSortChange?: (sort: GetApiFeedSort) => void;
	personalized?: boolean;
	realmId?: string;
	showBulkActions?: boolean;
	sort?: GetApiFeedSort;
}

export function FeedList<ContentKind extends FeedContentKind>({
	contentKinds,
	contentOptions,
	infinite = false,
	onContentKindsChange,
	onSortChange,
	personalized,
	realmId,
	showBulkActions = false,
	sort = "new",
}: FeedListProps<ContentKind>) {
	const { t } = useTranslation(["actions", "feed", "state"]);
	const { data: session } = useHydratedSession();
	const [hidden, setHidden] = useState<ReadonlySet<string>>(() => new Set());
	const selectedContent = [...contentKinds];
	const baseQuery = {
		content: selectedContent,
		limit: 20,
		sort,
		...(realmId ? { realmId } : {}),
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
		enabled: selectedContent.length > 0,
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
			{selectedContent.length === 0 ? (
				<FeedEmptyState />
			) : query.isPending ? (
				<div className="grid gap-2 p-3 sm:p-4">
					{Array.from({ length: 4 }, (_, index) => (
						<FeedSkeleton key={index} />
					))}
				</div>
			) : query.isError && !query.data ? (
				<Alert className="m-3 sm:m-4" variant="destructive">
					<AlertDescription>{t.state.error}</AlertDescription>
					<AlertAction>
						<Button size="sm" variant="quiet" onClick={() => void query.refetch()}>
							{t.actions.retry}
						</Button>
					</AlertAction>
				</Alert>
			) : !items?.length ? (
				<FeedEmptyState />
			) : (
				<FeedListItems aria-label={t.feed.title}>
					{items.map((item) => (
						<FeedItemCard
							canExclude={Boolean(session)}
							item={item}
							key={item.id}
							onHiddenChange={(value) => setItemHidden(item.id, value)}
							requestedRealmId={realmId}
						/>
					))}
					{query.isFetchNextPageError ? (
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
					) : null}
				</FeedListItems>
			)}
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
	FeedListProps<ContentKind>,
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
					className="min-w-0 rounded-full px-2.5"
					onValueChange={([nextSort]) => {
						if (nextSort) onSortChange(nextSort);
					}}
					options={sortOptions}
					placeholder={t.feed.sortLabel}
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

export function FeedListItems({ children, className, ...props }: ComponentProps<"div">) {
	const items = Children.toArray(children);
	return (
		<div
			className={cn("w-full overflow-hidden bg-background", className)}
			data-slot="feed-list-items"
			role="feed"
			{...props}
		>
			{items.map((item, index) => (
				<Fragment key={index}>
					{item}
					{index < items.length - 1 ? <Separator className="bg-border-weak" /> : null}
				</Fragment>
			))}
		</div>
	);
}

function FeedEmptyState() {
	const { t } = useTranslation(["feed"]);
	return (
		<div className="grid min-h-56 place-items-center p-8 text-center">
			<div>
				<p className="font-heading font-bold">{t.feed.emptyTitle}</p>
				<p className="mt-1 text-muted-foreground text-sm">{t.feed.emptyBody}</p>
			</div>
		</div>
	);
}

function FeedSkeleton() {
	return (
		<FeedCard aria-hidden>
			<CardContent className="grid grid-cols-[5rem_minmax(0,1fr)] gap-4 px-4 py-5 sm:grid-cols-[7.5rem_minmax(0,1fr)] sm:px-5">
				<Skeleton className="aspect-[3/4] w-full rounded-xl" />
				<div className="grid content-start gap-3">
					<Skeleton className="h-4 w-1/3" />
					<Skeleton className="h-5 w-2/3" />
					<Skeleton className="h-16 w-full" />
				</div>
			</CardContent>
		</FeedCard>
	);
}
