"use client";

import type { PostApiFeedQueryStatus200 } from "@rezics/openapi-tanstack-query";
import type { PortableTextDocument } from "@rezics/block";
import type { ReactNode } from "react";

import { Card, CardContent, CardHeader, PortableTextContent } from "@rezics/ui";
import { ConnectedFeedEngagementBar } from "@/features/content-feed/components/feed-card-actions";
import {
	FeedCardRating,
	type FeedTargetRating,
} from "@/features/content-feed/components/feed-card";
import type { FeedActionPolicy } from "@/features/content-feed/model/feed-action-policy";
import { apiValueToUnitScore } from "@/features/reviews/model/score-value";
import { useTranslation } from "@/i18n/client";
import { readPortableText } from "@/lib/block";
import { AttributionLinks, type AttributionSummary } from "../attribution-list";
import { formatRelativeTime } from "@/features/content-feed/model/format-relative-time";

type PostKind = Extract<
	PostApiFeedQueryStatus200["items"][number],
	{ itemType: "post" }
>["postKind"];

const PostDetailActionPolicy = {
	comments: true,
	primary: "none",
} as const satisfies FeedActionPolicy;

export interface PostDetailArticleValue {
	readonly id: string;
	readonly postKind: PostKind;
	readonly attributions: readonly AttributionSummary[];
	readonly realmId: string | null;
	readonly title: string;
	readonly summary?: string | null;
	readonly body: PortableTextDocument | null;
	readonly createdAt: string;
	readonly scores: readonly { readonly value: string | number }[];
}

export function PostDetailArticle({
	actions,
	commentsHref,
	post,
	replyCount = 0,
}: {
	readonly actions?: ReactNode;
	readonly commentsHref?: string;
	readonly post: PostDetailArticleValue;
	readonly replyCount?: number;
}) {
	const { locale, t } = useTranslation(["feed", "posts"]);
	const attachedScore = post.scores[0];
	const attachedScoreValue = attachedScore ? apiValueToUnitScore(attachedScore.value) : undefined;
	const rating: FeedTargetRating | undefined = attachedScoreValue
		? { kind: "attached", value: attachedScoreValue }
		: undefined;
	return (
		<Card asChild className="gap-0 overflow-hidden py-0">
			<article aria-labelledby={`post-detail-${post.id}`}>
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
					{actions ? (
						<div className="flex flex-wrap justify-end gap-2">{actions}</div>
					) : null}
				</CardHeader>
				<CardContent className="px-4 py-5 sm:px-6 sm:py-6">
					<div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
						<p className="font-semibold text-brand text-xs">
							{t.feed.content.kinds[`post:${post.postKind}`]}
						</p>
						{rating ? <FeedCardRating className="mt-0" rating={rating} /> : null}
					</div>
					<h1
						className="mt-2 font-heading font-black text-2xl leading-tight sm:text-3xl"
						id={`post-detail-${post.id}`}
					>
						{post.title}
					</h1>
					{post.body ? (
						<div className="prose mt-5 max-w-none">
							<PortableTextContent
								value={readPortableText(post.body)}
								variant="article"
							/>
						</div>
					) : post.summary ? (
						<p className="mt-4 text-muted-foreground leading-7">{post.summary}</p>
					) : null}
					<div className="mt-6 border-border-weak border-t pt-2">
						<ConnectedFeedEngagementBar
							href={commentsHref}
							itemId={post.id}
							policy={PostDetailActionPolicy}
							realmId={post.realmId ?? undefined}
							replyCount={replyCount}
						/>
					</div>
				</CardContent>
			</article>
		</Card>
	);
}
