import {
	GetApiUsersMeFollowingStatus200ItemsKindEnum,
	type GetApiUsersMeFollowingStatus200ItemsKindEnum as FollowingKind,
} from "@rezics/openapi-tanstack-query";
import { parseAsStringLiteral } from "nuqs/server";

import { profileHref } from "@/features/profiles/profile-route";
import { realmHref, type AddressableUnit, zoneHref } from "@/features/slugs/unit-route";
import { urlStateOptions } from "@/lib/search-params";

export const FollowingKinds = Object.values(GetApiUsersMeFollowingStatus200ItemsKindEnum);
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
		case "profile":
			return profileHref(unit);
		case "book":
		case "software":
		case "media":
			return `/units/${kind}/${id}`;
		case "entity":
			return `/entities/${id}`;
		case "collection":
			return `/collections/${id}`;
		case "post":
			return `/posts/${id}`;
		case "poll":
			return `/polls/${id}`;
		case "slug_namespace":
		case "release":
		case "label":
		case "tag":
		case "series":
		case "realm_rule":
			return undefined;
	}
}
