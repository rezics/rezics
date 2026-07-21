"use client";

import {
	type GetApiFeedStatus200,
	usePutApiRecommendationsExclusionsByUnitId,
} from "@rezics/openapi-tanstack-query";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowBigUp, Bookmark, Ellipsis, EyeOff, MessageCircle, Share2 } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import {
	Avatar,
	AvatarFallback,
	Button,
	CardContent,
	cn,
	Cover,
	Menu,
	MenuContent,
	MenuItem,
	MenuTrigger,
	PortableTextContent,
} from "@rezics/ui";
import {
	firstPublisher,
	PublisherLinks,
	type PublisherSummary,
} from "@/features/posts/publisher-list";
import { postHref } from "@/features/posts/url";
import { profileHref } from "@/features/profiles/profile-route";
import { invalidateRecommendationQueries } from "@/features/recommendations/query";
import { recommendationReasonLabel } from "@/features/recommendations/reason";
import { useRecommendationTracking } from "@/features/recommendations/tracking";
import { useTranslation } from "@/i18n/client";
import { readPortableText } from "@/lib/block";
import { FeedCard } from "./feed-card";

export type FeedItem = GetApiFeedStatus200["items"][number];
export type FeedPost = Extract<FeedItem, { itemType: "post" }>;
export type FeedUnit = Extract<FeedItem, { itemType: "unit" }>;

export function FeedItemCard({
	canExclude = false,
	item,
	onHiddenChange,
	requestedRealmId,
}: {
	canExclude?: boolean;
	item: FeedItem;
	onHiddenChange?: (hidden: boolean) => void;
	requestedRealmId?: string;
}) {
	return item.itemType === "post" ? (
		<FeedPostCard
			canExclude={canExclude}
			onHiddenChange={onHiddenChange}
			post={item}
			requestedRealmId={requestedRealmId}
		/>
	) : (
		<FeedUnitCard canExclude={canExclude} onHiddenChange={onHiddenChange} unit={item} />
	);
}

export function FeedPostCard({
	post,
	requestedRealmId,
	canExclude = false,
	onHiddenChange,
}: {
	post: FeedPost;
	requestedRealmId?: string;
	canExclude?: boolean;
	onHiddenChange?: (hidden: boolean) => void;
}) {
	const { t, locale } = useTranslation(["actions", "brand", "feed", "posts", "state", "ui"]);
	const primaryPublisher = firstPublisher(post.publishers);
	const initial = (primaryPublisher?.name ?? t.brand.name).slice(0, 1).toUpperCase();
	const { elementRef, trackOpen } = useRecommendationTracking(post.id, post.tracking);
	const reason = recommendationReasonLabel(post.recommendationReason, t.feed);
	const realmId = requestedRealmId ?? post.realmId ?? undefined;
	const href = feedPostHref(post, realmId);
	const subjectHref = post.subject ? unitHref(post.subject.type, post.subject.id) : undefined;
	const title = post.postKind === "reply" ? t.posts.replyPost : (post.title ?? t.posts.untitled);

	return (
		<FeedCard aria-labelledby={`feed-item-${post.id}`} ref={elementRef}>
			<CardContent className="grid gap-4 px-4 py-5 sm:px-5">
				<div className="min-w-0 flex-1">
					<FeedItemMeta
						canExclude={canExclude}
						initial={initial}
						item={post}
						onHiddenChange={onHiddenChange}
						publisher={primaryPublisher}
						timestamp={formatRelativeTime(post.createdAt, locale.target)}
					/>
					{reason ? (
						<p className="mt-1 text-muted-foreground text-xs font-medium">{reason}</p>
					) : null}
					{post.replyContext ? (
						<Link
							className="mt-2 flex min-h-6 items-center truncate border-s-2 ps-2 text-muted-foreground text-xs hover:text-foreground"
							href={postHref(post.replyContext.rootPostId, realmId)}
						>
							{t.feed.replyingIn} {post.replyContext.title ?? t.posts.untitled}
						</Link>
					) : null}
					<FeedItemMain href={href} onOpen={trackOpen}>
						<h2
							className="mt-2 font-heading font-black text-[1.05rem] leading-snug"
							id={`feed-item-${post.id}`}
						>
							{title}
						</h2>
						{post.body ? (
							<div className="prose prose-sm mt-2 max-w-none text-muted-foreground leading-6">
								<PortableTextContent
									value={readPortableText(post.body)}
									variant="preview"
								/>
							</div>
						) : post.summary ? (
							<p className="mt-2 text-muted-foreground text-sm leading-6">
								{post.summary}
							</p>
						) : null}
					</FeedItemMain>
					{post.subject && subjectHref ? (
						<Link
							className="mt-3 flex w-fit max-w-full items-center gap-2 text-muted-foreground text-xs hover:text-foreground hover:underline"
							href={subjectHref}
						>
							{post.subject.cover ? (
								<Cover
									alt=""
									className="aspect-[3/4] w-8 rounded"
									src={post.subject.cover.url}
								/>
							) : null}
							<span className="truncate">
								{t.feed.relatedWork}: {post.subject.title ?? t.actions.view}
							</span>
						</Link>
					) : null}
					<FeedItemActions href={href} item={post} onOpen={trackOpen} />
				</div>
			</CardContent>
		</FeedCard>
	);
}

