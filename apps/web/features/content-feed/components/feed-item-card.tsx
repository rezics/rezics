"use client";

import {
	type GetApiFeedStatus200,
	usePutApiRecommendationsExclusionsByUnitId,
} from "@rezics/openapi-tanstack-query";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import type { ReactNode } from "react";

import { Badge, CardContent, cn, Cover, PortableTextContent } from "@rezics/ui";
import { postHref } from "@/features/posts/url";
import { realmHref } from "@/features/slugs/unit-route";
import { publicUnitHref } from "@/features/units/routing/public-unit-route";
import { invalidateRecommendationQueries } from "@/features/recommendations/query";
import { recommendationReasonLabel } from "@/features/recommendations/reason";
import { useRecommendationTracking } from "@/features/recommendations/tracking";
import { useTranslation } from "@/i18n/client";
import { toNonNegativeApiInteger } from "@/lib/api-number";
import { readPortableText } from "@/lib/block";
import { getFeedActionPolicy } from "../model/feed-action-policy";
import {
	FeedCard,
	FeedCardContent,
	FeedCardHeader,
	FeedCardTarget,
	type FeedAttributionContext,
	type FeedRealmContext,
} from "./feed-card";
import { FeedEngagementBar, FeedOverflowMenu } from "./feed-card-actions";
import { parseFeedReaction } from "../model/feed-reaction";
import { formatRelativeTime } from "../model/format-relative-time";

export type FeedItem = GetApiFeedStatus200["items"][number];
export type FeedPost = Extract<FeedItem, { itemType: "post" }>;
export type FeedUnit = Extract<FeedItem, { itemType: "unit" }>;
type FeedReviewScore = {
	readonly scoreId: string;
	readonly contextUnitId: string;
	readonly value: string | number;
};
type PresentableFeedItem = FeedItem & {
	readonly scores?: readonly FeedReviewScore[];
};
type PresentableFeedPost = FeedPost & {
	readonly scores?: readonly FeedReviewScore[];
};

export function FeedItemCard({
	canExclude = false,
	item,
	onHiddenChange,
	position,
	requestedRealmId,
	setSize,
}: {
	canExclude?: boolean;
	item: PresentableFeedItem;
	onHiddenChange?: (hidden: boolean) => void;
	position?: number;
	requestedRealmId?: string;
	setSize?: number;
}) {
	return item.itemType === "post" ? (
		<FeedPostCard
			canExclude={canExclude}
			onHiddenChange={onHiddenChange}
			post={item}
			position={position}
			requestedRealmId={requestedRealmId}
			setSize={setSize}
		/>
	) : (
		<FeedUnitCard
			canExclude={canExclude}
			onHiddenChange={onHiddenChange}
			position={position}
			setSize={setSize}
			unit={item}
		/>
	);
}

