import { Value } from "@sinclair/typebox/value";
import { t } from "elysia";

// ============================================================
// SHORT-PREFIX SLUG ROUTES — accept only slug-shaped values
// ============================================================

/**
 * Canonical public browser path: `/u/:userSlug`.
 *
 * Resolves `(slugScope = <user-scope-unit-id>, slug = :userSlug)` on `Unit`.
 * It NEVER resolves `Unit.id`; callers holding a unit id must use the
 * long-prefix route `/user/:unitId` or the generic `/unit/:unitId` fallback.
 */
export const publicUserSlugRouteParamsSchema = t.Object({
  userSlug: t.String({ minLength: 1 }),
});

/**
 * Canonical public browser path: `/r/:realmSlug`.
 *
 * Resolves `(slugScope = <realm-scope-unit-id>, slug = :realmSlug)` on
 * `Unit`. It NEVER resolves `Unit.id`.
 */
export const publicRealmSlugRouteParamsSchema = t.Object({
  realmSlug: t.String({ minLength: 1 }),
});

/**
 * Canonical public browser path: `/t/:tagSlug`.
 *
 * Resolves `(slugScope = <tag-scope-unit-id>, slug = :tagSlug)` on `Unit`.
 * It NEVER resolves `Unit.id`.
 */
export const publicTagSlugRouteParamsSchema = t.Object({
  tagSlug: t.String({ minLength: 1 }),
});

/**
 * Canonical public browser path: `/z/:zoneSlug`.
 *
 * Resolves `(slugScope = <zone-scope-unit-id>, slug = :zoneSlug)` on
 * `Unit`. It NEVER resolves `Unit.id`.
 */
export const publicZoneSlugRouteParamsSchema = t.Object({
  zoneSlug: t.String({ minLength: 1 }),
});

/**
 * Canonical public browser path: `/e/:entitySlug`.
 *
 * Resolves `(slugScope = <entity-scope-unit-id>, slug = :entitySlug)` on
 * `Unit`. Returns 404 for every input until `entity-slug-activation`
 * permits ENTITY slug writes. It NEVER resolves `Unit.id`.
 */
export const publicEntitySlugRouteParamsSchema = t.Object({
  entitySlug: t.String({ minLength: 1 }),
});

// ============================================================
// LONG-PREFIX UUID ROUTES — accept only UUID-shaped values
// ============================================================

/**
 * Canonical public browser path: `/user/:unitId`.
 *
 * Resolves only `Unit.id` where `type = USER`. Returns 404 for type
 * mismatch. It NEVER resolves a slug.
 */
export const publicUserUnitIdRouteParamsSchema = t.Object({
  unitId: t.String({ format: "uuid" }),
});

/**
 * Canonical public browser path: `/realm/:unitId`.
 *
 * Resolves only `Unit.id` where `type = REALM`.
 */
export const publicRealmUnitIdRouteParamsSchema = t.Object({
  unitId: t.String({ format: "uuid" }),
});

/**
 * Canonical public browser path: `/tag/:unitId`.
 *
 * Resolves only `Unit.id` where `type = TAG`.
 */
export const publicTagUnitIdRouteParamsSchema = t.Object({
  unitId: t.String({ format: "uuid" }),
});

/**
 * Canonical public browser path: `/zone/:unitId`.
 *
 * Resolves only `Unit.id` where `type = ZONE`.
 */
export const publicZoneUnitIdRouteParamsSchema = t.Object({
  unitId: t.String({ format: "uuid" }),
});

/**
 * Canonical public browser path: `/entity/:unitId`.
 *
 * Resolves only `Unit.id` where `type = ENTITY`.
 */
export const publicEntityUnitIdRouteParamsSchema = t.Object({
  unitId: t.String({ format: "uuid" }),
});

/**
 * Canonical public browser path: `/unit/:unitId`.
 *
 * Universal UUID fallback resolving any Unit by id. When the resolved
 * Unit's type has a typed long-prefix route, the generic resolver MAY
 * redirect to that typed route per the `?view` search-param convention.
 */
export const publicUnitIdRouteParamsSchema = t.Object({
  unitId: t.String({ format: "uuid" }),
});

// ============================================================
// OWNER-SCOPED SUB-RESOURCE ROUTES
// ============================================================

/**
 * Canonical public browser path: `/u/:userSlug/shelf/:slug`.
 *
 * Resolves the owner USER unit via `:userSlug`, then a SHELF Unit under
 * the owner scope by `:slug`. v1 resolves only contract-defined system
 * shelf slugs (`favorites` / `backlog` / `active` / `completed`).
 */
