"use client";

import { useFeedFixtureData } from "@rezics/fixture-client";
import type { FeedFixtureAssetId } from "@rezics/fixture-data";
import { useState, type ReactNode } from "react";
import { LibraryIcon, MessageCircleIcon } from "lucide-react";

import { Badge, Button, Cover } from "@rezics/ui";
import {
	FeedCard,
	FeedCardActionBar,
	FeedCardBody,
	FeedCardContent,
	FeedCardHeader,
	FeedCardMedia,
	FeedCardTarget,
	FeedCardTitle,
} from "@/features/content-feed/components/feed-card";
import {
	FeedOverflowMenuView,
	FeedShareSurfaceView,
	FeedVoteControl,
	type FeedReaction,
} from "@/features/content-feed/components/feed-card-actions";
import { formatRelativeTime } from "@/features/content-feed/model/format-relative-time";
import { recommendationReasonLabel } from "@/features/recommendations/reason";
import { useTranslation } from "@/i18n/client";

const FeedFixtureAssetUrls = {
	"book-cover": "/fixtures/content-feed/book-cover.svg",
	"post-media": "/fixtures/content-feed/post-media.svg",
} satisfies Readonly<Record<FeedFixtureAssetId, string>>;

function useFixtureCardContext() {
	const fixture = useFeedFixtureData();
	const { locale, t } = useTranslation(["feed"]);
	return {
		feed: t.feed,
		fixture,
		recommendation: recommendationReasonLabel(fixture.recommendationReason, t.feed),
		timestamp: formatRelativeTime(fixture.createdAt, locale.target, fixture.referenceTime),
	};
}

function FixtureMenu() {
	const [saved, setSaved] = useState(false);
	return (
		<FeedOverflowMenuView
			canExclude
			onAddToCollection={() => undefined}
			onNotInterested={() => undefined}
			onToggleSaved={() => setSaved((current) => !current)}
			saved={saved}
		/>
	);
}

function FixtureActionBar({ comments, initialScore }: { comments: number; initialScore: number }) {
	const { locale, t } = useTranslation(["feed"]);
	const [reaction, setReaction] = useState<FeedReaction>(null);
	const score = initialScore + (reaction === "upvote" ? 1 : reaction === "downvote" ? -1 : 0);
	return (
		<FeedCardActionBar>
			<FeedVoteControl
				onReactionChange={setReaction}
				reaction={reaction}
				score={new Intl.NumberFormat(locale.target, { notation: "compact" }).format(score)}
			/>
			<Button className="min-h-11 sm:min-h-8" pill size="sm" variant="secondary">
				<MessageCircleIcon aria-hidden data-icon="inline-start" />
				{t.feed.actions.comments({ count: comments })}
			</Button>
			<FeedShareSurfaceView
				nativeShareAvailable
				onCopyLink={() => Promise.resolve()}
				onNativeShare={() => Promise.resolve(false)}
			/>
		</FeedCardActionBar>
	);
}

export function PostFeedCard() {
	const { feed, fixture, recommendation, timestamp } = useFixtureCardContext();
	return (
		<FeedCard aria-labelledby="post-feed-title">
			<FeedCardHeader
				menu={<FixtureMenu />}
				attributions={fixture.attributions}
				realms={fixture.realms}
				recommendation={recommendation}
				timestamp={timestamp}
			/>
			<FeedCardContent>
				<Badge className="w-fit" size="sm" variant="outline">
					{feed.content.kinds["post:post"]}
				</Badge>
				<FeedCardTitle id="post-feed-title">{fixture.post.title}</FeedCardTitle>
				<FeedCardBody>{fixture.post.body}</FeedCardBody>
				<FeedCardMedia
					alt={fixture.post.mediaAlt}
					src={FeedFixtureAssetUrls[fixture.post.mediaAsset]}
				/>
			</FeedCardContent>
			<FeedCardTarget
				description={fixture.collection.body}
				href={fixture.collection.href}
				imageAlt={fixture.collection.coverAlt}
				imageUrl={FeedFixtureAssetUrls[fixture.collection.coverAsset]}
				label={feed.relatedWork}
				score={fixture.collection.score}
				title={fixture.collection.title}
			/>
			<FixtureActionBar
				comments={fixture.metrics.post.replies}
				initialScore={fixture.metrics.post.score}
			/>
		</FeedCard>
	);
}

