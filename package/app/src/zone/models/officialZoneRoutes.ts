export const OFFICIAL_ZONE_SLUGS = {
  book: "book",
  realms: "realms",
  zones: "zones",
  popular: "popular",
} as const;

export type OfficialZoneKey = keyof typeof OFFICIAL_ZONE_SLUGS;

export function officialZoneHref(key: OfficialZoneKey): string {
  return `/z/${OFFICIAL_ZONE_SLUGS[key]}`;
}

export function officialZoneSearchHref(
  key: OfficialZoneKey,
  search?: { q?: string },
): string {
  const href = `${officialZoneHref(key)}/search`;
  if (!search?.q) return href;

  const params = new URLSearchParams({ q: search.q });
  return `${href}?${params.toString()}`;
}