function FeedUnitCard({
	unit,
	canExclude,
	onHiddenChange,
}: {
	unit: FeedUnit;
	canExclude: boolean;
	onHiddenChange?: (hidden: boolean) => void;
}) {
	const { t, locale } = useTranslation(["brand", "feed", "posts", "ui"]);
	const primaryPublisher = firstPublisher(unit.publishers);
	const initial = (primaryPublisher?.name ?? t.brand.name).slice(0, 1).toUpperCase();
	const { elementRef, trackOpen } = useRecommendationTracking(unit.id, unit.tracking);
	const reason = recommendationReasonLabel(unit.recommendationReason, t.feed);
	const href = unitHref(unit.unitKind, unit.id);
	const title = unit.title ?? t.ui.unnamed;

	return (
		<FeedCard aria-labelledby={`feed-item-${unit.id}`} ref={elementRef}>
			<CardContent
				className={cn(
					"grid gap-4 px-4 py-5 sm:px-5",
					unit.cover &&
						"grid-cols-[5rem_minmax(0,1fr)] sm:grid-cols-[7.5rem_minmax(0,1fr)]",
				)}
			>
				{unit.cover ? (
					<FeedItemMain className="block" href={href} onOpen={trackOpen}>
						<Cover
							alt={title}
							className="rounded-xl border border-border-weak shadow-sm/5"
							sizes="(min-width: 640px) 120px, 80px"
							src={unit.cover.url}
						/>
					</FeedItemMain>
				) : null}
				<div className="min-w-0">
					<FeedItemMeta
						canExclude={canExclude}
						initial={initial}
						item={unit}
						onHiddenChange={onHiddenChange}
						publisher={primaryPublisher}
						timestamp={formatRelativeTime(unit.createdAt, locale.target)}
					/>
					<p className="mt-2 font-semibold text-brand text-xs">
						{t.feed.content.kinds[`unit:${unit.unitKind}`]}
					</p>
					{reason ? (
						<p className="mt-1 text-muted-foreground text-xs font-medium">{reason}</p>
					) : null}
					<FeedItemMain href={href} onOpen={trackOpen}>
						<h2
							className="mt-1 font-heading font-black text-[1.05rem] leading-snug"
							id={`feed-item-${unit.id}`}
						>
							{title}
						</h2>
						{unit.summary ? (
							<p className="mt-2 line-clamp-3 text-muted-foreground text-sm leading-6">
								{unit.summary}
							</p>
						) : null}
					</FeedItemMain>
					<FeedItemActions href={href} item={unit} onOpen={trackOpen} />
				</div>
			</CardContent>
		</FeedCard>
	);
}