export function ReviewFeedCard() {
	const { feed, fixture, timestamp } = useFixtureCardContext();
	return (
		<FeedCard aria-labelledby="review-feed-title">
			<FeedCardHeader
				menu={<FixtureMenu />}
				attributions={fixture.attributions}
				realms={fixture.realms}
				timestamp={timestamp}
			/>
			<FeedCardContent>
				<Badge className="w-fit" size="sm" variant="success">
					{feed.content.kinds["post:review"]}
				</Badge>
				<FeedCardTitle id="review-feed-title">{fixture.collection.title}</FeedCardTitle>
				<FeedCardBody>{fixture.post.body}</FeedCardBody>
			</FeedCardContent>
			<FixtureActionBar
				comments={fixture.metrics.review.replies}
				initialScore={fixture.metrics.review.score}
			/>
		</FeedCard>
	);
}

export function BookFeedCard() {
	const { feed, fixture, timestamp } = useFixtureCardContext();
	return (
		<FeedCard aria-labelledby="book-feed-title">
			<FeedCardHeader
				menu={<FixtureMenu />}
				attributions={fixture.attributions}
				realms={fixture.realms}
				timestamp={timestamp}
			/>
			<FeedCardContent className="flex-row gap-4">
				<Cover
					alt={fixture.collection.coverAlt}
					className="w-24 shrink-0 rounded-lg sm:w-28"
					src={FeedFixtureAssetUrls[fixture.collection.coverAsset]}
				/>
				<div className="flex min-w-0 flex-1 flex-col gap-2">
					<Badge className="w-fit" size="sm" variant="info">
						{feed.content.kinds["unit:book"]}
					</Badge>
					<FeedCardTitle id="book-feed-title">{fixture.collection.title}</FeedCardTitle>
					<FeedCardBody>{fixture.collection.body}</FeedCardBody>
				</div>
			</FeedCardContent>
			<FeedCardActionBar>
				<FeedVoteControl
					onReactionChange={() => undefined}
					reaction={null}
					score={String(fixture.metrics.book.score)}
				/>
				<Button className="min-h-11 sm:min-h-8" pill size="sm" variant="secondary">
					<LibraryIcon aria-hidden data-icon="inline-start" />
					{feed.actions.addToCollection}
				</Button>
			</FeedCardActionBar>
		</FeedCard>
	);
}

export function CollectionFeedCard() {
	const { feed, fixture, timestamp } = useFixtureCardContext();
	const { t } = useTranslation(["ui"]);
	const [following, setFollowing] = useState(false);
	return (
		<FeedCard aria-labelledby="collection-feed-title">
			<FeedCardHeader
				menu={<FixtureMenu />}
				attributions={fixture.attributions}
				realms={fixture.realms}
				timestamp={timestamp}
			/>
			<FeedCardContent>
				<Badge className="w-fit" size="sm" variant="info">
					{feed.content.kinds["unit:collection"]}
				</Badge>
				<FeedCardTitle id="collection-feed-title">{fixture.collection.title}</FeedCardTitle>
				<FeedCardBody>{fixture.collection.body}</FeedCardBody>
			</FeedCardContent>
			<FeedCardActionBar>
				<FeedVoteControl
					onReactionChange={() => undefined}
					reaction={null}
					score={String(fixture.metrics.collection.score)}
				/>
				<Button
					aria-pressed={following}
					className="min-h-11 sm:min-h-8"
					onClick={() => setFollowing((current) => !current)}
					pill
					size="sm"
					variant={following ? "brand" : "secondary"}
				>
					{following ? t.ui.unfollow : t.ui.follow}
				</Button>
			</FeedCardActionBar>
		</FeedCard>
	);
}

const fixtures = {
	"Post · media and target": <PostFeedCard />,
	"Post · review": <ReviewFeedCard />,
	"Unit · book": <BookFeedCard />,
	"Unit · collection": <CollectionFeedCard />,
} satisfies Record<string, ReactNode>;

export default fixtures;
