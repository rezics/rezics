import { t } from "elysia";
import { unitTypeSchema } from "../unit/unit";

// ============================================================
// TYPED BY-SLUG PATH PARAMS
// ============================================================

/**
 * Path params for `GET /user/by-slug/:slug` — resolves a USER-scope slug
 * to the matching `User` extension row keyed by `unitId`.
 */
export const userBySlugParamsSchema = t.Object({
  slug: t.String({ minLength: 1 }),
});

export type UserBySlugParams = (typeof userBySlugParamsSchema)["static"];

/**
 * Path params for `GET /entity/by-slug/:slug` — resolves an ENTITY-scope
 * slug. Returns 404 for every input in v1 until `entity-slug-activation`
 * permits ENTITY slug writes.
 */
export const entityBySlugParamsSchema = t.Object({
  slug: t.String({ minLength: 1 }),
});

export type EntityBySlugParams = (typeof entityBySlugParamsSchema)["static"];

/**
 * Path params for `GET /shelf/by-slug/:userSlug/:slug` — resolves the user
 * owner from `:userSlug`, then a SHELF Unit under the owner scope by
 * `:slug`. Returns 404 for any non-system-shelf slug in v1.
 */
export const shelfBySlugParamsSchema = t.Object({
  userSlug: t.String({ minLength: 1 }),
  slug: t.String({ minLength: 1 }),
});

export type ShelfBySlugParams = (typeof shelfBySlugParamsSchema)["static"];

// ============================================================
// GENERIC POST /slug/resolve
// ============================================================

/**
 * Request body for `POST /slug/resolve`.
 *
 * `scope` accepts either a named scope (`'user' | 'realm' | 'tag' | 'zone'
 * | 'entity'`) or an owner Unit id (UUID string). Named scopes are looked
 * up against `SlugScope` at resolution time; owner-unit-id scopes are used
 * as-is.
 */
export const slugResolvePayloadSchema = t.Object({
  scope: t.String({ minLength: 1 }),
  slug: t.String({ minLength: 1 }),
});

export type SlugResolvePayload = (typeof slugResolvePayloadSchema)["static"];

export const slugResolveResponseSchema = t.Object({
  unitId: t.String({ format: "uuid" }),
  type: unitTypeSchema,
});

export type SlugResolveResponse = (typeof slugResolveResponseSchema)["static"];
