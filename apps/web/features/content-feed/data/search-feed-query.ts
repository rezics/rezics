import type { SearchTemplateId } from "@rezics/filter";
import {
	postApiSearchFeaturesByTemplateFeed,
	postApiSearchZonesByZoneIdFeatureFeed,
	type PostApiSearchFeaturesByTemplateExecuteBody,
} from "@rezics/openapi-tanstack-query";

export type SearchFeedRequest = Pick<
	PostApiSearchFeaturesByTemplateExecuteBody,
	"contexts" | "injections" | "state"
>;

export type SearchFeedSource =
	| Readonly<{ kind: "template"; template: SearchTemplateId }>
	| Readonly<{ kind: "zone"; zoneId: string }>;

export async function fetchSearchFeedPage({
	cursor,
	request,
	signal,
	source,
}: {
	readonly cursor?: string;
	readonly request: SearchFeedRequest;
	readonly signal?: AbortSignal;
	readonly source: SearchFeedSource;
}) {
	const state = {
		...request.state,
		...(cursor ? { cursor } : {}),
	};
	if (source.kind === "template") {
		const { data } = await postApiSearchFeaturesByTemplateFeed({
			path: { template: source.template },
			body: { ...request, state },
			signal,
		});
		return data;
	}
	const { data } = await postApiSearchZonesByZoneIdFeatureFeed({
		path: { zoneId: source.zoneId },
		body: {
			injections: request.injections,
			state,
		},
		signal,
	});
	return data;
}