export const publicUserShelfSlugRouteParamsSchema = t.Object({
  userSlug: t.String({ minLength: 1 }),
  slug: t.String({ minLength: 1 }),
});

/**
 * Canonical public browser path: `/r/:realmSlug/shelf/:slug`.
 *
 * Substrate only in v1 — no shelves are resolvable until a future change
 * opens realm-owned shelf creation. The route schema is exported so
 * frontend/backend route tables can wire it consistently.
 */
export const publicRealmShelfSlugRouteParamsSchema = t.Object({
  realmSlug: t.String({ minLength: 1 }),
  slug: t.String({ minLength: 1 }),
});

// ============================================================
// SEARCH PARAMS
// ============================================================

/**
 * Public Unit resolver search params for `/unit/:unitId`.
 *
 * Omitted `view` is equivalent to `view=auto`. `view=auto` redirects to a
 * typed long-prefix route when one exists, while `view=unit` suppresses
 * typed redirect and renders the generic Unit view.
 */
export const publicUnitResolverSearchSchema = t.Object({
  view: t.Optional(t.Union([t.Literal("auto"), t.Literal("unit")])),
});

// ============================================================
// TYPES & GUARDS
// ============================================================

export type PublicUserSlugRouteParams =
  (typeof publicUserSlugRouteParamsSchema)["static"];
export type PublicRealmSlugRouteParams =
  (typeof publicRealmSlugRouteParamsSchema)["static"];
export type PublicTagSlugRouteParams =
  (typeof publicTagSlugRouteParamsSchema)["static"];
export type PublicZoneSlugRouteParams =
  (typeof publicZoneSlugRouteParamsSchema)["static"];
export type PublicEntitySlugRouteParams =
  (typeof publicEntitySlugRouteParamsSchema)["static"];

export type PublicUserUnitIdRouteParams =
  (typeof publicUserUnitIdRouteParamsSchema)["static"];
export type PublicRealmUnitIdRouteParams =
  (typeof publicRealmUnitIdRouteParamsSchema)["static"];
export type PublicTagUnitIdRouteParams =
  (typeof publicTagUnitIdRouteParamsSchema)["static"];
export type PublicZoneUnitIdRouteParams =
  (typeof publicZoneUnitIdRouteParamsSchema)["static"];
export type PublicEntityUnitIdRouteParams =
  (typeof publicEntityUnitIdRouteParamsSchema)["static"];

export type PublicUnitIdRouteParams =
  (typeof publicUnitIdRouteParamsSchema)["static"];

export type PublicUserShelfSlugRouteParams =
  (typeof publicUserShelfSlugRouteParamsSchema)["static"];
export type PublicRealmShelfSlugRouteParams =
  (typeof publicRealmShelfSlugRouteParamsSchema)["static"];

export type PublicUnitResolverSearch =
  (typeof publicUnitResolverSearchSchema)["static"];

export function isPublicUserSlugRouteParams(
  value: unknown,
): value is PublicUserSlugRouteParams {
  return Value.Check(publicUserSlugRouteParamsSchema, value);
}

export function isPublicRealmSlugRouteParams(
  value: unknown,
): value is PublicRealmSlugRouteParams {
  return Value.Check(publicRealmSlugRouteParamsSchema, value);
}

export function isPublicTagSlugRouteParams(
  value: unknown,
): value is PublicTagSlugRouteParams {
  return Value.Check(publicTagSlugRouteParamsSchema, value);
}

export function isPublicZoneSlugRouteParams(
  value: unknown,
): value is PublicZoneSlugRouteParams {
  return Value.Check(publicZoneSlugRouteParamsSchema, value);
}

export function isPublicEntitySlugRouteParams(
  value: unknown,
): value is PublicEntitySlugRouteParams {
  return Value.Check(publicEntitySlugRouteParamsSchema, value);
}

export function isPublicUserShelfSlugRouteParams(
  value: unknown,
): value is PublicUserShelfSlugRouteParams {
  return Value.Check(publicUserShelfSlugRouteParamsSchema, value);
}

export function isPublicRealmShelfSlugRouteParams(
  value: unknown,
): value is PublicRealmShelfSlugRouteParams {
  return Value.Check(publicRealmShelfSlugRouteParamsSchema, value);
}

export function isPublicUnitIdRouteParams(
  value: unknown,
): value is PublicUnitIdRouteParams {
  return Value.Check(publicUnitIdRouteParamsSchema, value);
}

export function isPublicUnitResolverSearch(
  value: unknown,
): value is PublicUnitResolverSearch {
  return Value.Check(publicUnitResolverSearchSchema, value);
}
