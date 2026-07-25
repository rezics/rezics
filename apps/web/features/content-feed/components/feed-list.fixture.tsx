"use client";

import type { GetApiFeedSort } from "@rezics/openapi-tanstack-query";
import { useState, type ReactNode } from "react";

import {
	BookFeedCard,
	CollectionFeedCard,
	PostFeedCard,
	ReviewFeedCard,
} from "@/features/content-feed/components/feed-card.fixture";
import { FeedListItems } from "@/features/content-feed/components/feed-list";
import { FeedListControls } from "@/features/content-feed/data/api-feed-list";
import {
	DefaultFeedContentKinds,
	DefaultPostListContentKinds,
	FeedContentKinds,
	PostListContentKinds,
	type FeedContentKind,
	type PostListContentKind,
} from "@/features/content-feed/model/feed-kind";
import { useTranslation } from "@/i18n/client";

function FullFeedListFixture() {
	const [sort, setSort] = useState<GetApiFeedSort>("best");
	const [contentKinds, setContentKinds] =
		useState<readonly FeedContentKind[]>(DefaultFeedContentKinds);
	return (
		<div className="grid gap-3 sm:gap-4">
			<FeedListControls
				contentKinds={contentKinds}
				contentOptions={FeedContentKinds}
				onContentKindsChange={setContentKinds}
				onSortChange={setSort}
				showBulkActions
				sort={sort}
			/>
			<FixtureFeedItems />
		</div>
	);
}

function PostListFixture() {
	const [sort, setSort] = useState<GetApiFeedSort>("new");
	const [contentKinds, setContentKinds] = useState<readonly PostListContentKind[]>(
		DefaultPostListContentKinds,
	);
	return (
		<div className="grid gap-3 sm:gap-4">
			<FeedListControls
				contentKinds={contentKinds}
				contentOptions={PostListContentKinds}
				onContentKindsChange={setContentKinds}
				onSortChange={setSort}
				showBulkActions={false}
				sort={sort}
			/>
			<FixtureFeedItems />
		</div>
	);
}

function FixtureFeedItems() {
	const { t } = useTranslation(["feed"]);
	return (
		<FeedListItems aria-label={t.feed.title}>
			<PostFeedCard />
			<ReviewFeedCard />
			<BookFeedCard />
			<CollectionFeedCard />
		</FeedListItems>
	);
}

const fixtures = {
	"Full feed · bulk actions": <FullFeedListFixture />,
	"Post list · post default": <PostListFixture />,
} satisfies Record<string, ReactNode>;

export default fixtures;
