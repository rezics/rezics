import type { PublicSlugAddressValue } from "@rezics/slug";

import { profileHref } from "@/features/profiles/profile-route";
import { realmHref, zoneHref } from "@/features/slugs/unit-route";

export interface PublicUnitRouteValue {
	readonly id: string;
	readonly slugAddress?: PublicSlugAddressValue | null;
}

export function publicUnitHref(kind: string, value: PublicUnitRouteValue): string | undefined {
	switch (kind) {
		case "profile":
			return profileHref(value);
		case "realm":
			return realmHref(value);
		case "zone":
			return zoneHref(value);
		case "book":
		case "software":
		case "media":
		case "series":
		case "video":
		case "audio":
			return `/units/${kind}/${value.id}`;
		case "entity":
			return `/entities/${value.id}`;
		case "structure":
			return `/tag-structures/${value.id}`;
		case "collection":
			return `/collections/${value.id}`;
		case "post":
			return `/posts/${value.id}`;
		case "poll":
			return `/polls/${value.id}`;
		default:
			return undefined;
	}
}
