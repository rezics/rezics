import {
	publicSlugHref,
	type PublicSlugAddressValue,
	type PublicSlugHrefStyle,
	type PublicSlugTargetKind,
} from "@rezics/slug";

export interface AddressableUnit {
	readonly id: string;
	readonly slugAddress?: PublicSlugAddressValue | null;
}

export type EnabledSlugUnitKind = PublicSlugTargetKind;

const IdRouteByKind = {
	profile: (id: string) => `/user/by-id/${id}`,
	realm: (id: string) => `/realms/${id}`,
	zone: (id: string) => `/zones/${id}`,
} satisfies Record<EnabledSlugUnitKind, (id: string) => string>;

/** Returns a canonical/short slug URL when proved, otherwise the ID fallback. */
export function addressableUnitHref(
	kind: EnabledSlugUnitKind,
	unit: AddressableUnit,
	style: PublicSlugHrefStyle = "canonical",
): string {
	return publicSlugHref(kind, unit.slugAddress, style) ?? IdRouteByKind[kind](unit.id);
}

export function realmHref(
	realm: AddressableUnit,
	style: PublicSlugHrefStyle = "canonical",
): string {
	return addressableUnitHref("realm", realm, style);
}

export function zoneHref(zone: AddressableUnit, style: PublicSlugHrefStyle = "canonical"): string {
	return addressableUnitHref("zone", zone, style);
}
