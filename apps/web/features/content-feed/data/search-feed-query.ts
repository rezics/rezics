import type {
	FilterDocument,
	SearchFeatureContext,
	SearchFeatureState,
	SearchFeatureSurface,
	SearchInjection,
} from "@rezics/filter";
import type { ContentLanguage } from "@rezics/i18n";
import {
	postApiSearchFilterFeed,
	postApiSearchZonesByZoneIdFilterFeed,
} from "@rezics/openapi-tanstack-query";
import { getNextItemPageParam } from "@/lib/infinite-query";
import type { SearchFeedContinuationToken } from "../model/search-feed-continuation-token";

export type SearchFeedState = Omit<SearchFeatureState, "cursor"> & Readonly<{ cursor?: never }>;

export interface SearchFeedRequest {
	readonly contexts: readonly SearchFeatureContext[];
	readonly injections: readonly SearchInjection[];
	readonly state: SearchFeedState;
}

export type SearchFeedSource =
	| Readonly<{ kind: "filter"; filterDocument: FilterDocument }>
	| Readonly<{ kind: "zone"; zoneId: string }>;

export function withoutSearchFeedCursor(state: SearchFeatureState): SearchFeedState {
	const { cursor: _cursor, ...cursorFreeState } = state;
	return cursorFreeState;
}

function normalizeSearchFeedPage<
	Page extends Readonly<{
		items: readonly unknown[];
		nextCursor?: string;
	}>,
>(page: Page, currentCursor?: SearchFeedContinuationToken) {
	const nextCursor = getNextItemPageParam(
		{
			...page,
			// A successful route response is the proof for this route-specific brand.
			nextCursor: page.nextCursor as SearchFeedContinuationToken | undefined,
		},
		[],
		currentCursor,
	);
	return { ...page, nextCursor: nextCursor ?? null };
}

export async function fetchSearchFeedPage({
	cursor,
	localizationLanguages,
	request,
	signal,
	source,
	surface,
}: {
	readonly cursor?: SearchFeedContinuationToken;
	readonly localizationLanguages: readonly ContentLanguage[];
	readonly request: SearchFeedRequest;
	readonly signal?: AbortSignal;
	readonly source: SearchFeedSource;
	readonly surface: SearchFeatureSurface;
}) {
	const state = {
		...request.state,
		...(cursor ? { cursor } : {}),
	};
	if (source.kind === "filter") {
		const { data } = await postApiSearchFilterFeed({
			body: {
				filterDocument: source.filterDocument,
				contexts: [...request.contexts],
				injections: [...request.injections],
				localizationLanguages: [...localizationLanguages],
				state,
				surface,
			},
			signal,
		});
		return normalizeSearchFeedPage(data, cursor);
	}
	const { data } = await postApiSearchZonesByZoneIdFilterFeed({
		path: { zoneId: source.zoneId },
		body: {
			injections: [...request.injections],
			localizationLanguages: [...localizationLanguages],
			state,
			surface,
		},
		signal,
	});
	return normalizeSearchFeedPage(data, cursor);
}
