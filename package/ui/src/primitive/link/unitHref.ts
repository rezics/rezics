/**
 * Single sanctioned helper for building hrefs to slug-bearing Unit types.
 *
 * Returns the short-prefix slug URL when a slug is known, falls back to the
 * long-prefix unitId URL otherwise. See
 * `openspec/specs/public-short-routes/spec.md` for the link-builder rule:
 * short=slug is the canonical browser-facing identity; long-prefix unitId URLs
 * SHALL NOT be rendered when a slug is known.
 *
 * Pure and synchronous — usable from route loaders, prefetchers, search-result
 * generators, and tests. Use {@link useUnitHref} for the React-side ergonomic
 * wrapper.
 */

export type SlugBearingTopType = "USER" | "REALM" | "TAG" | "ZONE" | "ENTITY";

type SlugBearingTopInput = {
  type: SlugBearingTopType;
  unitId: string;
  slug: string | null | undefined;
};

type SlugBearingShelfInput = {
  type: "SHELF";
  ownerType: "USER" | "REALM";
  ownerSlug: string | null | undefined;
  ownerUnitId: string;
  unitId: string;
  slug: string | null | undefined;
};

export type UnitHrefInput = SlugBearingTopInput | SlugBearingShelfInput;

const SHORT_PREFIX: Record<SlugBearingTopType, string> = {
  USER: "u",
  REALM: "r",
  TAG: "t",
  ZONE: "z",
  ENTITY: "e",
};

const LONG_PREFIX: Record<SlugBearingTopType, string> = {
  USER: "user",
  REALM: "realm",
  TAG: "tag",
  ZONE: "zone",
  ENTITY: "entity",
};

const SHELF_OWNER_SHORT: Record<SlugBearingShelfInput["ownerType"], string> = {
  USER: "u",
  REALM: "r",
};

export function unitHref(input: UnitHrefInput): string {
  if (input.type === "SHELF") {
    const ownerPrefix = SHELF_OWNER_SHORT[input.ownerType];
    if (input.ownerSlug && input.slug) {
      return `/${ownerPrefix}/${input.ownerSlug}/shelf/${input.slug}`;
    }
    return `/shelf/${input.unitId}`;
  }

  if (input.slug) {
    return `/${SHORT_PREFIX[input.type]}/${input.slug}`;
  }
  return `/${LONG_PREFIX[input.type]}/${input.unitId}`;
}
