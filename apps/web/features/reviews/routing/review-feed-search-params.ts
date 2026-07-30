import { createSerializer, parseAsArrayOf, parseAsJson, parseAsNumberLiteral } from "nuqs";

import type { ScoreRealmSelection } from "../data/default-score-realm";
import { UnitScoreValues, type UnitScore } from "../model/score-value";
import {
	feedLanguagesParser,
	feedQueryParser,
	feedRealmIdsParser,
	feedSortParser,
	feedTagIdsParser,
} from "@/features/content-feed/routing/feed-search-params";
import type { ContentLanguage } from "@rezics/i18n";
import type { FeedSort } from "@/features/content-feed/model/feed-sort";

const routeStateOptions = {
	clearOnDefault: true,
	history: "push",
	shallow: true,
	scroll: false,
} as const;

const UnitIdPattern =
	/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/;

export const scoreRealmParser = parseAsJson<ScoreRealmSelection>((value) => {
	if (
		!value ||
		typeof value !== "object" ||
		!("id" in value) ||
		!("label" in value) ||
		typeof value.id !== "string" ||
		!UnitIdPattern.test(value.id) ||
		typeof value.label !== "string" ||
		!value.label.trim() ||
		value.label.length > 500
	)
		return null;
	return { id: value.id, label: value.label };
}).withOptions(routeStateOptions);

export const reviewScoresParser = parseAsArrayOf(parseAsNumberLiteral(UnitScoreValues))
	.withDefault([])
	.withOptions(routeStateOptions);

export const reviewFeedSearchParams = {
	languages: feedLanguagesParser,
	q: feedQueryParser,
	realms: feedRealmIdsParser,
	scoreRealm: scoreRealmParser,
	scores: reviewScoresParser,
	sort: feedSortParser,
	tags: feedTagIdsParser,
} as const;

const serializeReviewFeedSearchParams = createSerializer(reviewFeedSearchParams);

export interface ReviewFeedRouteState {
	readonly languages: readonly ContentLanguage[];
	readonly q: string;
	readonly realms: readonly string[];
	readonly scoreRealm: ScoreRealmSelection | null;
	readonly scores: readonly UnitScore[];
	readonly sort: FeedSort;
	readonly tags: readonly string[];
}

export function reviewFeedHref(baseHref: string, state: ReviewFeedRouteState): string {
	return serializeReviewFeedSearchParams(baseHref, {
		languages: [...state.languages],
		q: state.q,
		realms: [...state.realms],
		scoreRealm: state.scoreRealm,
		scores: [...state.scores],
		sort: state.sort,
		tags: [...state.tags],
	});
}
