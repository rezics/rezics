import { SimpleFeedContentKindValues } from "@rezics/filter";
import { ContentLanguageValues } from "@rezics/i18n";
import { createParser, parseAsArrayOf, parseAsStringLiteral } from "nuqs/server";

import { FeedSortValues } from "../model/feed-sort";

const feedUrlStateOptions = {
	clearOnDefault: true,
	history: "push",
	shallow: true,
	scroll: false,
} as const;
const UnitIdPattern =
	/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/;
const feedUnitIdParser = createParser({
	parse: (value) => (UnitIdPattern.test(value) ? value : null),
	serialize: String,
});

export const feedSortParser = parseAsStringLiteral(FeedSortValues)
	.withDefault("best")
	.withOptions(feedUrlStateOptions);
export const feedQueryParser = createParser({
	parse: (value) => (value.length <= 500 ? value : null),
	serialize: String,
})
	.withDefault("")
	.withOptions(feedUrlStateOptions);
export const feedContentParser = parseAsArrayOf(parseAsStringLiteral(SimpleFeedContentKindValues))
	.withDefault([])
	.withOptions(feedUrlStateOptions);
export const feedLanguagesParser = parseAsArrayOf(parseAsStringLiteral(ContentLanguageValues))
	.withDefault([])
	.withOptions(feedUrlStateOptions);
export const feedRealmIdsParser = parseAsArrayOf(feedUnitIdParser)
	.withDefault([])
	.withOptions(feedUrlStateOptions);
export const feedTagIdsParser = parseAsArrayOf(feedUnitIdParser)
	.withDefault([])
	.withOptions(feedUrlStateOptions);
