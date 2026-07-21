"use client";

import type { GetApiFeedSort } from "@rezics/openapi-tanstack-query";
import { useState, type ReactNode } from "react";

import { Badge } from "@rezics/ui";
import {
	FeedCard,
	FeedCardBody,
	FeedCardContent,
	FeedCardHeader,
	FeedCardTitle,
	type FeedActor,
	type FeedRealm,
} from "@/features/content-feed/feed-card";
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
	const { t } = useTranslation(["feed"]);
	const actor: FeedActor = {
		name: t.feed.fixture.publisher,
		href: "#publisher",
		initials: t.feed.fixture.publisher.slice(0, 1),
	};
	const realms: readonly [FeedRealm, ...FeedRealm[]] = [
		{
			id: "fixture-realm",
			name: t.feed.fixture.realm,
			href: "#realm",
			initials: t.feed.fixture.realm.slice(0, 1),
		},
	];
	return (
		<FeedListItems aria-label={t.feed.fixture.canvasLabel}>
			<FeedCard aria-labelledby="fixture-feed-post">
				<FeedCardHeader
					actor={actor}
					realms={realms}
					timestamp={t.feed.fixture.timestamp}
				/>
				<FeedCardContent>
					<Badge className="w-fit" size="sm" variant="outline">
						{t.feed.content.kinds["post:post"]}
					</Badge>
					<FeedCardTitle id="fixture-feed-post">{t.feed.fixture.postTitle}</FeedCardTitle>
					<FeedCardBody>{t.feed.fixture.postBody}</FeedCardBody>
				</FeedCardContent>
			</FeedCard>
			<FeedCard aria-labelledby="fixture-feed-book">
				<FeedCardHeader
					actor={actor}
					realms={realms}
					timestamp={t.feed.fixture.timestamp}
				/>
				<FeedCardContent>
					<Badge className="w-fit" size="sm" variant="info">
						{t.feed.content.kinds["unit:book"]}
					</Badge>
					<FeedCardTitle id="fixture-feed-book">
						{t.feed.fixture.collectionTitle}
					</FeedCardTitle>
					<FeedCardBody>{t.feed.fixture.collectionBody}</FeedCardBody>
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
