"use client";

import {
	getApiFeed,
	getApiFeedQueryKey,
	type GetApiFeedStatus200,
	useGetApiRecommendationsPostsByPostId,
	usePutApiRecommendationsExclusionsByUnitId,
} from "@rezics/openapi-tanstack-query";
import { PortableText } from "@portabletext/react";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import {
	ArrowBigUp,
	Bookmark,
	ChevronRight,
	Ellipsis,
	EyeOff,
	MessageCircle,
	Share2,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import {
	Alert,
	AlertAction,
	AlertDescription,
	Avatar,
	AvatarFallback,
	Badge,
	Button,
	Card,
	CardContent,
	Item,
	ItemContent,
	ItemDescription,
	ItemMedia,
	ItemTitle,
	Menu,
	MenuContent,
	MenuItem,
	MenuTrigger,
	Skeleton,
} from "@rezics/ui";
import { useRecommendationTracking } from "@/features/recommendations/tracking";
import { recommendationReasonLabel } from "@/features/recommendations/reason";
import { invalidateRecommendationQueries } from "@/features/recommendations/query";
import { useTranslation } from "@/i18n/client";
import { authClient } from "@/lib/auth-client";
import { toPortableTextForReact } from "@/lib/portable-text";

type FeedSort = "best" | "hot" | "new" | "top" | "rising";
export type FeedPost = GetApiFeedStatus200["items"][number];

export function PostList({
	realmId,
	sort = "new",
	personalized,
}: {
	realmId?: string;
	sort?: FeedSort;
	personalized?: boolean;
}) {
	const { t } = useTranslation({ suspense: true });
	const { data: session } = authClient.useSession();
	const [hidden, setHidden] = useState<ReadonlySet<string>>(() => new Set());
	const baseQuery = {
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
		initialPageParam: "",
		getNextPageParam: (page) => page.nextCursor ?? undefined,
	});
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
	if (query.isPending)
		return (
			<div className="grid gap-2 p-3 sm:p-4">
				{Array.from({ length: 4 }, (_, index) => (
					<FeedSkeleton key={index} />
				))}
			</div>
		);
	if (query.isError)
		return (
			<Alert className="m-3 sm:m-4" variant="destructive">
				<AlertDescription>{t.state.error}</AlertDescription>
				<AlertAction>
					<Button size="sm" variant="ghost" onClick={() => void query.refetch()}>
						{t.actions.retry}
					</Button>
				</AlertAction>
			</Alert>
		);
	if (!items?.length)
		return (
			<div className="grid min-h-56 place-items-center border-b p-8 text-center">
				<div>
					<p className="font-heading font-bold">{t.feed.emptyTitle}</p>
					<p className="text-muted-foreground mt-1 text-sm">{t.feed.emptyBody}</p>
				</div>
			</div>
		);
	return (
		<div className="grid gap-2 p-3 sm:p-4" data-sort={sort} data-personalized={personalized}>
			{items.map((post) => (
				<PostListItem
					key={post.id}
					post={post}
					canExclude={Boolean(session)}
					onHiddenChange={(value) => setItemHidden(post.id, value)}
				/>
			))}
			{query.hasNextPage && (
				<Button
					className="mx-auto mt-2 w-fit"
					isLoading={query.isFetchingNextPage}
					onClick={() => void query.fetchNextPage()}
					variant="outline"
				>
					{t.actions.loadMore}
				</Button>
			)}
		</div>
	);
}

export function RelatedPostRecommendations({ postId }: { postId: string }) {
	const { t } = useTranslation({ suspense: true });
	const { data: session } = authClient.useSession();
	const [hidden, setHidden] = useState<ReadonlySet<string>>(() => new Set());
	const query = useGetApiRecommendationsPostsByPostId({
		path: { postId },
		query: { limit: 4 },
	});
	if (query.isPending) return <FeedSkeleton />;
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
		<section className="grid gap-3" aria-labelledby="related-posts-title">
			<h2 id="related-posts-title" className="font-heading text-xl font-bold">
				{t.feed.relatedPosts}
			</h2>
			{items.map((post) => (
				<PostListItem
					key={post.id}
					post={post}
					canExclude={Boolean(session)}
					onHiddenChange={(value) => setItemHidden(post.id, value)}
				/>
			))}
		</section>
	);
}

function FeedSkeleton() {
	return (
		<Card className="[--space:--spacing(4)] sm:[--space:--spacing(5)]">
			<CardContent className="flex gap-3">
				<Skeleton className="size-9 shrink-0 rounded-full" />
				<div className="grid flex-1 gap-3">
					<Skeleton className="h-4 w-1/3" />
					<Skeleton className="h-5 w-2/3" />
					<Skeleton className="h-16 w-full" />
				</div>
			</CardContent>
		</Card>
	);
}

