import { createSimpleFeedFilter, type SimpleFeedContentKind } from "@rezics/filter";
import { parseAsArrayOf, parseAsStringLiteral } from "nuqs/server";

import type { SearchFeedRequest } from "@/features/content-feed/data/search-feed-list";

export const ProfileContentKindValues = [
	"unit:book",
	"unit:software",
	"unit:media",
	"unit:entity",
	"unit:zone",
	"unit:collection",
	"unit:realm",
	"post:post",
	"post:excerpt",
	"post:review",
	"post:chapter",
	"post:wiki",
	"post:picture",
] as const satisfies readonly SimpleFeedContentKind[];
export type ProfileContentKind = (typeof ProfileContentKindValues)[number];

const profileContentUrlStateOptions = {
	clearOnDefault: true,
	history: "push",
	shallow: true,
	scroll: false,
} as const;

export const profileContentParser = parseAsArrayOf(parseAsStringLiteral(ProfileContentKindValues))
	.withDefault([])
	.withOptions(profileContentUrlStateOptions);

export function normalizeProfileContentKinds(
	values: readonly SimpleFeedContentKind[],
): ProfileContentKind[] {
	const requested = new Set(values);
	return ProfileContentKindValues.filter((value) => requested.has(value));
}

export function createProfileContentRequest({
	contentKinds,
	profileId,
}: {
	readonly contentKinds: readonly ProfileContentKind[];
	readonly profileId: string;
}): SearchFeedRequest {
	const contentFilter = createSimpleFeedFilter({ contentKinds });
	const state = {
		pageSize: 20,
		sort: "updatedAt:desc",
		...(contentFilter ? { filter: { where: contentFilter } } : {}),
	} satisfies SearchFeedRequest["state"];
	return {
		contexts: [{ kind: "profile", profileId }],
		injections: [],
		state,
	};
}
