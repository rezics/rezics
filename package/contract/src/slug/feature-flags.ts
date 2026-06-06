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
 * behavior, the `/entity/by-slug/:slug` route) is in place from L3 day one.
 * Activated by `entity-slug-activation`: ENTITY slug writes are now permitted
 * but service-layer-gated to `admin AND verified=true`. The flag stays here
 * for spec-history clarity and to give a single point to disable the surface
 * in an emergency.
 */
export const ENTITY_SLUG_WRITES_ENABLED = true;