export function FeedPostCard({
	post,
	requestedRealmId,
	canExclude = false,
	onHiddenChange,
	position,
	setSize,
}: {
	post: PresentableFeedPost;
	requestedRealmId?: string;
	canExclude?: boolean;
	onHiddenChange?: (hidden: boolean) => void;
	position?: number;
	setSize?: number;
}) {
	const { t, locale } = useTranslation(["actions", "engagement", "feed", "posts", "state", "ui"]);
	const { elementRef, trackOpen } = useRecommendationTracking(post.id, post.tracking);
	const reason = recommendationReasonLabel(post.recommendationReason, t.feed);
	const realmId = requestedRealmId ?? post.realmId ?? undefined;
	const href = feedPostHref(post, realmId);
	const subjectHref = post.subject ? unitHref(post.subject.type, post.subject.id) : undefined;
	const excerptSource =
		post.postKind === "excerpt" && post.subject && subjectHref
			? {
					href: subjectHref,
					title: post.subject.title ?? t.actions.view,
				}
			: undefined;
	const title = post.postKind === "reply" ? t.posts.replyPost : (post.title ?? t.posts.untitled);
	const attributions = toFeedAttributionContexts(post.attributions, t.posts.unknownAttribution);
	const realms = toFeedRealmContexts(post.realms, t.ui.unnamed);

	return (
		<FeedCard
			aria-labelledby={`feed-item-${post.id}`}
			aria-posinset={position}
			aria-setsize={setSize}
			ref={elementRef}
		>
			<FeedCardHeader
				menu={
					<FeedItemOverflowMenu
						canExclude={canExclude}
						item={post}
						onHiddenChange={onHiddenChange}
					/>
				}
				attributions={attributions}
				realms={realms}
				recommendation={reason}
				timestamp={formatRelativeTime(post.createdAt, locale.target)}
			/>
			<FeedCardContent>
				<Badge className="w-fit" size="sm" variant="outline">
					{t.feed.content.kinds[`post:${post.postKind}`]}
				</Badge>
				{post.postKind === "review" && post.scores?.length ? (
					<p className="font-medium text-sm">
						{post.scores
							.map(({ value }) =>
								t.engagement.scoreOutOfTen({ score: String(value) }),
							)
							.join(" · ")}
					</p>
				) : null}
				{post.replyContext ? (
					<Link
						className="flex min-h-6 items-center truncate border-s-2 ps-2 text-muted-foreground text-xs hover:text-foreground"
						href={postHref(post.replyContext.rootPostId, realmId)}
					>
						{t.feed.replyingIn} {post.replyContext.title ?? t.posts.untitled}
					</Link>
				) : null}
				<FeedItemMain href={href} onOpen={trackOpen}>
					<h2
						className="font-heading font-black text-[1.05rem] leading-snug"
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
				{excerptSource ? (
					<p
						aria-label={t.feed.excerptSource}
						className="mt-2 text-muted-foreground text-sm leading-6"
					>
						<span aria-hidden>{t.feed.excerptSourceMark} </span>
						<cite className="not-italic">
							<Link
								className="font-bold text-foreground underline-offset-4 hover:underline"
								href={excerptSource.href}
							>
								{excerptSource.title}
							</Link>
						</cite>
					</p>
				) : null}
			</FeedCardContent>
			{post.postKind !== "excerpt" && post.subject && subjectHref ? (
				<FeedCardTarget
					{...(post.subject.summary ? { description: post.subject.summary } : {})}
					{...(post.subject.cover ? { imageUrl: post.subject.cover.url } : {})}
					{...(post.subject.score
						? {
								score: {
									totalCount: Number(post.subject.score.totalCount),
									totalScore: Number(post.subject.score.totalScore),
								},
							}
						: {})}
					href={subjectHref}
					imageAlt={post.subject.title ?? t.actions.view}
					label={t.feed.relatedWork}
					title={post.subject.title ?? t.actions.view}
				/>
			) : null}
			<CardContent className="px-4 pb-4 sm:px-5">
				<FeedItemActions href={href} item={post} onOpen={trackOpen} />
			</CardContent>
		</FeedCard>
	);
}

