"use client";

import { useQueryState } from "nuqs";

import { ApiFeedList } from "@/features/content-feed/data/api-feed-list";
import {
	feedContentParser,
	feedLanguagesParser,
	feedRealmIdsParser,
	feedSortParser,
	feedTagIdsParser,
} from "@/features/content-feed/routing/feed-search-params";
import { useTranslation } from "@/i18n/client";

export function Home() {
	const { t } = useTranslation(["feed"]);
	const [sort, setSort] = useQueryState("sort", feedSortParser);
	const [contentKinds, setContentKinds] = useQueryState("content", feedContentParser);
	const [languages, setLanguages] = useQueryState("languages", feedLanguagesParser);
	const [realmIds, setRealmIds] = useQueryState("realms", feedRealmIdsParser);
	const [tagIds, setTagIds] = useQueryState("tags", feedTagIdsParser);

	return (
		<main className="flex h-[calc(100svh-7rem)] w-full px-4 py-6 sm:h-[calc(100svh-3.5rem)] sm:px-7 sm:py-8 lg:px-12">
			<div className="mx-auto flex min-h-0 w-full max-w-[58rem] flex-col">
				<h1 className="sr-only">{t.feed.title}</h1>
				<ApiFeedList
					contentKinds={contentKinds}
					languages={languages}
					onContentKindsChange={(nextKinds) => void setContentKinds([...nextKinds])}
					onLanguagesChange={(nextLanguages) => void setLanguages([...nextLanguages])}
					onRealmIdsChange={(nextRealmIds) => void setRealmIds([...nextRealmIds])}
					onSortChange={(nextSort) => void setSort(nextSort)}
					onTagIdsChange={(nextTagIds) => void setTagIds([...nextTagIds])}
					infiniteScrollMode="contained"
					pagination="infinite"
					realmIds={realmIds}
					sort={sort}
					tagIds={tagIds}
				/>
			</div>
		</main>
	);
}
