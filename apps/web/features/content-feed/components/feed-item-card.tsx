"use client";

import {
	type PostApiFeedQueryStatus200,
	usePutApiRecommendationsExclusionsByUnitId,
} from "@rezics/openapi-tanstack-query";
import { useQueryClient } from "@tanstack/react-query";
import { AppLink as Link } from "@/features/application-shell/components/app-link";
import type { ReactNode } from "react";

import { CardContent, cn, IdentityAvatar } from "@rezics/ui";
import { LocalizedPortableTextContent } from "@/features/content-language-display/localized-portable-text-content";
import { useChineseContentText } from "@/features/content-language-display/chinese-content-display-context";
import { ContentLanguageVersionMenu } from "@/features/content-languages/components/content-language-version-menu";
import { withContentLanguage } from "@/features/content-languages/routing/content-language-route";
import { resolvePostPresentationTitle } from "@/features/posts/model/post-presentation-title";
import { postHref, type PostInteractionContext } from "@/features/posts/url";
import { apiValueToUnitScore } from "@/features/reviews/model/score-value";
import { realmHref } from "@/features/slugs/unit-route";
import { publicUnitHref } from "@/features/units/routing/public-unit-route";
import { UnitCoverFallback } from "@/features/units/components/unit-cover-fallback";
import { invalidateRecommendationQueries } from "@/features/recommendations/query";
import { recommendationReasonLabel } from "@/features/recommendations/reason";
import { useRecommendationTracking } from "@/features/recommendations/tracking";
import { useTranslation } from "@/i18n/client";
import { toNonNegativeApiInteger } from "@/lib/api-number";
import { readPortableText } from "@/lib/block";
import { getFeedActionPolicy } from "../model/feed-action-policy";
import { feedUnitDiscussionHref } from "../model/feed-discussion-route";
import {
	FeedCard,
	FeedCardContent,
	FeedCardHeader,
	FeedCardRating,
	FeedCardTarget,
	type FeedAttributionContext,
	type FeedRealmContext,
	type FeedTargetRating,
	type FeedTargetScore,
} from "./feed-card";
import { FeedEngagementBar, FeedOverflowMenu } from "./feed-card-actions";
import { FeedUnitContent } from "./feed-unit-content";
import {
	isCurrentFeedSubject,
	type FeedDisplayContext,
	UnscopedFeedDisplayContext,
} from "../model/feed-display-context";
import { parseFeedReaction } from "../model/feed-reaction";
import { selectFeedRating, type FeedRatingAggregate } from "../model/feed-rating";
import { formatRelativeTime } from "../model/format-relative-time";

export type FeedItem = PostApiFeedQueryStatus200["items"][number];
export type FeedPost = Extract<FeedItem, { itemType: "post" }>;
export type FeedUnit = Extract<FeedItem, { itemType: "unit" }>;

export function FeedItemCard({
	canExclude = false,
	displayContext = UnscopedFeedDisplayContext,
	item,
	onHiddenChange,
	overflowActions,
	postContext,
	position,
	preserveDisplayedLanguage = false,
	requestedRealmId,
	setSize,
}: {
	canExclude?: boolean;
	displayContext?: FeedDisplayContext;
	item: FeedItem;
	onHiddenChange?: (hidden: boolean) => void;
	overflowActions?: ReactNode;
	postContext?: PostInteractionContext;
	position?: number;
	preserveDisplayedLanguage?: boolean;
	requestedRealmId?: string;
	setSize?: number;
}) {
	return item.itemType === "post" ? (
		<FeedPostCard
			canExclude={canExclude}
			displayContext={displayContext}
			onHiddenChange={onHiddenChange}
			overflowActions={overflowActions}
			post={item}
			postContext={postContext}
			position={position}
			preserveDisplayedLanguage={preserveDisplayedLanguage}
			requestedRealmId={requestedRealmId}
			setSize={setSize}
		/>
	) : (
		<FeedUnitCard
			canExclude={canExclude}
			onHiddenChange={onHiddenChange}
			overflowActions={overflowActions}
			position={position}
			preserveDisplayedLanguage={preserveDisplayedLanguage}
			setSize={setSize}
			unit={item}
		/>
	);
}

