import {
	isAvailableZonePageSlug,
	publicUnitIdHref,
	publicSlugHref,
	ZoneHomePageSlug,
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

export type RealmPageId = "main" | "tags" | "wiki" | "info";

export function realmPageHref(realm: AddressableUnit, page: RealmPageId): string {
	const baseHref = realmHref(realm);
	return page === "main" ? baseHref : `${baseHref}/${page}`;
}

export function zoneHref(zone: AddressableUnit): string {
	return addressableUnitHref("zone", zone);
}

export interface AddressableZonePage {
	readonly id: string;
	readonly slug: string | null;
}

/**
 * Prefers a Zone-scoped Page slug and falls back to the stable Page Unit ID.
 *
 * The fallback intentionally keeps the Zone ID too: a Page ID proves identity,
 * while the owning Zone remains an explicit routing boundary.
 */
export function zonePageHref(zone: AddressableUnit, page: AddressableZonePage): string {
	const baseHref = zoneHref(zone);
	if (page.slug === ZoneHomePageSlug) return baseHref;
	if (page.slug && isAvailableZonePageSlug(page.slug)) return `${baseHref}/${page.slug}`;
	return `${publicUnitIdHref("zone", zone.id)}/page/${encodeURIComponent(page.id)}`;
}
