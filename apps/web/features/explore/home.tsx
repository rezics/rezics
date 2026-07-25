"use client";

import { useQueryState } from "nuqs";

import { ApiFeedList } from "@/features/content-feed/data/api-feed-list";
import { useTranslation } from "@/i18n/client";
import {
	feedLanguagesParser,
	feedRealmIdsParser,
	feedSortParser,
	feedTagIdsParser,
} from "@/lib/search-params";

export function Home() {
	const { t } = useTranslation(["feed"]);
	const [sort, setSort] = useQueryState("sort", feedSortParser);
	const [languages, setLanguages] = useQueryState("languages", feedLanguagesParser);
	const [realmIds, setRealmIds] = useQueryState("realms", feedRealmIdsParser);
	const [tagIds, setTagIds] = useQueryState("tags", feedTagIdsParser);

	return (
		<main className="w-full px-4 py-6 sm:px-7 sm:py-8 lg:px-12">
			<div className="mx-auto w-full max-w-[58rem]">
				<h1 className="sr-only">{t.feed.title}</h1>
				<ApiFeedList
					infinite
					languages={languages}
					onLanguagesChange={(nextLanguages) => void setLanguages([...nextLanguages])}
					onRealmIdsChange={(nextRealmIds) => void setRealmIds([...nextRealmIds])}
					onSortChange={(nextSort) => void setSort(nextSort)}
					onTagIdsChange={(nextTagIds) => void setTagIds([...nextTagIds])}
					realmIds={realmIds}
					sort={sort}
					tagIds={tagIds}
				/>
			</div>
		</main>
	);
}
