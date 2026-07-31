"use client";

import type { UnitPredicate } from "@rezics/filter";
import { useQueryState } from "nuqs";

import { ApiFeedList } from "@/features/content-feed/data/api-feed-list";
import {
	feedContentParser,
	feedLanguagesParser,
	feedSortParser,
	feedTagIdsParser,
} from "@/features/content-feed/routing/feed-search-params";
import { RealmFeedManagementActions } from "./realm-feed-management-actions";

export function RealmFeed({
	additionalFilter,
	canManagePins,
	canManageTags,
	contentKinds,
	realmId,
	showControls = true,
}: {
	readonly additionalFilter?: UnitPredicate;
	readonly canManagePins: boolean;
	readonly canManageTags: boolean;
	readonly contentKinds?: readonly "post:wiki"[];
	readonly realmId: string;
	readonly showControls?: boolean;
}) {
	const [sort, setSort] = useQueryState("sort", feedSortParser);
	const [selectedContentKinds, setContentKinds] = useQueryState("content", feedContentParser);
	const [languages, setLanguages] = useQueryState("languages", feedLanguagesParser);
	const [tagIds, setTagIds] = useQueryState("tags", feedTagIdsParser);

	return (
		<ApiFeedList
			additionalFilter={additionalFilter}
			contentKinds={contentKinds ?? selectedContentKinds}
			languages={languages}
			onContentKindsChange={
				showControls && !contentKinds
					? (nextKinds) => void setContentKinds([...nextKinds])
					: undefined
			}
			onLanguagesChange={
				showControls ? (nextLanguages) => void setLanguages([...nextLanguages]) : undefined
			}
			onSortChange={showControls ? (nextSort) => void setSort(nextSort) : undefined}
			onTagIdsChange={
				showControls ? (nextTagIds) => void setTagIds([...nextTagIds]) : undefined
			}
			pagination="infinite"
			realmIds={[realmId]}
			renderOverflowActions={(item) => (
				<RealmFeedManagementActions
					canManagePins={canManagePins}
					canManageTags={canManageTags}
					item={item}
					realmId={realmId}
				/>
			)}
			sort={sort}
			tagIds={tagIds}
		/>
	);
}
