"use client";

import { useState, type ReactNode } from "react";
import { LibraryIcon, MessageCircleIcon } from "lucide-react";

import { Badge, Button } from "@rezics/ui";
import {
	FeedCard,
	FeedCardActionBar,
	FeedCardBody,
	FeedCardContent,
	FeedCardHeader,
	FeedCardMedia,
	FeedCardTarget,
	FeedCardTitle,
	type FeedActor,
	type FeedRealm,
} from "@/features/content-feed/feed-card";
import {
	FeedOverflowMenuView,
	FeedShareSurfaceView,
	FeedVoteControl,
	type FeedReaction,
} from "@/features/content-feed/feed-card-actions";
import { bookCover, postMedia } from "@/features/content-feed/feed-card.mock";
import { useTranslation } from "@/i18n/client";

function useFixtureContext(): {
	actor: FeedActor;
	realms: readonly [FeedRealm, ...FeedRealm[]];
} {
	const { t } = useTranslation(["feed"]);
	return {
		actor: {
			name: t.feed.fixture.publisher,
			href: "#publisher",
			initials: t.feed.fixture.publisher.slice(0, 1),
		},
		realms: [
			{
				id: "fixture-realm",
				name: t.feed.fixture.realm,
				href: "#realm",
				initials: t.feed.fixture.realm.slice(0, 1),
			},
		],
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

function PostFeedCard() {
	const { t } = useTranslation(["feed"]);
	const { actor, realms } = useFixtureContext();
	return (
		<FeedCard aria-labelledby="post-feed-title">
			<FeedCardHeader
				actor={actor}
				menu={<FixtureMenu />}
				realms={realms}
				recommendation={t.feed.fixture.recommendation}
				timestamp={t.feed.fixture.timestamp}
			/>
			<FeedCardContent>
				<Badge className="w-fit" size="sm" variant="outline">
					{t.feed.content.kinds["post:post"]}
				</Badge>
				<FeedCardTitle id="post-feed-title">{t.feed.fixture.postTitle}</FeedCardTitle>
				<FeedCardBody>{t.feed.fixture.postBody}</FeedCardBody>
				<FeedCardMedia alt={t.feed.fixture.postTitle} src={postMedia} />
			</FeedCardContent>
			<FeedCardTarget
				href="#related-work"
				imageAlt={t.feed.fixture.collectionTitle}
				imageUrl={bookCover}
				label={t.feed.relatedWork}
				title={t.feed.fixture.collectionTitle}
			/>
			<FixtureActionBar comments={36} initialScore={2100} />
		</FeedCard>
	);
}

function ReviewFeedCard() {
	const { t } = useTranslation(["feed"]);
	const { actor, realms } = useFixtureContext();
	return (
		<FeedCard aria-labelledby="review-feed-title">
			<FeedCardHeader
				actor={actor}
				menu={<FixtureMenu />}
				realms={realms}
				timestamp={t.feed.fixture.timestamp}
			/>
			<FeedCardContent>
				<Badge className="w-fit" size="sm" variant="success">
					{t.feed.content.kinds["post:review"]}
				</Badge>
				<FeedCardTitle id="review-feed-title">
					{t.feed.fixture.collectionTitle}
				</FeedCardTitle>
				<FeedCardBody>{t.feed.fixture.postBody}</FeedCardBody>
			</FeedCardContent>
			<FixtureActionBar comments={18} initialScore={96} />
		</FeedCard>
	);
}

function BookFeedCard() {
	const { t } = useTranslation(["feed"]);
	const { actor, realms } = useFixtureContext();
	return (
		<FeedCard aria-labelledby="book-feed-title">
			<FeedCardHeader
				actor={actor}
				menu={<FixtureMenu />}
				realms={realms}
				timestamp={t.feed.fixture.timestamp}
			/>
			<FeedCardContent className="flex-row gap-4">
				<img
					alt={t.feed.fixture.collectionTitle}
					className="aspect-[2/3] w-24 shrink-0 rounded-lg object-cover sm:w-28"
					src={bookCover}
				/>
				<div className="flex min-w-0 flex-1 flex-col gap-2">
					<Badge className="w-fit" size="sm" variant="info">
						{t.feed.content.kinds["unit:book"]}
					</Badge>
					<FeedCardTitle id="book-feed-title">
						{t.feed.fixture.collectionTitle}
					</FeedCardTitle>
					<FeedCardBody>{t.feed.fixture.collectionBody}</FeedCardBody>
				</div>
			</FeedCardContent>
			<FeedCardActionBar>
				<FeedVoteControl onReactionChange={() => undefined} reaction={null} score="42" />
				<Button className="min-h-11 sm:min-h-8" pill size="sm" variant="secondary">
					<LibraryIcon aria-hidden data-icon="inline-start" />
					{t.feed.actions.addToCollection}
				</Button>
			</FeedCardActionBar>
		</FeedCard>
	);
}

function CollectionFeedCard() {
	const { t } = useTranslation(["feed", "ui"]);
	const { actor, realms } = useFixtureContext();
	const [following, setFollowing] = useState(false);
	return (
		<FeedCard aria-labelledby="collection-feed-title">
			<FeedCardHeader
				actor={actor}
				menu={<FixtureMenu />}
				realms={realms}
				timestamp={t.feed.fixture.timestamp}
			/>
			<FeedCardContent>
				<Badge className="w-fit" size="sm" variant="info">
					{t.feed.content.kinds["unit:collection"]}
				</Badge>
				<FeedCardTitle id="collection-feed-title">
					{t.feed.fixture.collectionTitle}
				</FeedCardTitle>
				<FeedCardBody>{t.feed.fixture.collectionBody}</FeedCardBody>
			</FeedCardContent>
			<FeedCardActionBar>
				<FeedVoteControl onReactionChange={() => undefined} reaction={null} score="128" />
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