function FeedUnitCard({
	unit,
	canExclude,
	onHiddenChange,
	position,
	setSize,
}: {
	unit: FeedUnit;
	canExclude: boolean;
	onHiddenChange?: (hidden: boolean) => void;
	position?: number;
	setSize?: number;
}) {
	const { t, locale } = useTranslation(["feed", "posts", "ui"]);
	const { elementRef, trackOpen } = useRecommendationTracking(unit.id, unit.tracking);
	const reason = recommendationReasonLabel(unit.recommendationReason, t.feed);
	const href = unitHref(unit.unitKind, unit.id);
	const title = unit.title ?? t.ui.unnamed;
	const attributions = toFeedAttributionContexts(unit.attributions, t.posts.unknownAttribution);
	const realms = toFeedRealmContexts(unit.realms, t.ui.unnamed);

	return (
		<FeedCard
			aria-labelledby={`feed-item-${unit.id}`}
			aria-posinset={position}
			aria-setsize={setSize}
			ref={elementRef}
		>
			<FeedCardHeader
				menu={
					<FeedItemOverflowMenu
						canExclude={canExclude}
						item={unit}
						onHiddenChange={onHiddenChange}
					/>
				}
				attributions={attributions}
				realms={realms}
				recommendation={reason}
				timestamp={formatRelativeTime(unit.createdAt, locale.target)}
			/>
			<CardContent
				className={cn(
					"grid gap-4 px-4 pb-4 pt-3 sm:px-5",
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
					<p className="font-semibold text-brand text-xs">
						{t.feed.content.kinds[`unit:${unit.unitKind}`]}
					</p>
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
						{unit.collection ? (
							<p className="mt-2 text-xs font-medium text-muted-foreground">
								{t.feed.collectionDirectItems({
									count: toNonNegativeApiInteger(unit.collection.directItemCount),
								})}
							</p>
						) : null}
					</FeedItemMain>
					<FeedItemActions href={href} item={unit} onOpen={trackOpen} />
				</div>
			</CardContent>
		</FeedCard>
	);
}

function FeedItemOverflowMenu({
	canExclude,
	item,
	onHiddenChange,
}: {
	canExclude: boolean;
	item: FeedItem;
	onHiddenChange?: (hidden: boolean) => void;
}) {
	const queryClient = useQueryClient();
	const exclude = usePutApiRecommendationsExclusionsByUnitId({
		mutation: {
			onError: () => onHiddenChange?.(false),
			onSuccess: () => invalidateRecommendationQueries(queryClient),
		},
	});
	const markNotInterested = () => {
		if (!item.tracking) return;
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
		<FeedOverflowMenu
			canExclude={canExclude && Boolean(item.tracking) && !exclude.isPending}
			itemId={item.id}
			onNotInterested={markNotInterested}
		/>
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
	const policy = getFeedActionPolicy(
		item.itemType === "post"
			? { itemType: "post", postKind: item.postKind }
			: { itemType: "unit", unitKind: item.unitKind },
	);
	return (
		<FeedEngagementBar
			href={href}
			initialReaction={parseFeedReaction(item.viewerReaction)}
			itemId={item.id}
			onCommentsClick={onOpen}
			policy={policy}
			realmId={item.realmId ?? undefined}
			replyCount={item.itemType === "post" ? Number(item.replyCount) : 0}
			score={Number(item.reactions.upvote) - Number(item.reactions.downvote)}
		/>
	);
}

function toFeedAttributionContexts(
	attributions: FeedItem["attributions"],
	unknownAttribution: string,
): FeedAttributionContext[] {
	return attributions.map((attribution) => {
		const creditedUnit = attribution.creditedUnit;
		const name = creditedUnit.title ?? unknownAttribution;
		const href = publicUnitHref(creditedUnit.kind, creditedUnit);
		return {
			id: attribution.id,
			kind: creditedUnit.kind,
			role: attribution.role,
			...(href ? { href } : {}),
			initials: contextInitials(name),
			name,
			...(creditedUnit.avatar ? { avatar: creditedUnit.avatar } : {}),
			...(creditedUnit.slugAddress ? { slug: creditedUnit.slugAddress.slug } : {}),
			...(creditedUnit.summary ? { summary: creditedUnit.summary } : {}),
		};
	});
}

function toFeedRealmContexts(realms: FeedItem["realms"], unnamedRealm: string): FeedRealmContext[] {
	return realms.map((realm) => {
		const name = realm.title ?? unnamedRealm;
		return {
			id: realm.id,
			href: realmHref({ id: realm.id, slugAddress: realm.slugAddress }),
			initials: contextInitials(name),
			name,
			...(realm.avatar ? { avatar: realm.avatar } : {}),
			...(realm.slugAddress ? { slug: realm.slugAddress.slug } : {}),
			...(realm.summary ? { summary: realm.summary } : {}),
		};
	});
}

function contextInitials(name: string): string {
	return Array.from(name.trim())[0]?.toLocaleUpperCase() ?? name;
}

function feedPostHref(post: FeedPost, realmId?: string): string | undefined {
	if (post.postKind === "post" || post.postKind === "reply") return postHref(post.id, realmId);
	if (post.postKind === "review") return `/reviews/${post.id}`;
	return undefined;
}

function unitHref(kind: string, id: string): string | undefined {
	return publicUnitHref(kind, { id });
}
