"use client";

import {
	type GetApiFeedSort,
	useGetApiRecommendationsPostsByPostId,
} from "@rezics/openapi-tanstack-query";
import { useState } from "react";

import { CardContent, Skeleton } from "@rezics/ui";
import { FeedCard } from "@/features/content-feed/components/feed-card";
import { FeedPostCard } from "@/features/content-feed/components/feed-item-card";
import { FeedListItems } from "@/features/content-feed/components/feed-list";
import { ApiFeedList } from "@/features/content-feed/data/api-feed-list";
import {
	DefaultPostListContentKinds,
	PostListContentKinds,
	type PostListContentKind,
} from "@/features/content-feed/model/feed-kind";
import { useTranslation } from "@/i18n/client";
import { useHydratedSession } from "@/lib/use-hydrated-session";

export function PostList({
	infinite = false,
	onPostKindsChange,
	onSortChange,
	personalized,
	postKinds: controlledPostKinds,
	realmId,
	sort: controlledSort,
	subjectId,
}: {
	infinite?: boolean;
	onPostKindsChange?: (postKinds: readonly PostListContentKind[]) => void;
	onSortChange?: (sort: GetApiFeedSort) => void;
	personalized?: boolean;
	postKinds?: readonly PostListContentKind[];
	realmId?: string;
	sort?: GetApiFeedSort;
	subjectId?: string;
}) {
	const [postKinds, setPostKinds] = useState<readonly PostListContentKind[]>(
		DefaultPostListContentKinds,
	);
	const [sort, setSort] = useState<GetApiFeedSort>("new");
	const selectedPostKinds = controlledPostKinds ?? postKinds;
	const selectedSort = controlledSort ?? sort;

	return (
		<ApiFeedList
			contentKinds={selectedPostKinds}
			contentOptions={PostListContentKinds}
			infinite={infinite}
			onContentKindsChange={(nextPostKinds) => {
				if (controlledPostKinds === undefined) setPostKinds(nextPostKinds);
				onPostKindsChange?.(nextPostKinds);
			}}
			onSortChange={(nextSort) => {
				if (controlledSort === undefined) setSort(nextSort);
				onSortChange?.(nextSort);
			}}
			personalized={personalized}
			realmId={realmId}
			showBulkActions={false}
			sort={selectedSort}
			subjectId={subjectId}
		/>
	);
}

export function RelatedPostRecommendations({ postId }: { postId: string }) {
	const { t } = useTranslation(["feed"]);
	const { data: session } = useHydratedSession();
	const [hidden, setHidden] = useState<ReadonlySet<string>>(() => new Set());
	const query = useGetApiRecommendationsPostsByPostId({
		path: { postId },
		query: { limit: 4 },
	});
	if (query.isPending) return <RelatedFeedSkeleton />;
	if (query.isError || !query.data?.items.length) return null;
	const items = query.data.items.filter(({ id }) => !hidden.has(id));
	if (!items.length) return null;
	const setItemHidden = (id: string, value: boolean) =>
		setHidden((current) => {
			const next = new Set(current);
			if (value) next.add(id);
			else next.delete(id);
			return next;
		});

	return (
		<section aria-labelledby="related-posts-title" className="grid gap-3">
			<h2 className="font-heading font-bold text-xl" id="related-posts-title">
				{t.feed.relatedPosts}
			</h2>
			<FeedListItems aria-label={t.feed.relatedPosts}>
				{items.map((post) => (
					<FeedPostCard
						canExclude={Boolean(session)}
						key={post.id}
						onHiddenChange={(value) => setItemHidden(post.id, value)}
						post={post}
					/>
				))}
			</FeedListItems>
		</section>
	);
}

function RelatedFeedSkeleton() {
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
