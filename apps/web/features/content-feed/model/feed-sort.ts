import type { PostApiFeedQueryRequestSortEnum } from "@rezics/openapi-tanstack-query";

export const FeedSortValues = [
	"best",
	"new",
] as const satisfies readonly PostApiFeedQueryRequestSortEnum[];
export type FeedSort = (typeof FeedSortValues)[number];

export function isFeedSort(value: string): value is FeedSort {
	return FeedSortValues.some((candidate) => candidate === value);
}
