import { t } from "elysia";
import { FAVORITES_SHELF_SLUG } from "../slug/system-slugs";

export const RESERVED_SHELF_LABELS = {
  favorites: "Favorites",
} as const;

export function formatReservedShelfTitle(
  slug: string,
  shelfSlug: typeof FAVORITES_SHELF_SLUG,
  label?: string,
): string {
  return `${slug}'s ${label ?? RESERVED_SHELF_LABELS[shelfSlug]}`;
}

export const ensureSystemShelfBodySchema = t.Object(
  {
    slug: t.Literal(FAVORITES_SHELF_SLUG),
  },
  { additionalProperties: false },
);

export type EnsureSystemShelfBody =
  (typeof ensureSystemShelfBodySchema)["static"];

export const ensureSystemShelfResponseSchema = t.Object({
  unitId: t.String(),
  created: t.Boolean(),
});

export type EnsureSystemShelfResponse =
  (typeof ensureSystemShelfResponseSchema)["static"];
