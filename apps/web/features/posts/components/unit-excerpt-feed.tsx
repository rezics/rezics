"use client";

import { useQueryStates } from "nuqs";
import { useMemo } from "react";

import {
	ApiFeedList,
	type ApiFeedResultMetadata,
} from "@/features/content-feed/data/api-feed-list";
import { createSubjectFeedPredicate } from "@/features/content-feed/model/subject-feed-filter";
import {
	feedLanguagesParser,
	feedQueryParser,
	feedRealmIdsParser,
	feedSortParser,
	feedTagIdsParser,
} from "@/features/content-feed/routing/feed-search-params";
import { useTranslation } from "@/i18n/client";

const ExcerptPageSize = 20;
const excerptFeedSearchParams = {
	languages: feedLanguagesParser,
	q: feedQueryParser,
	realms: feedRealmIdsParser,
	sort: feedSortParser,
	tags: feedTagIdsParser,
} as const;

export function UnitExcerptFeed({ targetId }: { readonly targetId: string }) {
	const { locale, t } = useTranslation(["engagement"]);
	const [route, setRoute] = useQueryStates(excerptFeedSearchParams);
	const additionalFilter = useMemo(
		() => createSubjectFeedPredicate({ kind: "excerpt", subjectId: targetId }),
		[targetId],
	);
	const formatRange = ({ displayedCount, total }: ApiFeedResultMetadata) => {
		const numberFormat = new Intl.NumberFormat(locale.current);
		const values = {
			end: numberFormat.format(displayedCount),
			start: numberFormat.format(displayedCount ? 1 : 0),
			total: numberFormat.format(total.value),
		};
		return (
			<p className="text-sm text-muted-foreground" role="status">
				{total.relation === "exact"
					? t.engagement.excerptResultRange(values)
					: t.engagement.excerptResultRangeLowerBound(values)}
			</p>
		);
	};

	return (
		<ApiFeedList
			additionalFilter={additionalFilter}
			aria-label={t.engagement.excerpts}
			contentKinds={["post:excerpt"]}
			displayContext={{ kind: "unit", unitId: targetId }}
			emptyBody={t.engagement.emptyExcerpts}
			emptyTitle={t.engagement.emptyExcerpts}
			infinite
			languages={route.languages}
			limit={ExcerptPageSize}
			onLanguagesChange={(languages) => void setRoute({ languages: [...languages] })}
			onRealmIdsChange={(realms) => void setRoute({ realms: [...realms] })}
			onSearchQueryChange={(q) => void setRoute({ q })}
			onSortChange={(sort) => void setRoute({ sort })}
			onTagIdsChange={(tags) => void setRoute({ tags: [...tags] })}
			realmIds={route.realms}
			renderSummary={formatRange}
			searchQuery={route.q}
			sort={route.sort}
			tagIds={route.tags}
		/>
	);
}