function FeedItemMeta({
	canExclude,
	initial,
	item,
	onHiddenChange,
	publisher,
	timestamp,
}: {
	canExclude: boolean;
	initial: string;
	item: FeedItem;
	onHiddenChange?: (hidden: boolean) => void;
	publisher?: PublisherSummary;
	timestamp: string;
}) {
	const { t } = useTranslation(["feed", "posts"]);
	const queryClient = useQueryClient();
	const exclude = usePutApiRecommendationsExclusionsByUnitId({
		mutation: {
			onError: () => onHiddenChange?.(false),
			onSuccess: () => invalidateRecommendationQueries(queryClient),
		},
	});
	const markNotInterested = () => {
		onHiddenChange?.(true);
		exclude.mutate({
			path: { unitId: item.id },
			body: {
				eventId: crypto.randomUUID(),
				occurredAt: new Date().toISOString(),
				requestId: item.tracking.requestId,
				surface: item.tracking.surface,
				position: Number(item.tracking.position),
				policyVersion: item.tracking.policyVersion,
				signature: item.tracking.signature,
			},
		});
	};

	return (
		<div className="flex min-h-8 flex-wrap items-center gap-x-1.5 text-muted-foreground text-xs">
			{publisher ? (
				<Link
					className="me-1 grid size-7 shrink-0 place-items-center"
					href={profileHref({
						id: publisher.profileId,
						slugAddress: publisher.slugAddress,
					})}
				>
					<Avatar className="size-7">
						<AvatarFallback className="bg-accent text-accent-foreground text-[0.625rem]">
							{initial}
						</AvatarFallback>
					</Avatar>
				</Link>
			) : null}
			<PublisherLinks
				className="inline-flex min-h-6 items-center font-semibold text-foreground hover:underline"
				emptyLabel={t.posts.unknownPublisher}
				publishers={item.publishers}
			/>
			{item.itemType === "post" ? (
				<>
					<span>·</span>
					<span>{t.feed.content.kinds[`post:${item.postKind}`]}</span>
				</>
			) : null}
			<span>·</span>
			<span>{timestamp}</span>
			{canExclude ? (
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
			) : null}
		</div>
	);
}

function FeedItemMain({
	children,
	className,
	href,
	onOpen,
}: {
	children: ReactNode;
	className?: string;
	href?: string;
	onOpen: () => void;
}) {
	return href ? (
		<Link className={cn("block", className)} href={href} onClick={onOpen}>
			{children}
		</Link>
	) : (
		<div className={className}>{children}</div>
	);
}

function FeedItemActions({
	href,
	item,
	onOpen,
}: {
	href?: string;
	item: FeedItem;
	onOpen: () => void;
}) {
	const { t } = useTranslation(["ui"]);
	return (
		<div className="mt-3 flex items-center gap-1 pt-1 sm:gap-2">
			<Button className="min-h-11 rounded-lg text-xs sm:min-h-8" size="sm" variant="ghost">
				<ArrowBigUp aria-hidden data-icon="inline-start" />
				{Number(item.reactions.upvote) - Number(item.reactions.downvote)}
			</Button>
			{item.itemType === "post" && href ? (
				<Button
					asChild
					className="min-h-11 rounded-lg text-xs sm:min-h-8"
					size="sm"
					variant="ghost"
				>
					<Link href={href} onClick={onOpen}>
						<MessageCircle aria-hidden data-icon="inline-start" />
						{item.replyCount}
					</Link>
				</Button>
			) : null}
			<Button
				aria-label={t.ui.save}
				className="ms-auto size-11 rounded-lg sm:size-8"
				size="icon-sm"
				variant="ghost"
			>
				<Bookmark aria-hidden />
			</Button>
			<Button
				aria-label={t.ui.share}
				className="size-11 rounded-lg sm:size-8"
				size="icon-sm"
				variant="ghost"
			>
				<Share2 aria-hidden />
			</Button>
		</div>
	);
}

function feedPostHref(post: FeedPost, realmId?: string): string | undefined {
	if (post.postKind === "post" || post.postKind === "reply") return postHref(post.id, realmId);
	if (post.postKind === "review") return `/reviews/${post.id}`;
	return undefined;
}

function unitHref(kind: string, id: string): string | undefined {
	switch (kind) {
		case "profile":
			return profileHref(id);
		case "book":
		case "software":
		case "media":
			return `/units/${kind}/${id}`;
		case "entity":
			return `/entities/${id}`;
		case "zone":
			return `/zones/${id}`;
		case "collection":
			return `/collections/${id}`;
		case "poll":
			return `/polls/${id}`;
		case "realm":
			return `/realms/${id}`;
		default:
			return undefined;
	}
}

function formatRelativeTime(value: string | Date, locale: string) {
	const elapsed = Date.now() - new Date(value).getTime();
	const minutes = Math.max(1, Math.floor(elapsed / 60_000));
	const formatter = new Intl.RelativeTimeFormat(locale, { numeric: "always", style: "narrow" });
	if (minutes < 60) return formatter.format(-minutes, "minute");
	const hours = Math.floor(minutes / 60);
	if (hours < 24) return formatter.format(-hours, "hour");
	return formatter.format(-Math.floor(hours / 24), "day");
}
