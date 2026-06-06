/**
 * System shelf slugs minted by the platform on behalf of every user.
 *
 * These values are reserved against user claims (they appear in
 * `RESERVED_SLUGS`) and minted by the platform's bootstrap path, which
 * SHALL bypass {@link validateSlug} when writing them. The validator would
 * otherwise reject the slug it is itself installing.
 *
 * Minting code SHALL read the canonical string from this constant and
 * persist it directly — neither format nor reserved-word checks apply,
 * because the input is not user-supplied.
 */
export const SYSTEM_SHELF_SLUGS = [
  "favorites",
  "saved",
  "backlog",
  "active",
  "completed",
] as const;

export type SystemShelfSlug = (typeof SYSTEM_SHELF_SLUGS)[number];

export const SYSTEM_SHELF_SLUG_SET: ReadonlySet<SystemShelfSlug> = new Set(
  SYSTEM_SHELF_SLUGS,
);
