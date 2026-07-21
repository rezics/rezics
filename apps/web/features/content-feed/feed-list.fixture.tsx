"use client";

import type { GetApiFeedSort } from "@rezics/openapi-tanstack-query";
import { resources } from "@rezics/i18n/resources";
import type { TranslationSnapshot } from "native-i18n";
import { useState, type ReactNode } from "react";

import { Badge } from "@rezics/ui";
import {
	FeedCard,
	FeedCardBody,
	FeedCardContent,
	FeedCardHeader,
	FeedCardTitle,
} from "@/features/content-feed/feed-card";
import { author, realms, reviewer } from "@/features/content-feed/feed-card.mock";
import { FeedListControls, FeedListItems } from "@/features/content-feed/feed-list";
import {
	DefaultFeedContentKinds,
	DefaultPostListContentKinds,
	FeedContentKinds,
	PostListContentKinds,
	type FeedContentKind,
	type PostListContentKind,
} from "@/features/content-feed/feed-kind";
import { TranslationProvider } from "@/i18n/client";

const feedTranslations = await resources.loaders["zh-Hant"].feed();
const feedTranslationSnapshot = {
	locale: { current: "zh-Hant", target: "zh-Hant" },
	namespaces: { feed: feedTranslations },
	context: { locale: "zh-Hant", timeZone: "Asia/Taipei" },
} satisfies TranslationSnapshot<typeof resources, "feed">;

function FeedListFixtureCanvas({
	children,
	width = "wide",
}: {
	children: ReactNode;
	width?: "wide" | "mobile";
}) {
	return (
		<TranslationProvider<"feed"> initial={feedTranslationSnapshot}>
			<main className="min-h-screen overflow-x-hidden bg-background p-3 text-foreground sm:p-8">
				<div
					className={
						width === "mobile"
							? "mx-auto w-[390px] max-w-full min-w-0 bg-background"
							: "mx-auto w-full max-w-3xl min-w-0 bg-background"
					}
				>
					{children}
				</div>
			</main>
		</TranslationProvider>
	);
}

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
	return (
		<FeedListItems aria-label="內容動態示例">
			<FeedCard aria-labelledby="fixture-feed-post">
				<FeedCardHeader actor={author} realms={realms} timestamp="2 小時前" />
				<FeedCardContent>
					<Badge className="w-fit" size="sm" variant="outline">
						主題貼文
					</Badge>
					<FeedCardTitle id="fixture-feed-post">
						為什麼御坂網絡是學園都市最特別的群體意識？
					</FeedCardTitle>
					<FeedCardBody>以多個單元與貼文種類組成的完整內容動態。</FeedCardBody>
				</FeedCardContent>
			</FeedCard>
			<FeedCard aria-labelledby="fixture-feed-book">
				<FeedCardHeader actor={reviewer} realms={realms} timestamp="昨天" />
				<FeedCardContent>
					<Badge className="w-fit" size="sm" variant="info">
						書籍
					</Badge>
					<FeedCardTitle id="fixture-feed-book">新約 魔法禁書目錄 15</FeedCardTitle>
					<FeedCardBody>不同內容種類仍共享一致的列表節奏與分隔。</FeedCardBody>
				</FeedCardContent>
			</FeedCard>
		</FeedListItems>
	);
}

const fixtures = {
	"Full feed · bulk actions": (
		<FeedListFixtureCanvas>
			<FullFeedListFixture />
		</FeedListFixtureCanvas>
	),
	"Post list · post default": (
		<FeedListFixtureCanvas>
			<PostListFixture />
		</FeedListFixtureCanvas>
	),
	"Post list · mobile": (
		<FeedListFixtureCanvas width="mobile">
			<PostListFixture />
		</FeedListFixtureCanvas>
	),
} satisfies Record<string, ReactNode>;

export default fixtures;
