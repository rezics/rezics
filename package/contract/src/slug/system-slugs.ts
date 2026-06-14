/**
 * Platform-minted shelf slug for each user's favorites collection.
 *
 * The platform writes this reserved slug under the owning user's slug scope,
 * so bootstrap and recovery code bypass user slug validation deliberately.
 */
export const FAVORITES_SHELF_SLUG = "favorites" as const;

export const RESERVED_SHELF_SLUGS = [FAVORITES_SHELF_SLUG] as const;

export type ReservedShelfSlug = (typeof RESERVED_SHELF_SLUGS)[number];

export const RESERVED_SHELF_SLUG_SET: ReadonlySet<ReservedShelfSlug> = new Set(
  RESERVED_SHELF_SLUGS,
);
