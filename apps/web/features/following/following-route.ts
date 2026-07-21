import {
	GetApiUsersMeFollowingStatus200ItemsKindEnum,
	type GetApiUsersMeFollowingStatus200ItemsKindEnum as FollowingKind,
} from "@rezics/openapi-tanstack-query";

export const FollowingKinds = Object.values(GetApiUsersMeFollowingStatus200ItemsKindEnum);

export function followingHref(kind: FollowingKind, id: string): string | undefined {
	switch (kind) {
		case "zone":
			return `/zones/${id}`;
		case "realm":
			return `/realms/${id}`;
		case "profile":
			return `/users/${id}`;
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
		case "tag":
		case "series":
		case "realm_rule":
			return undefined;
	}
}
