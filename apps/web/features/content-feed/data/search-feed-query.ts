import type {
	EmbeddableSearchTemplateId,
	SearchFeatureState,
	SearchFeatureSurface,
} from "@rezics/filter";
import type { ContentLanguage } from "@rezics/i18n";
import {
	postApiSearchFeaturesByTemplateFeed,
	postApiSearchZonesByZoneIdFeatureFeed,
	type PostApiSearchFeaturesByTemplateExecuteBody,
} from "@rezics/openapi-tanstack-query";

export type SearchFeedState = Omit<SearchFeatureState, "cursor"> & Readonly<{ cursor?: never }>;

export type SearchFeedRequest = Readonly<
	Pick<PostApiSearchFeaturesByTemplateExecuteBody, "contexts" | "injections"> & {
		readonly state: SearchFeedState;
	}
>;

export type SearchFeedSource =
	| Readonly<{ kind: "template"; template: EmbeddableSearchTemplateId }>
	| Readonly<{ kind: "zone"; zoneId: string }>;

export function withoutSearchFeedCursor(state: SearchFeatureState): SearchFeedState {
	const { cursor: _cursor, ...cursorFreeState } = state;
	return cursorFreeState;
}

export async function fetchSearchFeedPage({
	cursor,
	localizationLanguages,
	request,
	signal,
	source,
	surface,
}: {
	readonly cursor?: string;
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
	if (source.kind === "template") {
		const { data } = await postApiSearchFeaturesByTemplateFeed({
			path: { template: source.template },
			body: { ...request, localizationLanguages: [...localizationLanguages], state, surface },
			signal,
		});
		return { ...data, nextCursor: data.nextCursor ?? null };
	}
	const { data } = await postApiSearchZonesByZoneIdFeatureFeed({
		path: { zoneId: source.zoneId },
		body: {
			injections: request.injections,
			localizationLanguages: [...localizationLanguages],
			state,
			surface,
		},
		signal,
	});
	return { ...data, nextCursor: data.nextCursor ?? null };
}
