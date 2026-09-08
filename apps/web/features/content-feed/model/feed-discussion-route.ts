import type { PostApiFeedQueryStatus200ItemsOwnerEnum } from "@rezics/openapi-tanstack-query";

import { tagDetailHref } from "@/features/tags/routing/tag-links";

export function feedUnitDiscussionHref(
	kind: PostApiFeedQueryStatus200ItemsOwnerEnum,
	unitId: string,
): string | undefined {
	switch (kind) {
		case "publishing":
		case "music":
		case "program":
		case "software":
		case "grouping":
			return `/catalog/${kind}/${unitId}/discussion`;
		case "tag":
			return tagDetailHref(unitId, "discussion");
		case "collection":
		case "entity":
		case "poll":
		case "realm":
		case "video":
		case "audio":
		case "reference":
		case "distribution":
		case "zone":
			return undefined;
		default:
			return assertNever(kind);
	}
}

function assertNever(value: never): never {
	throw new Error(`Unhandled feed Unit kind: ${String(value)}`);
}
