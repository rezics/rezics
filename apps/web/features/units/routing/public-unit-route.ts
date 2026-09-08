import type { PublicSlugAddressValue } from "@rezics/slug";
import type { CatalogOwner } from "@rezics/reference";

import { profileHref } from "@/features/profiles/profile-route";
import { realmHref, zoneHref } from "@/features/slugs/unit-route";

export interface PublicUnitRouteValue {
	readonly id: string;
	readonly slugAddress?: PublicSlugAddressValue | null;
}

export type PublicUnitKind =
	| CatalogOwner
	| "profile"
	| "realm"
	| "zone"
	| "video"
	| "audio"
	| "tag"
	| "collection"
	| "post"
	| "poll";

export function publicUnitHref(kind: PublicUnitKind, value: PublicUnitRouteValue): string;
export function publicUnitHref(kind: string, value: PublicUnitRouteValue): string | undefined;
export function publicUnitHref(kind: string, value: PublicUnitRouteValue): string | undefined {
	switch (kind) {
		case "profile":
			return profileHref(value);
		case "realm":
			return realmHref(value);
		case "zone":
			return zoneHref(value);
		case "publishing":
		case "music":
		case "program":
		case "software":
		case "grouping":
		case "entity":
		case "reference":
		case "distribution":
			return `/catalog/${kind}/${value.id}`;
		case "video":
		case "audio":
			return `/units/${kind}/${value.id}`;
		case "tag":
			return `/tags/${value.id}`;
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
