"use client";

import { ContentLanguageValues, type ContentLanguage } from "@rezics/i18n";
import type { PostApiFeedQueryRequestSortEnum } from "@rezics/openapi-tanstack-query";
import { useState, type ReactNode } from "react";

import {
	BookFeedCard,
	CollectionFeedCard,
	PostFeedCard,
	ReviewFeedCard,
} from "@/features/content-feed/components/feed-card.fixture";
import { FeedListItems } from "@/features/content-feed/components/feed-list";
import { FeedListControls } from "@/features/content-feed/data/api-feed-list";
import { useTranslation } from "@/i18n/client";

function FullFeedListFixture() {
	const [sort, setSort] = useState<PostApiFeedQueryRequestSortEnum>("best");
	const [languages, setLanguages] = useState<readonly ContentLanguage[]>([
		ContentLanguageValues[0],
	]);
	const [realmIds, setRealmIds] = useState<readonly string[]>([]);
	return (
		<div className="grid gap-3 sm:gap-4">
			<FeedListControls
				languages={languages}
				onLanguagesChange={setLanguages}
				onRealmIdsChange={setRealmIds}
				onSortChange={setSort}
				realmIds={realmIds}
				sort={sort}
			/>
			<FixtureFeedItems />
		</div>
	);
}

function PostListFixture() {
	return <FixtureFeedItems />;
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
