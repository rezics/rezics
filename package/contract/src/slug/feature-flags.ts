/**
 * Slug-subsystem feature flags.
 *
 * Each flag is a single source of truth consumed by the server. The
 * follow-on changes that enable these surfaces SHALL flip exactly one
 * constant here.
 */

/**
 * Whether ENTITY slug writes are accepted at the service layer.
 *
 * Substrate (the `entity` SlugScope row, the validator's accept-on-format
 * behavior, the `/entity/by-slug/:slug` route) is in place from L3 day one,
 * but every service entry point that would persist a slug on an ENTITY-typed
 * Unit SHALL reject the write with a typed `ENTITY_SLUG_DISABLED` error
 * while this flag is `false`. The follow-on `entity-slug-activation` change
 * flips this to `true`.
 */
export const ENTITY_SLUG_WRITES_ENABLED = false;
