import {
	GetApiAccountMeFollowingStatus200ItemsOwnerEnum,
	type GetApiAccountMeFollowingStatus200ItemsOwnerEnum as FollowingKind,
} from "@rezics/openapi-tanstack-query";
import { parseAsStringLiteral } from "nuqs/server";

import { realmHref, zoneHref, type AddressableUnit } from "@/features/slugs/unit-route";
import { urlStateOptions } from "@/lib/search-params";

export const FollowingKinds = Object.values(GetApiAccountMeFollowingStatus200ItemsOwnerEnum);
export const AllFollowingKinds = "all" as const;
export const FollowingFilters = [AllFollowingKinds, ...FollowingKinds] as const;
export type FollowingFilter = (typeof FollowingFilters)[number];

export const followingFilterParser = parseAsStringLiteral(FollowingFilters)
	.withDefault(AllFollowingKinds)
	.withOptions({ ...urlStateOptions, history: "push" });

export function followingManagementHref(kind: FollowingFilter = AllFollowingKinds): string {
	return kind === AllFollowingKinds ? "/me/following" : `/me/following?kind=${kind}`;
}

export function followingHref(
	kind: FollowingKind,
	value: string | AddressableUnit,
): string | undefined {
	const unit = typeof value === "string" ? { id: value } : value;
	const { id } = unit;
	switch (kind) {
		case "zone":
			return zoneHref(unit);
		case "realm":
			return realmHref(unit);
		case "publishing":
		case "music":
		case "program":
		case "grouping":
		case "reference":
		case "distribution":
		case "entity":
		case "software":
			return `/catalog/${kind}/${id}`;
		case "video":
		case "audio":
			return `/units/${kind}/${id}`;
		case "tag":
			return `/tags/${id}`;
		case "collection":
			return `/collections/${id}`;
		case "post":
			return `/posts/${id}`;
		case "poll":
			return `/polls/${id}`;
		case "label":
		case "realm_rule":
		case "custom_theme":
			return undefined;
	}
}