export function FeedPostCard({
	post,
	requestedRealmId,
	canExclude = false,
	displayContext = UnscopedFeedDisplayContext,
	onHiddenChange,
	overflowActions,
	postContext,
	position,
	preserveDisplayedLanguage = false,
	setSize,
}: {
	post: FeedPost;
	requestedRealmId?: string;
	canExclude?: boolean;
	displayContext?: FeedDisplayContext;
	onHiddenChange?: (hidden: boolean) => void;
	overflowActions?: ReactNode;
	postContext?: PostInteractionContext;
	position?: number;
	preserveDisplayedLanguage?: boolean;
	setSize?: number;
}) {
	const { t, locale } = useTranslation(["actions", "feed", "posts", "state", "ui"]);
	const { elementRef, trackOpen } = useRecommendationTracking(post.id, post.tracking);
	const reason = recommendationReasonLabel(post.recommendationReason, t.feed);
	const realmId = requestedRealmId ?? post.realmId ?? undefined;
	const context = postContext ?? (realmId ? { kind: "realm" as const, realmId } : undefined);
	const baseHref = postHref(post.id, context);
	const href =
		preserveDisplayedLanguage && post.language
			? withContentLanguage(baseHref, post.language)
			: baseHref;
	const subjectHref = post.subject ? unitHref(post.subject.type, post.subject.id) : undefined;
	const subjectTitle = useChineseContentText(
		post.subject?.title ?? t.actions.view,
		post.subject?.language,
	);
	const subjectSummary = useChineseContentText(post.subject?.summary ?? "", post.subject?.language);
	const excerptSource =
		post.postKind === "excerpt" && post.subject && subjectHref
			? {
					href: subjectHref,
					title: subjectTitle,
				}
			: undefined;
	const titleMessages = {
		postBy: t.posts.postFallbackTitle,
		reviewOf: t.posts.reviewFallbackTitle,
		reply: t.posts.replyPost,
		unknownAttribution: t.posts.unknownAttribution,
		unnamedSubject: t.ui.unnamed,
		untitled: t.posts.untitled,
	};
	const title = resolvePostPresentationTitle(post, titleMessages);
	const displayedTitle = useChineseContentText(title.value, title.language);
	const displayedSummary = useChineseContentText(post.summary ?? "", post.language);
	const attributions = toFeedAttributionContexts(post.attributions, t.posts.unknownAttribution);
	const realms = toFeedRealmContexts(post.realms, t.ui.unnamed);
	const attachedScore = post.postKind === "review" ? post.scores[0] : undefined;
	const attachedScoreValue = attachedScore ? apiValueToUnitScore(attachedScore.value) : undefined;
	const attachedRating: FeedTargetRating | undefined =
		attachedScore && attachedScoreValue
			? {
					kind: "attached",
					realmLabel: attachedScore.realmTitle ?? attachedScore.realmId,
					value: attachedScoreValue,
				}
			: undefined;
	const subjectRating: FeedTargetRating | undefined =
		post.subject && isRatedWorkKind(post.subject.type)
			? attachedRating
				? attachedRating
				: {
						kind: "aggregate",
						score: toFeedTargetScore(selectFeedRating(post.subject.scores), t.ui.unnamed),
					}
			: undefined;
	const subjectIsCurrentUnit = isCurrentFeedSubject(displayContext, post.subject?.id);
	const realmTagContext = post.postKind === "wiki" ? post.realmTagContext : null;
	const realmTagTitle = useChineseContentText(
		realmTagContext?.tag.title ?? t.ui.unnamed,
		realmTagContext?.tag.language,
	);

	return (
		<FeedCard
			aria-labelledby={`feed-item-${post.id}`}
			aria-posinset={position}
			aria-setsize={setSize}
			ref={elementRef}
		>
			<FeedCardHeader
				attributions={attributions}
				realms={realms}
				recommendation={reason}
				timestamp={formatRelativeTime(post.createdAt, locale.target)}
			/>
			<FeedCardContent>
				<div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
					<p className="font-semibold text-brand text-xs">
						{t.feed.content.kinds[`post:${post.postKind}`]}
					</p>
					{subjectIsCurrentUnit && attachedRating ? (
						<FeedCardRating className="mt-0" rating={attachedRating} />
					) : null}
				</div>
				{post.replyContext ? (
					<Link
						className="flex min-h-6 items-center truncate border-s-2 ps-2 text-muted-foreground text-xs hover:text-foreground"
						href={postHref(post.replyContext.rootPostId, context)}
					>
						{t.feed.replyingIn}{" "}
						{
							resolvePostPresentationTitle(
								{
									...post.replyContext,
									postKind: "post",
								},
								titleMessages,
							).value
						}
					</Link>
				) : null}
				<FeedItemMain href={href} onOpen={trackOpen}>
					<h2
						className="font-heading font-black text-[1.05rem] leading-snug"
						id={`feed-item-${post.id}`}
					>
						{displayedTitle}
					</h2>
					{post.summary ? (
						<p className="mt-2 text-muted-foreground text-sm leading-6">{displayedSummary}</p>
					) : post.body ? (
						<div className="prose prose-sm mt-2 max-w-none text-muted-foreground leading-6">
							<LocalizedPortableTextContent
								language={post.language}
								value={readPortableText(post.body)}
								variant="preview"
							/>
						</div>
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
			{post.postKind !== "excerpt" && post.subject && subjectHref && !subjectIsCurrentUnit ? (
				<FeedCardTarget
					{...(post.subject.summary ? { description: subjectSummary } : {})}
					{...(post.subject.cover ? { imageUrl: post.subject.cover.url } : {})}
					href={subjectHref}
					imageAlt={subjectTitle}
					imageFallback={<UnitCoverFallback kind={post.subject.type} />}
					label={t.feed.relatedWork}
					rating={subjectRating}
					title={subjectTitle}
				/>
			) : null}
			{realmTagContext ? (
				<FeedCardTarget
					avatar={realmTagContext.tag.avatar}
					description={displayedSummary || undefined}
					href={href}
					imageAlt={realmTagTitle}
					label={t.feed.realmTagContext}
					title={realmTagTitle}
				/>
			) : null}
			<CardContent className="px-4 pb-4 sm:px-5">
				<FeedItemActions
					discussionHref={href}
					href={href}
					item={post}
					onOpen={trackOpen}
					overflowMenu={
						<FeedItemOverflowMenu
							contentHref={baseHref}
							canExclude={canExclude}
							item={post}
							onHiddenChange={onHiddenChange}
							actions={overflowActions}
							realmId={realmId}
						/>
					}
				/>
			</CardContent>
		</FeedCard>
	);
}

export function FeedUnitCard({
	unit,
	canExclude,
	onHiddenChange,
	overflowActions,
	position,
	preserveDisplayedLanguage = false,
	setSize,
}: {
	unit: FeedUnit;
	canExclude: boolean;
	onHiddenChange?: (hidden: boolean) => void;
	overflowActions?: ReactNode;
	position?: number;
	preserveDisplayedLanguage?: boolean;
	setSize?: number;
}) {
	const { t, locale } = useTranslation(["feed", "posts", "realms", "ui"]);
	const { elementRef, trackOpen } = useRecommendationTracking(unit.id, unit.tracking);
	const reason = recommendationReasonLabel(unit.recommendationReason, t.feed);
	const title = unit.title ?? t.ui.unnamed;
	const attributions = toFeedAttributionContexts(unit.attributions, t.posts.unknownAttribution);
	const realms = toFeedRealmContexts(unit.realms, t.ui.unnamed);
	const rating: FeedTargetRating | undefined =
		unit.presentation.kind === "rated-work"
			? {
					kind: "aggregate",
					score: toFeedTargetScore(selectFeedRating(unit.presentation.scores), t.ui.unnamed),
				}
			: undefined;
	const identityPresentation = unit.presentation.kind === "identity" ? unit.presentation : null;
	const realmTagContext = unit.unitKind === "tag" ? identityPresentation?.realmTagContext : null;
	const unitBaseHref = unitHref(unit.unitKind, unit.id);
	const href = realmTagContext
		? postHref(realmTagContext.contextPostId, {
				kind: "realm",
				realmId: realmTagContext.realmId,
			})
		: preserveDisplayedLanguage && unit.language && unitBaseHref
			? withContentLanguage(unitBaseHref, unit.language)
			: unitBaseHref;
	const displayedSummary = useChineseContentText(
		realmTagContext?.summary ?? unit.summary ?? "",
		realmTagContext?.language ?? unit.language,
	);
	const discussionBaseHref = feedUnitDiscussionHref(unit.unitKind, unit.id);
	const discussionHref =
		preserveDisplayedLanguage && unit.language && discussionBaseHref
			? withContentLanguage(discussionBaseHref, unit.language)
			: discussionBaseHref;
	const isRealm = unit.unitKind === "realm";

	return (
		<FeedCard
			aria-labelledby={`feed-item-${unit.id}`}
			aria-posinset={position}
			aria-setsize={setSize}
			ref={elementRef}
		>
			<FeedCardHeader
				attributions={attributions}
				realms={realms}
				recommendation={reason}
				showAttributions={!isRealm}
				timestamp={isRealm ? undefined : formatRelativeTime(unit.createdAt, locale.target)}
			/>
			{identityPresentation ? (
				<CardContent className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-4 px-4 pb-0 pt-3 sm:grid-cols-[5rem_minmax(0,1fr)] sm:px-5">
					<FeedItemMain className="block" href={href} onOpen={trackOpen}>
						<IdentityAvatar
							avatar={identityPresentation.avatar}
							className="size-[4.5rem] border border-border-weak text-2xl shadow-sm/5 sm:size-20"
							fallback={contextInitials(title)}
							imageAlt={title}
						/>
					</FeedItemMain>
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
							{displayedSummary ? (
								<p className="mt-2 line-clamp-3 text-muted-foreground text-sm leading-6">
									{displayedSummary}
								</p>
							) : null}
							{isRealm && identityPresentation.memberCount !== null ? (
								<p className="mt-2 text-xs font-medium text-muted-foreground">
									{t.realms.memberCount({
										count: toNonNegativeApiInteger(identityPresentation.memberCount),
									})}
								</p>
							) : null}
						</FeedItemMain>
					</div>
				</CardContent>
			) : (
				<FeedUnitContent
					coverUrl={unit.cover?.url}
					headingId={`feed-item-${unit.id}`}
					href={href}
					kind={unit.unitKind}
					kindLabel={t.feed.content.kinds[`unit:${unit.unitKind}`]}
					metadata={
						unit.collection ? (
							<p className="mt-2 text-xs font-medium text-muted-foreground">
								{t.feed.collectionDirectItems({
									count: toNonNegativeApiInteger(unit.collection.directItemCount),
								})}
							</p>
						) : undefined
					}
					onOpen={trackOpen}
					rating={rating ? <FeedCardRating rating={rating} /> : undefined}
					summary={displayedSummary}
					title={title}
				/>
			)}
			<CardContent className="px-4 pb-4 sm:px-5">
				<FeedItemActions
					discussionHref={discussionHref}
					href={href}
					item={unit}
					onOpen={trackOpen}
					overflowMenu={
						<FeedItemOverflowMenu
							contentHref={realmTagContext ? undefined : unitBaseHref}
							canExclude={canExclude}
							item={unit}
							onHiddenChange={onHiddenChange}
							actions={overflowActions}
							realmId={unit.realmId ?? undefined}
						/>
					}
				/>
			</CardContent>
		</FeedCard>
	);
}

function isRatedWorkKind(kind: string): kind is "book" | "media" | "software" | "series" {
	return kind === "book" || kind === "media" || kind === "software" || kind === "series";
}

function toFeedTargetScore(
	score: FeedRatingAggregate | null,
	unnamedRealm: string,
): FeedTargetScore | null {
	return score
		? {
				realmLabel: score.realmTitle ?? unnamedRealm,
				realmId: score.realmId,
				totalCount: Number(score.totalCount),
				totalScore: Number(score.totalScore),
			}
		: null;
}

function FeedItemOverflowMenu({
	actions,
	canExclude,
	contentHref,
	item,
	onHiddenChange,
	realmId,
}: {
	actions?: ReactNode;
	canExclude: boolean;
	contentHref?: string;
	item: FeedItem;
	onHiddenChange?: (hidden: boolean) => void;
	realmId?: string;
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
			reportTarget={{ unitId: item.id, realmId }}
		>
			{contentHref && item.availableLanguages.length > 1 ? (
				<ContentLanguageVersionMenu
					availableLanguages={item.availableLanguages}
					baseHref={contentHref}
					currentLanguage={item.language}
				/>
			) : null}
			{actions}
		</FeedOverflowMenu>
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
	discussionHref,
	href,
	item,
	onOpen,
	overflowMenu,
}: {
	discussionHref?: string;
	href?: string;
	item: FeedItem;
	onOpen: () => void;
	overflowMenu?: ReactNode;
}) {
	const policy = getFeedActionPolicy(
		item.itemType === "post"
			? { itemType: "post", postKind: item.postKind }
			: { itemType: "unit", unitKind: item.unitKind },
	);
	return (
		<FeedEngagementBar
			discussionHref={discussionHref}
			href={href}
			initialReaction={parseFeedReaction(item.viewerReaction)}
			itemId={item.id}
			onDiscussionClick={onOpen}
			overflowMenu={overflowMenu}
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
			...(creditedUnit.title ? { language: creditedUnit.language } : {}),
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
			...(realm.title ? { language: realm.language } : {}),
			...(realm.avatar ? { avatar: realm.avatar } : {}),
			...(realm.slugAddress ? { slug: realm.slugAddress.slug } : {}),
			...(realm.summary ? { summary: realm.summary } : {}),
		};
	});
}

function contextInitials(name: string): string {
	return Array.from(name.trim())[0]?.toLocaleUpperCase() ?? name;
}

function unitHref(kind: string, id: string): string | undefined {
	return publicUnitHref(kind, { id });
}
