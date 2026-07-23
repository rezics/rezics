import { ContentLanguageValues } from "@rezics/i18n";
import { PostApiSearchByIndexIndex } from "@rezics/openapi-tanstack-query";
import { SearchTemplateIdValues } from "@rezics/search";
import { parseAsArrayOf, parseAsString, parseAsStringLiteral } from "nuqs/server";
import { AuthPortalModes } from "./auth-redirect";

export const urlStateOptions = {
	clearOnDefault: true,
	history: "replace",
	shallow: true,
	scroll: false,
} as const;

export const FeedSorts = ["best", "hot", "new", "top", "rising"] as const;
export type FeedSort = (typeof FeedSorts)[number];
export function isFeedSort(value: string): value is FeedSort {
	return FeedSorts.some((candidate) => candidate === value);
}
export const feedSortParser = parseAsStringLiteral(FeedSorts)
	.withDefault("best")
	.withOptions({ ...urlStateOptions, history: "push" });

export const SearchScopes = Object.values(PostApiSearchByIndexIndex);
export const searchParamsParsers = {
	q: parseAsString.withDefault("").withOptions({ ...urlStateOptions, history: "push" }),
	template: parseAsStringLiteral(SearchTemplateIdValues)
		.withDefault("global")
		.withOptions(urlStateOptions),
	tag: parseAsArrayOf(parseAsString).withDefault([]).withOptions(urlStateOptions),
	tagLabel: parseAsArrayOf(parseAsString).withDefault([]).withOptions(urlStateOptions),
	scope: parseAsArrayOf(parseAsStringLiteral(SearchScopes))
		.withDefault([...SearchScopes])
		.withOptions(urlStateOptions),
	language: parseAsStringLiteral(ContentLanguageValues).withOptions(urlStateOptions),
};

export const authSearchParamsParsers = {
	auth: parseAsStringLiteral(AuthPortalModes).withOptions(urlStateOptions),
	next: parseAsString.withOptions(urlStateOptions),
	email: parseAsString.withOptions(urlStateOptions),
	error: parseAsString.withOptions(urlStateOptions),
	token: parseAsString.withOptions(urlStateOptions),
};
