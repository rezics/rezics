"use client";

import { useQueryState } from "nuqs";

import { FeedList } from "@/features/content-feed/feed-list";
import { feedContentParser, FeedContentKinds } from "@/features/content-feed/feed-kind";
import { useTranslation } from "@/i18n/client";
import { feedSortParser } from "@/lib/search-params";

export function Home() {
	const { t } = useTranslation(["feed"]);
	const [sort, setSort] = useQueryState("sort", feedSortParser);
	const [contentKinds, setContentKinds] = useQueryState("content", feedContentParser);

	return (
		<main className="w-full px-4 py-6 sm:px-7 sm:py-8 lg:px-12">
			<div className="w-full max-w-[58rem]">
				<h1 className="sr-only">{t.feed.title}</h1>
				<FeedList
					contentKinds={contentKinds}
					contentOptions={FeedContentKinds}
					infinite
					onContentKindsChange={(nextKinds) => void setContentKinds([...nextKinds])}
					onSortChange={(nextSort) => void setSort(nextSort)}
					showBulkActions
					sort={sort}
				/>
			</div>
		</main>
	);
}