export function PostListItem({
	post,
	canExclude = false,
	onHiddenChange,
}: {
	post: FeedPost;
	canExclude?: boolean;
	onHiddenChange?: (hidden: boolean) => void;
}) {
	const { t } = useTranslation({ suspense: true });
	const initial = (post.authorName ?? "R").slice(0, 1).toUpperCase();
	const { elementRef, trackOpen } = useRecommendationTracking(post.id, post.tracking);
	const queryClient = useQueryClient();
	const exclude = usePutApiRecommendationsExclusionsByUnitId({
		mutation: {
			onError: () => onHiddenChange?.(false),
			onSuccess: () => invalidateRecommendationQueries(queryClient),
		},
	});
	const reason = recommendationReasonLabel(post.recommendationReason, t.feed);
	const markNotInterested = () => {
		onHiddenChange?.(true);
		exclude.mutate({
			path: { unitId: post.id },
			body: {
				eventId: crypto.randomUUID(),
				occurredAt: new Date().toISOString(),
				requestId: post.tracking.requestId,
				surface: post.tracking.surface,
				position: Number(post.tracking.position),
				policyVersion: post.tracking.policyVersion,
				signature: post.tracking.signature,
			},
		});
	};
	return (
		<Card
			asChild
			className="group [--space:--spacing(4)] [contain-intrinsic-size:auto_20rem] [content-visibility:auto] transition-colors hover:border-primary/25 sm:[--space:--spacing(5)]"
		>
			<article ref={elementRef}>
				<CardContent className="flex gap-3">
					<Link className="shrink-0" href={`/users/${post.authorId}`}>
						<Avatar className="size-9">
							<AvatarFallback className="bg-accent text-accent-foreground">
								{initial}
							</AvatarFallback>
						</Avatar>
					</Link>
					<div className="min-w-0 flex-1">
						<div className="text-muted-foreground flex flex-wrap items-center gap-x-1.5 text-xs">
							{post.postKind === "reply" && (
								<Badge variant="secondary">{t.posts.replyPost}</Badge>
							)}
							<Link
								className="text-foreground font-semibold hover:underline"
								href={`/users/${post.authorId}`}
							>
								{post.authorName ?? t.posts.unknownAuthor}
							</Link>
							<span>·</span>
							<span>{formatRelativeTime(post.createdAt)}</span>
							{post.realmId && (
								<>
									<span>·</span>
									<Link
										className="text-primary font-medium hover:underline"
										href={`/realms/${post.realmId}`}
									>
										r/community
									</Link>
								</>
							)}
							{canExclude && (
								<Menu>
									<MenuTrigger asChild>
										<Button
											aria-label={t.feed.recommendationMenu}
											className="ms-auto"
											pill
											size="icon-xs"
											variant="ghost"
										>
											<Ellipsis aria-hidden />
										</Button>
									</MenuTrigger>
									<MenuContent>
										<MenuItem
											disabled={exclude.isPending}
											onSelect={markNotInterested}
											value="not-interested"
										>
											<EyeOff aria-hidden />
											{t.feed.notInterested}
										</MenuItem>
									</MenuContent>
								</Menu>
							)}
						</div>
						{reason && (
							<p className="text-primary mt-1 text-xs font-medium">{reason}</p>
						)}
						{post.replyContext && (
							<Link
								className="text-muted-foreground mt-2 block truncate border-s-2 ps-2 text-xs hover:text-foreground"
								href={`/posts/${post.replyContext.rootPostId}`}
							>
								{t.feed.replyingIn} {post.replyContext.title ?? t.posts.untitled}
							</Link>
						)}
						<Link href={`/posts/${post.id}`} className="block" onClick={trackOpen}>
							<h2 className="font-heading mt-2 text-[1.05rem] font-black leading-snug group-hover:text-primary">
								{post.postKind === "reply"
									? t.posts.replyPost
									: (post.title ?? t.posts.untitled)}
							</h2>
							<div className="prose prose-sm text-muted-foreground mt-2 line-clamp-3 max-w-none leading-6">
								<PortableText value={toPortableTextForReact(post.body)} />
							</div>
						</Link>
						{post.subjectId && (
							<Item asChild className="mt-3" variant="muted">
								<Link
									href={`/units/${post.subject?.type ?? "book"}/${post.subjectId}`}
								>
									<ItemMedia
										className="bg-accent text-accent-foreground size-auto aspect-[2/3] w-9 overflow-hidden rounded text-xs font-black"
										variant="image"
									>
										{post.subject?.cover ? (
											<img
												alt=""
												src={post.subject.cover.url}
												style={{
													objectPosition: `${post.subject.cover.focalPoint.x * 100}% ${post.subject.cover.focalPoint.y * 100}%`,
												}}
											/>
										) : (
											"R"
										)}
									</ItemMedia>
									<ItemContent className="min-w-0">
										<ItemDescription className="text-[10px] font-semibold uppercase tracking-wider">
											{t.feed.relatedWork}
										</ItemDescription>
										<ItemTitle>
											{post.subject?.title ?? t.actions.view}
										</ItemTitle>
									</ItemContent>
									<ChevronRight
										aria-hidden
										className="text-muted-foreground size-4"
									/>
								</Link>
							</Item>
						)}
						<div className="mt-3 flex items-center justify-between gap-1 border-t pt-2">
							<Button className="text-xs" pill size="sm" variant="secondary">
								<ArrowBigUp aria-hidden data-icon="inline-start" />
								{Number(post.reactions.upvote) - Number(post.reactions.downvote)}
							</Button>
							<Button asChild className="text-xs" pill size="sm" variant="ghost">
								<Link href={`/posts/${post.id}`} onClick={trackOpen}>
									<MessageCircle aria-hidden data-icon="inline-start" />
									{post.replyCount}
								</Link>
							</Button>
							<Button aria-label="Save" pill size="icon-sm" variant="ghost">
								<Bookmark aria-hidden />
							</Button>
							<Button aria-label="Share" pill size="icon-sm" variant="ghost">
								<Share2 aria-hidden />
							</Button>
						</div>
					</div>
				</CardContent>
			</article>
		</Card>
	);
}

function formatRelativeTime(value: string | Date) {
	const elapsed = Date.now() - new Date(value).getTime();
	const minutes = Math.max(1, Math.floor(elapsed / 60_000));
	if (minutes < 60) return `${minutes}m`;
	const hours = Math.floor(minutes / 60);
	if (hours < 24) return `${hours}h`;
	return `${Math.floor(hours / 24)}d`;
}
