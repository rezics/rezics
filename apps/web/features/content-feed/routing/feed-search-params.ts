import { SimpleFeedContentKindValues } from "@rezics/filter";
import { ContentLanguageValues } from "@rezics/i18n";
import { parseAsArrayOf, parseAsString, parseAsStringLiteral } from "nuqs/server";

import { FeedSortValues } from "../model/feed-sort";

const feedUrlStateOptions = {
	clearOnDefault: true,
	history: "push",
	shallow: true,
	scroll: false,
} as const;

export const feedSortParser = parseAsStringLiteral(FeedSortValues)
	.withDefault("best")
	.withOptions(feedUrlStateOptions);
export const feedContentParser = parseAsArrayOf(parseAsStringLiteral(SimpleFeedContentKindValues))
	.withDefault([])
	.withOptions(feedUrlStateOptions);
export const feedLanguagesParser = parseAsArrayOf(parseAsStringLiteral(ContentLanguageValues))
	.withDefault([])
	.withOptions(feedUrlStateOptions);
export const feedRealmIdsParser = parseAsArrayOf(parseAsString)
	.withDefault([])
	.withOptions(feedUrlStateOptions);
export const feedTagIdsParser = parseAsArrayOf(parseAsString)
	.withDefault([])
	.withOptions(feedUrlStateOptions);
