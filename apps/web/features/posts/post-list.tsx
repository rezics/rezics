"use client";

import {
	getApiFeed,
	getApiFeedQueryKey,
	type GetApiFeedStatus200,
	useGetApiRecommendationsPostsByPostId,
	usePutApiRecommendationsExclusionsByUnitId,
} from "@rezics/openapi-tanstack-query";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowBigUp, Bookmark, Ellipsis, EyeOff, MessageCircle, Share2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import {
	Alert,
	AlertAction,
	AlertDescription,
	Avatar,
	AvatarFallback,
	Button,
	Card,
	CardContent,
	cn,
	Cover,
	Menu,
	MenuContent,
	MenuItem,
	MenuTrigger,
	PortableTextContent,
	Skeleton,
} from "@rezics/ui";
import { useRecommendationTracking } from "@/features/recommendations/tracking";
import { recommendationReasonLabel } from "@/features/recommendations/reason";
import { invalidateRecommendationQueries } from "@/features/recommendations/query";
import { useTranslation } from "@/i18n/client";
import { readPortableText } from "@/lib/block";
import { useHydratedSession } from "@/lib/use-hydrated-session";
import type { FeedContentKind } from "@/lib/search-params";
import { firstPublisher, PublisherLinks } from "./publisher-list";

type FeedSort = "best" | "hot" | "new" | "top" | "rising";
export type FeedPost = GetApiFeedStatus200["items"][number];

export function PostList({
	infinite = false,
	postKinds,
	realmId,
	sort = "new",
	personalized,
}: {
	infinite?: boolean;
	postKinds?: readonly FeedContentKind[];
	realmId?: string;
	sort?: FeedSort;
	personalized?: boolean;
}) {
	const { t } = useTranslation(["actions", "feed", "posts", "state"]);
	const { data: session } = useHydratedSession();
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
	const includedPostKinds = new Set<FeedContentKind>(postKinds ?? ["post", "reply"]);
	const items = query.data?.pages
		.flatMap((page) => page.items)
		.filter(({ id, postKind }) => !hidden.has(id) && includedPostKinds.has(postKind));
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
	if (query.isError && !query.data)
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
			<div className="grid min-h-56 place-items-center border-b border-border-weak p-8 text-center">
				<div>
					<p className="font-heading font-bold">{t.feed.emptyTitle}</p>
					<p className="text-muted-foreground mt-1 text-sm">{t.feed.emptyBody}</p>
				</div>
			</div>
		);
	return (
		<div
			className="divide-y divide-border-weak"
			data-content={postKinds?.join(",")}
			data-sort={sort}
			data-personalized={personalized}
		>
			{items.map((post) => (
				<PostListItem
					key={post.id}
					post={post}
					canExclude={Boolean(session)}
					onHiddenChange={(value) => setItemHidden(post.id, value)}
				/>
			))}
			{query.isFetchNextPageError ? (
				<Alert variant="destructive">
					<AlertDescription>{t.state.error}</AlertDescription>
					<AlertAction>
						<Button
							size="sm"
							variant="ghost"
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
						{query.isFetchingNextPage && (
							<span className="text-muted-foreground text-sm">
								{t.actions.loadMore}
							</span>
						)}
					</div>
				) : (
					<Button
						className="mx-auto mt-2 w-fit"
						isLoading={query.isFetchingNextPage}
						onClick={() => void query.fetchNextPage()}
						variant="outline"
					>
						{t.actions.loadMore}
					</Button>
				)
			) : null}
		</div>
	);
}

