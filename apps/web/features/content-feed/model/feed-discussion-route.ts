import type { PostApiFeedQueryStatus200ItemsUnitKindEnum } from "@rezics/openapi-tanstack-query";

import { tagDetailHref } from "@/features/tags/routing/tag-links";
import { unitDetailHref } from "@/features/units/routing/unit-detail-routes";

export function feedUnitDiscussionHref(
	kind: PostApiFeedQueryStatus200ItemsUnitKindEnum,
	unitId: string,
): string | undefined {
	switch (kind) {
		case "book":
		case "media":
		case "software":
		case "series":
			return unitDetailHref(kind, unitId, "discussion");
		case "tag":
			return tagDetailHref(unitId, "discussion");
		case "collection":
		case "entity":
		case "poll":
		case "profile":
		case "realm":
		case "release":
		case "structure":
		case "zone":
			return undefined;
		default:
			return assertNever(kind);
	}
}

function assertNever(value: never): never {
	throw new Error(`Unhandled feed Unit kind: ${String(value)}`);
}
