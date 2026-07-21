import {
	publicUnitIdHref,
	publicSlugHref,
	type PublicSlugAddressValue,
	type PublicSlugTargetKind,
} from "@rezics/slug";

export interface AddressableUnit {
	readonly id: string;
	readonly slugAddress?: PublicSlugAddressValue | null;
}

export type EnabledSlugUnitKind = PublicSlugTargetKind;

/** Returns the optional canonical slug URL when proved, otherwise the stable ID URL. */
export function addressableUnitHref(kind: EnabledSlugUnitKind, unit: AddressableUnit): string {
	return publicSlugHref(kind, unit.slugAddress) ?? publicUnitIdHref(kind, unit.id);
}

export function realmHref(realm: AddressableUnit): string {
	return addressableUnitHref("realm", realm);
}

export function realmSettingsHref(realm: AddressableUnit): string {
	return `${realmHref(realm)}/settings`;
}

export function zoneHref(zone: AddressableUnit): string {
	return addressableUnitHref("zone", zone);
}