export function RelatedPostRecommendations({ postId }: { postId: string }) {
	const { t } = useTranslation(["actions", "feed", "posts", "state"]);
	const { data: session } = useHydratedSession();
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
		<Card className="rounded-none border-0 bg-background py-4 shadow-none [--space:--spacing(4)]">
			<CardContent className="grid grid-cols-[5rem_minmax(0,1fr)] gap-4 px-0 sm:grid-cols-[7.5rem_minmax(0,1fr)]">
				<Skeleton className="aspect-[3/4] w-full rounded-xl" />
				<div className="grid content-start gap-3">
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
	const { t } = useTranslation(["actions", "feed", "posts", "state"]);
	const primaryPublisher = firstPublisher(post.publishers);
	const initial = (primaryPublisher?.name ?? "R").slice(0, 1).toUpperCase();
	const { elementRef, trackOpen } = useRecommendationTracking(post.id, post.tracking);
	const queryClient = useQueryClient();
	const exclude = usePutApiRecommendationsExclusionsByUnitId({
		mutation: {
			onError: () => onHiddenChange?.(false),
			onSuccess: () => invalidateRecommendationQueries(queryClient),
		},
	});
	const reason = recommendationReasonLabel(post.recommendationReason, t.feed);
	const hasCover = Boolean(post.subject?.cover);
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
			className="group w-full min-w-0 rounded-none border-0 bg-background shadow-none [--space:--spacing(4)] transition-colors hover:bg-surface-hover focus-within:bg-surface-hover"
		>
			<article ref={elementRef}>
				<CardContent
					className={cn(
						"grid gap-4 px-1 py-6 sm:px-2",
						hasCover && "sm:grid-cols-[7.5rem_minmax(0,1fr)]",
					)}
				>
					{post.subject?.cover ? (
						<Link
							aria-label={post.subject.title ?? t.feed.relatedWork}
							className="block w-full max-w-72 sm:max-w-none"
							href={`/units/${post.subject.type}/${post.subject.id}`}
						>
							<Cover
								alt={post.subject.title ?? t.feed.relatedWork}
								className="rounded-xl border border-border-weak shadow-sm/5"
								sizes="(min-width: 640px) 120px, 72vw"
								src={post.subject.cover.url}
							/>
						</Link>
					) : null}
					<div className="min-w-0 flex-1">
						<div className="flex min-h-8 flex-wrap items-center gap-x-1.5 text-muted-foreground text-xs">
							{primaryPublisher ? (
								<Link
									className="me-1 grid size-7 shrink-0 place-items-center"
									href={`/users/${primaryPublisher.profileId}`}
								>
									<Avatar className="size-7">
										<AvatarFallback className="bg-accent text-accent-foreground text-[0.625rem]">
											{initial}
										</AvatarFallback>
									</Avatar>
								</Link>
							) : null}
							<PublisherLinks
								className="inline-flex min-h-6 items-center text-foreground font-semibold hover:underline"
								emptyLabel={t.posts.unknownPublisher}
								publishers={post.publishers}
							/>
							{post.postKind === "reply" ? <span>· {t.posts.replyPost}</span> : null}
							<span>·</span>
							<span>{formatRelativeTime(post.createdAt)}</span>
							{post.realmId && (
								<>
									<span>·</span>
									<Link
										className="inline-flex min-h-6 items-center text-foreground font-medium hover:underline"
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
											className="ms-auto size-11 sm:size-6"
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
							<p className="text-muted-foreground mt-1 text-xs font-medium">
								{reason}
							</p>
						)}
						{post.replyContext && (
							<Link
								className="text-muted-foreground mt-2 flex min-h-6 items-center truncate border-s-2 ps-2 text-xs hover:text-foreground"
								href={`/posts/${post.replyContext.rootPostId}`}
							>
								{t.feed.replyingIn} {post.replyContext.title ?? t.posts.untitled}
							</Link>
						)}
						<Link href={`/posts/${post.id}`} className="block" onClick={trackOpen}>
							<h2 className="font-heading mt-2 text-[1.05rem] font-black leading-snug">
								{post.postKind === "reply"
									? t.posts.replyPost
									: (post.title ?? t.posts.untitled)}
							</h2>
							<div className="prose prose-sm text-muted-foreground mt-2 max-w-none leading-6">
								<PortableTextContent
									value={readPortableText(post.body)}
									variant="preview"
								/>
							</div>
						</Link>
						{post.subject ? (
							<Link
								className="mt-3 block w-fit text-muted-foreground text-xs hover:text-foreground hover:underline"
								href={`/units/${post.subject.type}/${post.subject.id}`}
							>
								{t.feed.relatedWork}: {post.subject.title ?? t.actions.view}
							</Link>
						) : null}
						<div className="mt-3 flex items-center gap-1 pt-1 sm:gap-2">
							<Button
								className="min-h-11 rounded-lg text-xs sm:min-h-8"
								size="sm"
								variant="ghost"
							>
								<ArrowBigUp aria-hidden data-icon="inline-start" />
								{Number(post.reactions.upvote) - Number(post.reactions.downvote)}
							</Button>
							<Button
								asChild
								className="min-h-11 rounded-lg text-xs sm:min-h-8"
								size="sm"
								variant="ghost"
							>
								<Link href={`/posts/${post.id}`} onClick={trackOpen}>
									<MessageCircle aria-hidden data-icon="inline-start" />
									{post.replyCount}
								</Link>
							</Button>
							<Button
								aria-label="Save"
								className="ms-auto size-11 rounded-lg sm:size-8"
								size="icon-sm"
								variant="ghost"
							>
								<Bookmark aria-hidden />
							</Button>
							<Button
								aria-label="Share"
								className="size-11 rounded-lg sm:size-8"
								size="icon-sm"
								variant="ghost"
							>
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
