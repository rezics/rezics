"use client";

import type { PostApiFeedQueryStatus200 } from "@rezics/openapi-tanstack-query";
import type { PortableTextDocument } from "@rezics/block";
import type { ContentLanguage } from "@rezics/i18n";
import type { ReactNode } from "react";

import { Card, CardContent, CardHeader } from "@rezics/ui";
import { LocalizedPortableTextContent } from "@/features/content-language-display/localized-portable-text-content";
import { useChineseContentText } from "@/features/content-language-display/chinese-content-display-context";
import { ConnectedFeedEngagementBar } from "@/features/content-feed/components/feed-card-actions";
import type { FeedActionPolicy } from "@/features/content-feed/model/feed-action-policy";
import { useTranslation } from "@/i18n/client";
import { readPortableText } from "@/lib/block";
import {
	AttributionLinks,
	PublisherAttributionLinks,
	type AttributionSummary,
} from "../attribution-list";
import { formatRelativeTime } from "@/features/content-feed/model/format-relative-time";

type PostKind = Extract<
	PostApiFeedQueryStatus200["items"][number],
	{ itemType: "post" }
>["postKind"];

const PostDetailActionPolicy = {
	discussion: "replies",
	primary: "none",
} as const satisfies FeedActionPolicy;

export interface PostDetailArticleValue {
	readonly id: string;
	readonly postKind: PostKind;
	readonly attributions: readonly AttributionSummary[];
	readonly realmId: string | null;
	readonly language: ContentLanguage;
	readonly title: string | null;
	readonly titleLanguage: ContentLanguage | null;
	readonly summary?: string | null;
	readonly body: PortableTextDocument | null;
	readonly createdAt: string;
}

export function PostDetailArticle({
	actions,
	bodyContent,
	commentsHref,
	engagementOverflow,
	post,
	replyCount = 0,
	variant = "card",
}: {
	readonly actions?: ReactNode;
	readonly bodyContent?: ReactNode;
	readonly commentsHref?: string;
	readonly engagementOverflow?: ReactNode;
	readonly post: PostDetailArticleValue;
	readonly replyCount?: number;
	readonly variant?: "card" | "thread";
}) {
	const { locale, t } = useTranslation(["feed", "posts"]);
	const displayedTitle = useChineseContentText(post.title ?? "", post.titleLanguage);
	const displayedSummary = useChineseContentText(post.summary ?? "", post.language);
	const content = (
		<>
			<p className="font-semibold text-brand text-xs">
				{t.feed.content.kinds[`post:${post.postKind}`]}
			</p>
			{post.title ? (
				<h1
					className="mt-2 font-heading font-black text-2xl leading-tight sm:text-3xl"
					id={`post-detail-${post.id}`}
				>
					{displayedTitle}
				</h1>
			) : null}
			{post.summary ? (
				<p className="mt-4 text-muted-foreground text-lg leading-7">{displayedSummary}</p>
			) : null}
			{bodyContent !== undefined ? (
				<div className="prose mt-5 max-w-none">{bodyContent}</div>
			) : post.body ? (
				<div className="prose mt-5 max-w-none">
					<LocalizedPortableTextContent
						language={post.language}
						value={readPortableText(post.body)}
						variant="article"
					/>
				</div>
			) : null}
			<div className="mt-6 border-border-weak border-t pt-2">
				<ConnectedFeedEngagementBar
					discussionHref={commentsHref}
					itemId={post.id}
					overflowMenu={engagementOverflow}
					policy={PostDetailActionPolicy}
					realmId={post.realmId ?? undefined}
					replyCount={replyCount}
				/>
			</div>
		</>
	);

	if (variant === "thread")
		return (
			<article
				aria-labelledby={post.title ? `post-detail-${post.id}` : undefined}
				className="min-w-0"
			>
				<header className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
					<div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-muted-foreground">
						<PublisherAttributionLinks
							attributions={post.attributions}
							emptyLabel={t.posts.unknownAttribution}
							publisherLabel={t.posts.publisher}
						/>
						<span aria-hidden className="text-xs">
							·
						</span>
						<time className="text-xs">{formatRelativeTime(post.createdAt, locale.target)}</time>
					</div>
					{actions ? <div className="flex flex-wrap justify-end gap-2">{actions}</div> : null}
				</header>
				<div className="mt-4">{content}</div>
			</article>
		);

	return (
		<Card asChild className="gap-0 overflow-hidden py-0">
			<article aria-labelledby={post.title ? `post-detail-${post.id}` : undefined}>
				<CardHeader className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 border-border-weak border-b px-4 py-4 sm:px-6">
					<div className="min-w-0 text-muted-foreground text-sm">
						<AttributionLinks
							attributions={post.attributions}
							className="text-foreground hover:text-link-hover"
							emptyLabel={t.posts.unknownAttribution}
						/>
						<span aria-hidden> · </span>
						<time>{formatRelativeTime(post.createdAt, locale.target)}</time>
					</div>
					{actions ? <div className="flex flex-wrap justify-end gap-2">{actions}</div> : null}
				</CardHeader>
				<CardContent className="px-4 py-5 sm:px-6 sm:py-6">{content}</CardContent>
			</article>
		</Card>
	);
}
