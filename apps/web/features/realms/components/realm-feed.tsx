"use client";

import { useQueryState } from "nuqs";

import { ApiFeedList } from "@/features/content-feed/data/api-feed-list";
import {
	feedContentParser,
	feedLanguagesParser,
	feedSortParser,
	feedTagIdsParser,
} from "@/features/content-feed/routing/feed-search-params";

export function RealmFeed({ realmId }: { realmId: string }) {
	const [sort, setSort] = useQueryState("sort", feedSortParser);
	const [contentKinds, setContentKinds] = useQueryState("content", feedContentParser);
	const [languages, setLanguages] = useQueryState("languages", feedLanguagesParser);
	const [tagIds, setTagIds] = useQueryState("tags", feedTagIdsParser);

	return (
		<ApiFeedList
			contentKinds={contentKinds}
			infinite
			languages={languages}
			onContentKindsChange={(nextKinds) => void setContentKinds([...nextKinds])}
			onLanguagesChange={(nextLanguages) => void setLanguages([...nextLanguages])}
			onSortChange={(nextSort) => void setSort(nextSort)}
			onTagIdsChange={(nextTagIds) => void setTagIds([...nextTagIds])}
			realmIds={[realmId]}
			sort={sort}
			tagIds={tagIds}
		/>
	);
}
