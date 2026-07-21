"use client";

import { useFeedFixtureData } from "@rezics/fixture-client";
import type { GetApiFeedSort } from "@rezics/openapi-tanstack-query";
import { useState, type ReactNode } from "react";

import { Badge } from "@rezics/ui";
import {
	FeedCard,
	FeedCardBody,
	FeedCardContent,
	FeedCardHeader,
	FeedCardTitle,
} from "@/features/content-feed/feed-card";
import { formatRelativeTime } from "@/features/content-feed/format-relative-time";
import { FeedListControls, FeedListItems } from "@/features/content-feed/feed-list";
import {
	DefaultFeedContentKinds,
	DefaultPostListContentKinds,
	FeedContentKinds,
	PostListContentKinds,
	type FeedContentKind,
	type PostListContentKind,
} from "@/features/content-feed/feed-kind";
import { useTranslation } from "@/i18n/client";

function FullFeedListFixture() {
	const [sort, setSort] = useState<GetApiFeedSort>("best");
	const [contentKinds, setContentKinds] =
		useState<readonly FeedContentKind[]>(DefaultFeedContentKinds);
	return (
		<div className="grid gap-0">
			<FeedListControls
				contentKinds={contentKinds}
				contentOptions={FeedContentKinds}
				onContentKindsChange={setContentKinds}
				onSortChange={setSort}
				showBulkActions
				sort={sort}
			/>
			<MockFeedItems />
		</div>
	);
}

function PostListFixture() {
	const [sort, setSort] = useState<GetApiFeedSort>("new");
	const [contentKinds, setContentKinds] = useState<readonly PostListContentKind[]>(
		DefaultPostListContentKinds,
	);
	return (
		<div className="grid gap-0">
			<FeedListControls
				contentKinds={contentKinds}
				contentOptions={PostListContentKinds}
				onContentKindsChange={setContentKinds}
				onSortChange={setSort}
				showBulkActions={false}
				sort={sort}
			/>
			<MockFeedItems />
		</div>
	);
}

function MockFeedItems() {
	const fixture = useFeedFixtureData();
	const { locale, t } = useTranslation(["feed"]);
	const timestamp = formatRelativeTime(fixture.createdAt, locale.target, fixture.referenceTime);
	return (
		<FeedListItems aria-label={t.feed.title}>
			<FeedCard aria-labelledby="fixture-feed-post">
				<FeedCardHeader
					actor={fixture.publisher}
					realms={fixture.realms}
					timestamp={timestamp}
				/>
				<FeedCardContent>
					<Badge className="w-fit" size="sm" variant="outline">
						{t.feed.content.kinds["post:post"]}
					</Badge>
					<FeedCardTitle id="fixture-feed-post">{fixture.post.title}</FeedCardTitle>
					<FeedCardBody>{fixture.post.body}</FeedCardBody>
				</FeedCardContent>
			</FeedCard>
			<FeedCard aria-labelledby="fixture-feed-book">
				<FeedCardHeader
					actor={fixture.publisher}
					realms={fixture.realms}
					timestamp={timestamp}
				/>
				<FeedCardContent>
					<Badge className="w-fit" size="sm" variant="info">
						{t.feed.content.kinds["unit:book"]}
					</Badge>
					<FeedCardTitle id="fixture-feed-book">{fixture.collection.title}</FeedCardTitle>
					<FeedCardBody>{fixture.collection.body}</FeedCardBody>
				</FeedCardContent>
			</FeedCard>
		</FeedListItems>
	);
}

const fixtures = {
	"Full feed · bulk actions": <FullFeedListFixture />,
	"Post list · post default": <PostListFixture />,
} satisfies Record<string, ReactNode>;

export default fixtures;
